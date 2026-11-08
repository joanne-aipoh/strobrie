import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api.js";

const ACCENT = "#b5713e";
const CREAM = "#fdf6ee";
const INK = "#2e2218";
const SOFT = "#7c6a58";

const TIME_LABELS = { "10:00": "10:00 AM", "12:00": "12:00 PM", "14:00": "2:00 PM" };

function fmt(n) {
  return "₦" + n.toLocaleString("en-NG");
}

export default function PotteryConfirmation() {
  const [params] = useSearchParams();
  const reference = params.get("reference") || params.get("trxref");
  const [state, setState] = useState("checking"); // checking | paid | pending | error
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!reference) {
      setState("error");
      setError("No payment reference found.");
      return;
    }
    api
      .verifyPottery(reference)
      .then((b) => {
        setBooking(b);
        setState(b.paid ? "paid" : "pending");
      })
      .catch((e) => {
        setState("error");
        setError(e.message);
      });
  }, [reference]);

  return (
    <div style={{ background: CREAM, minHeight: "70vh", padding: "48px 16px", textAlign: "center" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", background: "#fff", border: "1px solid #ead9c6", borderRadius: 18, padding: 28 }}>
        {state === "checking" && <p style={{ color: SOFT }}>Confirming your payment…</p>}

        {state === "paid" && booking && (
          <>
            <div style={{ fontSize: 44 }}>🏺</div>
            <h1 style={{ color: INK, fontSize: 26, margin: "8px 0" }}>You're booked!</h1>
            <p style={{ color: SOFT, marginTop: 0 }}>
              {booking.session_type === "private" ? "Private" : "Public"} pottery session
            </p>
            <div style={{ background: CREAM, borderRadius: 12, padding: 16, textAlign: "left", margin: "16px 0", color: INK }}>
              <div><strong>Date:</strong> {new Date(booking.date).toDateString()}</div>
              <div><strong>Time:</strong> {TIME_LABELS[booking.time_slot] || booking.time_slot} (2 hours)</div>
              {booking.session_type === "public" && <div><strong>Seats:</strong> {booking.seats}</div>}
              <div><strong>Paid:</strong> {fmt(booking.amount)}</div>
            </div>
            <p style={{ color: SOFT, fontSize: 14 }}>A confirmation is on its way. See you at Strobriē!</p>
            <Link to="/" style={{ color: ACCENT, fontWeight: 700 }}>Back to home</Link>
          </>
        )}

        {state === "pending" && (
          <>
            <h1 style={{ color: INK, fontSize: 22 }}>Payment not confirmed yet</h1>
            <p style={{ color: SOFT }}>
              If you completed payment, it may take a moment. Refresh this page, or contact us with reference{" "}
              <strong>{reference}</strong>.
            </p>
            <Link to="/pottery" style={{ color: ACCENT, fontWeight: 700 }}>Back to booking</Link>
          </>
        )}

        {state === "error" && (
          <>
            <h1 style={{ color: INK, fontSize: 22 }}>Something went wrong</h1>
            <p style={{ color: "#9c2626" }}>{error}</p>
            <Link to="/pottery" style={{ color: ACCENT, fontWeight: 700 }}>Back to booking</Link>
          </>
        )}
      </div>
    </div>
  );
}
