import { useEffect, useState } from "react";
import { posApi } from "./posApi.js";

const POLL_MS = 60000;

// Polls space-rental inquiries so Flow can badge the ones still needing action
// — i.e. those still at the "new" stage. Moving an inquiry along the pipeline
// (Contacted / Quote sent / …) drops it from the count.
export function useSpaceAlerts(enabled) {
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

  const newCount = requests.filter((r) => (r.status || "new") === "new").length;
  return { newCount };
}
