import { useEffect, useState } from "react";
import { posApi } from "./posApi.js";

const POLL_MS = 60000;

// Badges the Pottery nav with private-session requests still needing follow-up
// (status "new"). Paid bookings are auto-confirmed and shown on the page, so
// they don't badge. Re-polls at once when a request is marked handled.
export function usePotteryAlerts(enabled) {
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    async function poll() {
      try {
        const rows = await posApi.potteryRequests();
        if (!cancelled) setRequests(rows);
      } catch {
        /* network hiccup — try again next tick */
      }
    }
    poll();
    const id = setInterval(poll, POLL_MS);
    const onChanged = () => poll();
    window.addEventListener("pottery-requests-changed", onChanged);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener("pottery-requests-changed", onChanged);
    };
  }, [enabled]);

  const newCount = requests.filter((r) => (r.status || "new") === "new").length;
  return { newCount };
}
