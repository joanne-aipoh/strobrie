import { useEffect, useState } from "react";
import { posApi } from "./posApi.js";

const POLL_MS = 60000;
const SEEN_KEY = "pottery_seen_booking_id";

// Highest pottery-booking id the staff on this device have already seen (i.e.
// the last time the Pottery page was open). New bookings above it badge the tab.
function seenBookingId() {
  try {
    return Number(localStorage.getItem(SEEN_KEY)) || 0;
  } catch {
    return 0;
  }
}

// Called by the Pottery page when it's viewed: mark every current booking as
// seen so the badge clears, and tell the hook to recompute.
export function markPotteryBookingsSeen(bookings) {
  try {
    const maxId = (bookings || []).reduce((m, b) => Math.max(m, b.id || 0), 0);
    localStorage.setItem(SEEN_KEY, String(maxId));
    window.dispatchEvent(new Event("pottery-bookings-seen"));
  } catch {
    /* storage unavailable — ignore */
  }
}

// Badges the Pottery nav with items still needing a look: private-session
// requests still at status "new", PLUS new paid bookings that have come in
// since the Pottery page was last opened. Re-polls at once when a request is
// handled, and recomputes when bookings are marked seen.
export function usePotteryAlerts(enabled) {
  const [requests, setRequests] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [, bump] = useState(0); // force recompute when "seen" changes

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    async function poll() {
      try {
        const [r, b] = await Promise.all([posApi.potteryRequests(), posApi.potteryBookings()]);
        if (!cancelled) {
          setRequests(r);
          setBookings(b);
        }
      } catch {
        /* network hiccup — try again next tick */
      }
    }
    poll();
    const id = setInterval(poll, POLL_MS);
    const onChanged = () => poll();
    const onSeen = () => bump((n) => n + 1);
    window.addEventListener("pottery-requests-changed", onChanged);
    window.addEventListener("pottery-bookings-seen", onSeen);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener("pottery-requests-changed", onChanged);
      window.removeEventListener("pottery-bookings-seen", onSeen);
    };
  }, [enabled]);

  const seen = seenBookingId();
  const newRequests = requests.filter((r) => (r.status || "new") === "new").length;
  const newBookings = bookings.filter((b) => (b.id || 0) > seen).length;
  return { newCount: newRequests + newBookings, newBookings, newRequests };
}
