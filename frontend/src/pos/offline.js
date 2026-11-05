// Offline till support: queue sales rung up with no connection and sync them
// when the network returns. Reference data (the menu) is cached so the sell
// screen still works offline.
//
// Storage is localStorage (small, synchronous, survives reloads/crashes). The
// queue is money, so every read/write is guarded and nothing is dropped on a
// failed sync — a sale only leaves the queue once the server has it.

import { posApi } from "./posApi.js";

const QUEUE_KEY = "flow_offline_queue_v1";
const FAILED_KEY = "flow_offline_failed_v1";
const MENU_KEY = "flow_menu_cache_v1";

// Keep in step with the backend (NAIRA_PER_POINT_EARNED in pos_sales.py).
const NAIRA_PER_POINT_EARNED = 200;

// --- tiny pub/sub so the banner + sell screen react to queue changes ------
const listeners = new Set();
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notify() {
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      /* a bad listener shouldn't break the queue */
    }
  }
}

// --- storage helpers ------------------------------------------------------
function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full / blocked — nothing we can safely do here */
  }
}

export function queuedCount() {
  return read(QUEUE_KEY).length;
}
export function failedCount() {
  return read(FAILED_KEY).length;
}

// --- menu cache -----------------------------------------------------------
export function cacheMenu(items) {
  if (Array.isArray(items)) write(MENU_KEY, items);
}
export function cachedMenu() {
  const items = read(MENU_KEY);
  return items.length ? items : null;
}

// --- queueing a sale ------------------------------------------------------
function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  // Fallback for older webviews.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// Store an offline sale and return a sale-shaped object for the on-screen
// receipt. Offline sales never redeem points (balance can't be verified), so
// discount is always 0 here.
export function queueSale(body) {
  const subtotal = body.items.reduce((s, l) => s + l.price * l.qty, 0);
  const total = subtotal; // no redemption offline
  const pointsEarned = Math.floor(total / NAIRA_PER_POINT_EARNED);
  const record = {
    ...body,
    redeem_points: 0,
    offline: true,
    client_uuid: uuid(),
    client_timestamp: new Date().toISOString(),
  };
  const queue = read(QUEUE_KEY);
  queue.push(record);
  write(QUEUE_KEY, queue);
  notify();
  return {
    subtotal,
    discount: 0,
    total,
    payment_method: body.payment_method,
    points_earned: pointsEarned,
    points_redeemed: 0,
    timestamp: record.client_timestamp,
    offline: true,
  };
}

// --- syncing --------------------------------------------------------------
export function isNetworkError(err) {
  if (!navigator.onLine) return true;
  const m = (err && err.message) || "";
  return /failed to fetch|networkerror|load failed|network request failed/i.test(m);
}

let syncing = false;

// Post queued sales one at a time. A sale leaves the queue only on success.
// On a network error we stop (still offline) and leave everything queued. On a
// definitive server rejection we move that one sale to a "failed" list so it
// doesn't block the rest or retry forever — a manager can review those.
export async function syncQueue() {
  if (syncing) return { synced: 0, stoppedOffline: false };
  syncing = true;
  let synced = 0;
  let stoppedOffline = false;
  try {
    let queue = read(QUEUE_KEY);
    while (queue.length) {
      const sale = queue[0];
      try {
        await posApi.charge(sale);
      } catch (err) {
        if (isNetworkError(err)) {
          stoppedOffline = true;
          break;
        }
        // Server said no (and it wasn't the network) — park it for review.
        const failed = read(FAILED_KEY);
        failed.push({ ...sale, error: (err && err.message) || "rejected" });
        write(FAILED_KEY, failed);
        queue = queue.slice(1);
        write(QUEUE_KEY, queue);
        notify();
        continue;
      }
      // Success: drop it from the front and persist immediately.
      queue = queue.slice(1);
      write(QUEUE_KEY, queue);
      synced += 1;
      notify();
    }
  } finally {
    syncing = false;
  }
  return { synced, stoppedOffline };
}

export function clearFailed() {
  write(FAILED_KEY, []);
  notify();
}
