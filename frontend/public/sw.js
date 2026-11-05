// Strobrie / Flow service worker.
//
// Purpose: let the app (especially the Flow till) open and run when the device
// has no network. It does NOT cache API responses — those stay network-only so
// staff never see stale data presented as live. Writes made while offline are
// handled in the app (a local sale queue that syncs on reconnect), not here.
//
// Strategy:
//   - navigations  -> network first, fall back to the cached app shell (so deep
//                     links like /sell still open offline as the SPA).
//   - static assets -> stale-while-revalidate (serve cache fast, refresh in bg).
//   - /api/ and cross-origin -> left to the network untouched.

const CACHE = "flow-cache-v2";
const SHELL = "/index.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.add(SHELL)).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Only our own origin; never touch API calls or third-party requests.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes("/api/")) return;

  // Page navigations: try the network, fall back to the cached shell offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(SHELL, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(SHELL).then((hit) => hit || caches.match(req))),
    );
    return;
  }

  // Everything else same-origin (hashed JS/CSS, fonts, images): serve from
  // cache if we have it, and refresh the copy in the background.
  event.respondWith(
    caches.match(req).then((hit) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => hit);
      return hit || network;
    }),
  );
});
