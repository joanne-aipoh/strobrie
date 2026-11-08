import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";

const ACCENT = "#b5713e";
const ACCENT_DARK = "#8a5428";
const CREAM = "#fdf6ee";
const INK = "#2e2218";
const SOFT = "#7c6a58";
const LINE = "#ead9c6";

const PRICES = { public: 15000, private: 20000 };

function fmt(n) {
  return "₦" + n.toLocaleString("en-NG");
}

const card = {
  background: "#fff",
  border: `1px solid ${LINE}`,
  borderRadius: 18,
  padding: 22,
  boxShadow: "0 2px 16px rgba(46,34,24,0.06)",
};
const label = { display: "block", fontSize: 13, fontWeight: 600, color: SOFT, marginBottom: 6 };
const field = {
  width: "100%",
  border: `1px solid ${LINE}`,
  borderRadius: 10,
  padding: "11px 12px",
  fontSize: 15,
  background: CREAM,
  color: INK,
};

export default function Pottery() {
  const [days, setDays] = useState(null);
  const [loadErr, setLoadErr] = useState("");

  const [sessionType, setSessionType] = useState("public");
  const [dateStr, setDateStr] = useState("");
  const [time, setTime] = useState("");
  const [seats, setSeats] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [showRequest, setShowRequest] = useState(false);

  useEffect(() => {
    api
      .getPotteryAvailability()
      .then(setDays)
      .catch((e) => setLoadErr(e.message));
  }, []);

  // Days that have at least one slot open for the chosen session type.
  const availableDays = useMemo(() => {
    if (!days) return [];
    const key = sessionType === "private" ? "private_available" : "public_available";
    return days.filter((d) => d.slots.some((s) => s[key]));
  }, [days, sessionType]);

  const selectedDay = availableDays.find((d) => d.date === dateStr) || null;
  const key = sessionType === "private" ? "private_available" : "public_available";
  const availableTimes = selectedDay ? selectedDay.slots.filter((s) => s[key]) : [];
  const selectedSlot = selectedDay?.slots.find((s) => s.time === time) || null;
  const maxSeats = selectedSlot ? selectedSlot.public_remaining : 6;

  // Keep selections valid as the session type / day changes.
  useEffect(() => {
    if (dateStr && !availableDays.some((d) => d.date === dateStr)) {
      setDateStr("");
      setTime("");
    }
  }, [availableDays, dateStr]);
  useEffect(() => {
    if (time && !availableTimes.some((s) => s.time === time)) setTime("");
  }, [availableTimes, time]);

  const total = sessionType === "private" ? PRICES.private : PRICES.public * seats;
  const canBook = dateStr && time && name.trim() && email.trim() && phone.trim();

  async function book() {
    if (!canBook) {
      setError("Fill in the slot and your details.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await api.bookPottery({
        date: dateStr,
        time_slot: time,
        session_type: sessionType,
        seats: sessionType === "public" ? Math.min(seats, maxSeats) : 1,
        customer_name: name.trim(),
        customer_email: email.trim(),
        customer_phone: phone.trim(),
        callback_url: `${window.location.origin}/pottery/confirmation`,
      });
      window.location.href = res.authorization_url; // off to Paystack
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <div style={{ background: CREAM, minHeight: "70vh", padding: "32px 16px 56px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 13, letterSpacing: 1, color: ACCENT, fontWeight: 700, textTransform: "uppercase" }}>
            Strobriē Café
          </div>
          <h1 style={{ fontSize: 34, margin: "6px 0 8px", color: INK }}>Book a Pottery Session</h1>
          <p style={{ color: SOFT, fontSize: 15, margin: 0 }}>
            Tuesdays, Fridays &amp; Saturdays · 2-hour slots · limited seats
          </p>
        </div>

        {loadErr && <div style={{ ...card, color: "#9c2626" }}>Couldn't load slots right now ({loadErr}).</div>}

        {days && (
          <div style={card}>
            {/* Session type */}
            <label style={label}>Session</label>
            <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
              {[
                { k: "public", t: "Public session", p: PRICES.public, d: "Shared table, up to 6" },
                { k: "private", t: "Private session", p: PRICES.private, d: "The slot is all yours" },
              ].map((o) => {
                const on = sessionType === o.k;
                return (
                  <button
                    key={o.k}
                    onClick={() => setSessionType(o.k)}
                    style={{
                      flex: 1,
                      textAlign: "left",
                      border: `1.5px solid ${on ? ACCENT : LINE}`,
                      background: on ? "#fbeede" : "#fff",
                      borderRadius: 12,
                      padding: "12px 13px",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontWeight: 700, color: INK, fontSize: 15 }}>{o.t}</div>
                    <div style={{ color: ACCENT_DARK, fontWeight: 700, fontSize: 15, margin: "2px 0" }}>{fmt(o.p)}</div>
                    <div style={{ fontSize: 12, color: SOFT }}>{o.d}</div>
                  </button>
                );
              })}
            </div>

            {/* Date */}
            <label style={label}>Date</label>
            {availableDays.length === 0 ? (
              <div style={{ fontSize: 14, color: SOFT, marginBottom: 18 }}>
                No {sessionType} slots open in the next few weeks. Try the other session type, or request a time below.
              </div>
            ) : (
              <select
                value={dateStr}
                onChange={(e) => {
                  setDateStr(e.target.value);
                  setTime("");
                }}
                style={{ ...field, marginBottom: 18 }}
              >
                <option value="">Choose a date…</option>
                {availableDays.map((d) => (
                  <option key={d.date} value={d.date}>
                    {d.label}
                  </option>
                ))}
              </select>
            )}

            {/* Time */}
            {selectedDay && (
              <>
                <label style={label}>Time (2 hours)</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
                  {selectedDay.slots.map((s) => {
                    const ok = s[key];
                    const on = time === s.time;
                    return (
                      <button
                        key={s.time}
                        disabled={!ok}
                        onClick={() => setTime(s.time)}
                        style={{
                          flex: "1 1 30%",
                          border: `1.5px solid ${on ? ACCENT : LINE}`,
                          background: on ? ACCENT : ok ? "#fff" : "#f3ece3",
                          color: on ? "#fff" : ok ? INK : "#b3a695",
                          borderRadius: 10,
                          padding: "10px 6px",
                          cursor: ok ? "pointer" : "not-allowed",
                          fontWeight: 600,
                          fontSize: 14,
                        }}
                      >
                        {s.label}
                        {sessionType === "public" && ok && (
                          <div style={{ fontSize: 11, fontWeight: 500, opacity: 0.85 }}>{s.public_remaining} left</div>
                        )}
                        {!ok && <div style={{ fontSize: 11, fontWeight: 500 }}>Full</div>}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* Seats (public only) */}
            {sessionType === "public" && selectedSlot && (
              <div style={{ marginBottom: 18 }}>
                <label style={label}>People</label>
                <select value={seats} onChange={(e) => setSeats(Number(e.target.value))} style={field}>
                  {Array.from({ length: Math.max(1, maxSeats) }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? "person" : "people"}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Details */}
            <label style={label}>Your name</label>
            <input style={{ ...field, marginBottom: 12 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
            <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 200px" }}>
                <label style={label}>Email</label>
                <input style={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
              </div>
              <div style={{ flex: "1 1 160px" }}>
                <label style={label}>Phone</label>
                <input style={field} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0801…" />
              </div>
            </div>

            {error && <div style={{ color: "#9c2626", fontSize: 13, marginBottom: 10 }}>{error}</div>}

            <button
              onClick={book}
              disabled={busy || !canBook}
              style={{
                width: "100%",
                border: "none",
                borderRadius: 12,
                padding: 15,
                fontSize: 16,
                fontWeight: 700,
                color: "#fff",
                background: busy || !canBook ? "#d8c3ac" : ACCENT,
                cursor: busy || !canBook ? "not-allowed" : "pointer",
              }}
            >
              {busy ? "Taking you to payment…" : `Book & Pay ${fmt(total)}`}
            </button>
          </div>
        )}

        {/* Need a different time */}
        <div style={{ ...card, marginTop: 16 }}>
          {!showRequest ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 700, color: INK }}>Need a different time?</div>
                <div style={{ fontSize: 13.5, color: SOFT }}>Book a private session and we'll work with your schedule.</div>
              </div>
              <button
                onClick={() => setShowRequest(true)}
                style={{ border: `1.5px solid ${ACCENT}`, background: "#fff", color: ACCENT_DARK, borderRadius: 10, padding: "9px 14px", fontWeight: 700, cursor: "pointer" }}
              >
                Request a time
              </button>
            </div>
          ) : (
            <PrivateRequestForm onClose={() => setShowRequest(false)} />
          )}
        </div>
      </div>
    </div>
  );
}

function PrivateRequestForm({ onClose }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [preferred, setPreferred] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit() {
    if (!name.trim() || !email.trim() || !phone.trim() || !preferred.trim()) {
      setError("Please fill in your details and a preferred time.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.requestPrivatePottery({
        customer_name: name.trim(),
        customer_email: email.trim(),
        customer_phone: phone.trim(),
        preferred: preferred.trim(),
        message: message.trim() || null,
      });
      setDone(true);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  if (done)
    return (
      <div>
        <div style={{ fontWeight: 700, color: INK, marginBottom: 4 }}>Request sent 🎉</div>
        <div style={{ fontSize: 14, color: SOFT }}>We'll reach out to arrange your private session. Thank you!</div>
      </div>
    );

  return (
    <div>
      <div style={{ fontWeight: 700, color: INK, marginBottom: 10 }}>Request a private session time</div>
      <input style={{ ...field, marginBottom: 10 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
      <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <input style={{ ...field, flex: "1 1 200px" }} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        <input style={{ ...field, flex: "1 1 150px" }} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" />
      </div>
      <input style={{ ...field, marginBottom: 10 }} value={preferred} onChange={(e) => setPreferred(e.target.value)} placeholder="Preferred day & time (e.g. Sun 16 Nov, afternoon)" />
      <textarea style={{ ...field, marginBottom: 10 }} rows={2} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Anything else? (group size, occasion…)" />
      {error && <div style={{ color: "#9c2626", fontSize: 13, marginBottom: 10 }}>{error}</div>}
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={submit} disabled={busy} style={{ border: "none", borderRadius: 10, padding: "11px 18px", fontWeight: 700, color: "#fff", background: busy ? "#d8c3ac" : ACCENT, cursor: "pointer" }}>
          {busy ? "Sending…" : "Send request"}
        </button>
        <button onClick={onClose} style={{ border: "none", background: "none", color: SOFT, cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
