import { useEffect, useState } from "react";
import { posApi } from "./posApi.js";

const STORAGE_KEY = "strobrie-pos-last-seen-space-request";
const POLL_MS = 60000;

// Polls space-rental inquiries so Flow can badge new (unseen) ones on the nav.
// "New" = id greater than the last one the manager opened the page on.
export function useSpaceAlerts(enabled) {
  const [lastSeenId, setLastSeenId] = useState(() => {
    try {
      return parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10);
    } catch {
      return 0;
    }
  });
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    async function poll() {
      try {
        const rows = await posApi.spaceRequests();
        if (!cancelled) setRequests(rows);
      } catch {
        /* network hiccup — try again next tick */
      }
    }
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [enabled]);

  const unseenCount = requests.filter((r) => r.id > lastSeenId).length;

  function markSeen() {
    const maxId = requests.reduce((m, r) => Math.max(m, r.id), lastSeenId);
    setLastSeenId(maxId);
    try {
      localStorage.setItem(STORAGE_KEY, String(maxId));
    } catch {
      /* ignore */
    }
  }

  return { unseenCount, markSeen };
}
