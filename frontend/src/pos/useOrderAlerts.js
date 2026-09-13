import { useEffect, useRef, useState } from "react";
import { shopApi } from "../shop/shopApi.js";

const STORAGE_KEY = "strobrie-pos-last-seen-order-id";
const POLL_MS = 20000;

// A two-tone chime via the Web Audio API — no audio file to ship or go
// missing, just tones generated on the spot.
function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    [880, 1175].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + i * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.25, now + i * 0.16 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.16 + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.16);
      osc.stop(now + i * 0.16 + 0.35);
    });
  } catch {
    // Web Audio unavailable (e.g. autoplay not yet permitted) — skip quietly
  }
}

// Polls paid shop orders in the background so Flow can show an unread
// count and chime on a new one, regardless of which tab is open. Only
// "paid" orders count — a lot of "pending" rows are abandoned checkouts
// that never became real orders.
export function useOrderAlerts(enabled) {
  const [lastSeenId, setLastSeenId] = useState(() => {
    try {
      return parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10);
    } catch {
      return 0;
    }
  });
  const [paidOrders, setPaidOrders] = useState([]);
  const knownMaxId = useRef(0);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    async function poll() {
      try {
        const orders = await shopApi.adminListOrders();
        if (cancelled) return;
        const paid = orders.filter((o) => o.status === "paid");
        setPaidOrders(paid);
        const maxId = paid.reduce((m, o) => Math.max(m, o.id), 0);
        if (!isFirstLoad.current && maxId > knownMaxId.current) {
          playChime();
        }
        knownMaxId.current = Math.max(knownMaxId.current, maxId);
        isFirstLoad.current = false;
      } catch {
        // Network hiccup — just try again next tick
      }
    }

    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [enabled]);

  const unseenCount = paidOrders.filter((o) => o.id > lastSeenId).length;

  function markSeen() {
    const maxId = paidOrders.reduce((m, o) => Math.max(m, o.id), lastSeenId);
    setLastSeenId(maxId);
    try {
      localStorage.setItem(STORAGE_KEY, String(maxId));
    } catch {
      // localStorage unavailable — badge just won't persist across reloads
    }
  }

  return { unseenCount, markSeen };
}
