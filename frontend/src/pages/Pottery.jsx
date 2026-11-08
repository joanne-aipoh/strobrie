import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";

const ACCENT = "#b5713e";
const ACCENT_DARK = "#8a5428";
const CREAM = "#fdf6ee";
const INK = "#2e2218";
const SOFT = "#7c6a58";
const LINE = "#ead9c6";

const PRICE = 15000; // public, per person

function fmt(n) {
  return "₦" + n.toLocaleString("en-NG");
}
function iso(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
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

// --- Calendar --------------------------------------------------------------
function Calendar({ availableSet, selected, onSelect, minMonth, maxMonth }) {
  const [view, setView] = useState(() => {
    if (selected) {
      const [y, m] = selected.split("-").map(Number);
      return { y, m: m - 1 };
    }
    return minMonth;
  });

  const monthStart = new Date(view.y, view.m, 1);
  const startWeekday = monthStart.getDay(); // 0=Sun
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const atMin = view.y === minMonth.y && view.m === minMonth.m;
  const atMax = view.y === maxMonth.y && view.m === maxMonth.m;
  const step = (delta) => setView((v) => {
    const nd = new Date(v.y, v.m + delta, 1);
    return { y: nd.getFullYear(), m: nd.getMonth() };
  });

  const monthName = monthStart.toLocaleString("en-US", { month: "long", year: "numeric" });

  return (
    <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: 12, background: CREAM, marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <button type="button" onClick={() => step(-1)} disabled={atMin}
          style={{ border: "none", background: "none", fontSize: 20, color: atMin ? "#cbb79f" : ACCENT, cursor: atMin ? "default" : "pointer", padding: "0 8px" }}>‹</button>
        <div style={{ fontWeight: 700, color: INK, fontSize: 15 }}>{monthName}</div>
        <button type="button" onClick={() => step(1)} disabled={atMax}
          style={{ border: "none", background: "none", fontSize: 20, color: atMax ? "#cbb79f" : ACCENT, cursor: atMax ? "default" : "pointer", padding: "0 8px" }}>›</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((w) => (
          <div key={w} style={{ textAlign: "center", fontSize: 11, color: SOFT, fontWeight: 600, padding: "2px 0" }}>{w}</div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={`b${i}`} />;
          const ds = iso(view.y, view.m, d);
          const available = availableSet.has(ds);
          const on = selected === ds;
          return (
            <button
              key={ds}
              type="button"
              disabled={!available}
              onClick={() => onSelect(ds)}
              style={{
                aspectRatio: "1 / 1",
                borderRadius: 9,
                border: on ? `1.5px solid ${ACCENT}` : "1px solid transparent",
                background: on ? ACCENT : available ? "#fff" : "transparent",
                color: on ? "#fff" : available ? INK : "#c9bba9",
                fontWeight: available ? 700 : 400,
                fontSize: 14,
                cursor: available ? "pointer" : "default",
                boxShadow: available && !on ? `0 0 0 1px ${LINE} inset` : "none",
              }}
              title={available ? "Available" : ""}
            >
              {d}
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 11.5, color: SOFT, marginTop: 8, textAlign: "center" }}>
        Highlighted dates have open slots (Tue · Fri · Sat)
      </div>
    </div>
  );
}

export default function Pottery() {
  const [days, setDays] = useState(null);
  const [loadErr, setLoadErr] = useState("");

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
    api.getPotteryAvailability().then(setDays).catch((e) => setLoadErr(e.message));
  }, []);

  // Public-only: days/slots with a public opening.
  const availableDays = useMemo(
    () => (days || []).filter((d) => d.slots.some((s) => s.public_available)),
    [days],
  );
  const availableSet = useMemo(() => new Set(availableDays.map((d) => d.date)), [availableDays]);

  const { minMonth, maxMonth } = useMemo(() => {
    const now = new Date();
    let min = { y: now.getFullYear(), m: now.getMonth() };
    let max = min;
    if (availableDays.length) {
      const first = availableDays[0].date.split("-").map(Number);
      const last = availableDays[availableDays.length - 1].date.split("-").map(Number);
      min = { y: first[0], m: first[1] - 1 };
      max = { y: last[0], m: last[1] - 1 };
    }
    return { minMonth: min, maxMonth: max };
  }, [availableDays]);

  const selectedDay = availableDays.find((d) => d.date === dateStr) || null;
  const selectedSlot = selectedDay?.slots.find((s) => s.time === time) || null;
  const maxSeats = selectedSlot ? selectedSlot.public_remaining : 6;
  const total = PRICE * seats;
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
        session_type: "public",
        seats: Math.min(seats, maxSeats),
        customer_name: name.trim(),
        customer_email: email.trim(),
        customer_phone: phone.trim(),
        callback_url: `${window.location.origin}/pottery/confirmation`,
      });
      window.location.href = res.authorization_url;
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
            Tuesdays, Fridays &amp; Saturdays · 2-hour slots · ₦15,000 per person · limited seats
          </p>
        </div>

        {loadErr && <div style={{ ...card, color: "#9c2626" }}>Couldn't load slots right now ({loadErr}).</div>}

        {days && (
          <div style={card}>
            <label style={label}>Pick a date</label>
            {availableDays.length === 0 ? (
              <div style={{ fontSize: 14, color: SOFT, marginBottom: 18 }}>
                No open slots in the next few weeks — request a private time below and we'll sort you out.
              </div>
            ) : (
              <Calendar
                availableSet={availableSet}
                selected={dateStr}
                onSelect={(ds) => {
                  setDateStr(ds);
                  setTime("");
                }}
                minMonth={minMonth}
                maxMonth={maxMonth}
              />
            )}

            {selectedDay && (
              <>
                <label style={label}>Time (2 hours)</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
                  {selectedDay.slots.map((s) => {
                    const ok = s.public_available;
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
                        {ok ? (
                          <div style={{ fontSize: 11, fontWeight: 500, opacity: 0.85 }}>{s.public_remaining} left</div>
                        ) : (
                          <div style={{ fontSize: 11, fontWeight: 500 }}>Full</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {selectedSlot && (
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

        {/* Private / different time */}
        <div style={{ ...card, marginTop: 16 }}>
          {!showRequest ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 700, color: INK }}>Want a private session or a different time?</div>
                <div style={{ fontSize: 13.5, color: SOFT }}>Private sessions are ₦20,000 — tell us your preferred time and we'll work with your schedule.</div>
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
