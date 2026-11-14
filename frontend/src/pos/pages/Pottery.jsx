import { useEffect, useState } from "react";
import { posApi } from "../posApi.js";

function fmt(n) {
  return "₦" + Math.round(n).toLocaleString();
}

function slotStatus(s) {
  if (s.blocked) return { text: "Disabled", bg: "#f7dede", color: "#9c2626" };
  if (s.private_booked) return { text: "Private booked", bg: "#e7defb", color: "#5a37a8" };
  if (s.public_seats > 0) return { text: `${s.public_seats}/6 booked`, bg: "#dfeaf7", color: "#1d4f8c" };
  return { text: "Open", bg: "#eaf1e5", color: "#3b5b31" };
}

const TIME_LABELS = { "10:00": "10:00 AM", "12:00": "12:00 PM", "14:00": "2:00 PM" };

function dateLabel(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" });
}

export default function PotteryAdmin() {
  const [slots, setSlots] = useState(null);
  const [bookings, setBookings] = useState(null);
  const [requests, setRequests] = useState(null);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(null); // "b<id>" | "r<id>"
  const [rescheduling, setRescheduling] = useState(null); // booking id being moved
  const [rsForm, setRsForm] = useState({ date: "", time: "" });

  function load() {
    return Promise.all([posApi.potteryOverview(), posApi.potteryBookings(), posApi.potteryRequests()])
      .then(([o, bk, r]) => {
        setSlots(o);
        setBookings(bk);
        setRequests(r);
      })
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleBlock(s) {
    try {
      await posApi.potterySetBlock({ date: s.date, time_slot: s.time, blocked: !s.blocked });
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  // Disable (or re-enable) all of a day's slots in one tap.
  async function toggleDay(g) {
    const target = !g.slots.every((s) => s.blocked); // all blocked → enable; else disable
    try {
      await Promise.all(
        g.slots.map((s) => posApi.potterySetBlock({ date: s.date, time_slot: s.time, blocked: target })),
      );
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleRequest(id) {
    try {
      await posApi.potteryHandleRequest(id);
      await load();
      window.dispatchEvent(new Event("pottery-requests-changed"));
    } catch (e) {
      setError(e.message);
    }
  }

  function startReschedule(b, s) {
    setConfirming(null);
    // A booking for today isn't in the upcoming-dates list, so default the
    // picker to the first available future date rather than an unlisted value.
    const inUpcoming = slots.some((x) => x.date === s.date);
    setRsForm({ date: inUpcoming ? s.date : slots[0]?.date || s.date, time: s.time });
    setRescheduling(b.id);
  }

  async function saveReschedule(id) {
    try {
      await posApi.reschedulePotteryBooking(id, { date: rsForm.date, time_slot: rsForm.time });
      setRescheduling(null);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function delBooking(id) {
    try {
      await posApi.deletePotteryBooking(id);
      await load();
      setConfirming(null);
    } catch (e) {
      setError(e.message);
    }
  }

  async function delRequest(id) {
    try {
      await posApi.deletePotteryRequest(id);
      await load();
      setConfirming(null);
      window.dispatchEvent(new Event("pottery-requests-changed"));
    } catch (e) {
      setError(e.message);
    }
  }

  if (!slots || !bookings || !requests) return <p>Loading&hellip;</p>;

  // Group slots by date, preserving order.
  const byDate = [];
  slots.forEach((s) => {
    let g = byDate.find((x) => x.date === s.date);
    if (!g) {
      g = { date: s.date, label: s.label, slots: [] };
      byDate.push(g);
    }
    g.slots.push(s);
  });

  // Options for the reschedule pickers — every valid upcoming pottery date,
  // and the three fixed time slots (with their labels).
  const dateOpts = byDate.map((g) => ({ date: g.date, label: g.label }));
  const timeOpts = [];
  slots.forEach((s) => {
    if (!timeOpts.find((t) => t.time === s.time)) timeOpts.push({ time: s.time, label: s.time_label });
  });

  const openRequests = requests.filter((r) => r.status === "new");

  // Group paid bookings from today onward by date + slot (soonest first).
  // Built from the full bookings list — not the upcoming-slots overview — so a
  // booking for today still shows up to reschedule; past sessions drop off.
  const todayStr = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local
  const bookingGroups = [];
  [...bookings]
    .filter((b) => b.date >= todayStr)
    .sort((a, b) => `${a.date}${a.time_slot}`.localeCompare(`${b.date}${b.time_slot}`))
    .forEach((b) => {
      const key = `${b.date}-${b.time_slot}`;
      let g = bookingGroups.find((x) => x.key === key);
      if (!g) {
        g = {
          key,
          date: b.date,
          time: b.time_slot,
          label: dateLabel(b.date),
          time_label: TIME_LABELS[b.time_slot] || b.time_slot,
          bookings: [],
        };
        bookingGroups.push(g);
      }
      g.bookings.push(b);
    });
  const totalBooked = bookingGroups.reduce((n, g) => n + g.bookings.length, 0);

  return (
    <>
      {error && <div className="error-text" style={{ marginBottom: 10 }}>{error}</div>}

      <div className="panel">
        <h3>Pottery bookings ({totalBooked})</h3>
        {bookingGroups.length === 0 ? (
          <div className="empty-note">No bookings yet.</div>
        ) : (
          bookingGroups.map((s) => (
            <div key={s.key} style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
              <strong>{s.label} · {s.time_label}</strong>
              {s.bookings.map((b) => (
                <div key={b.id} style={{ marginTop: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>
                      {b.customer_name} — {b.session_type === "private" ? "private" : `${b.seats} ${b.seats === 1 ? "person" : "people"}`}
                      {b.customer_phone ? ` · ${b.customer_phone}` : ""}
                    </span>
                    {confirming === `b${b.id}` ? (
                      <span style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>
                        Delete?{" "}
                        <button className="link-btn" style={{ color: "var(--danger)", fontWeight: 700 }} onClick={() => delBooking(b.id)}>Yes</button>
                        {"  "}
                        <button className="link-btn" onClick={() => setConfirming(null)}>No</button>
                      </span>
                    ) : rescheduling === b.id ? null : (
                      <span style={{ display: "flex", gap: 12, whiteSpace: "nowrap" }}>
                        <button className="link-btn" onClick={() => startReschedule(b, s)}>Reschedule</button>
                        <button className="link-btn" style={{ color: "var(--ink-soft)" }} onClick={() => setConfirming(`b${b.id}`)}>Delete</button>
                      </span>
                    )}
                  </div>
                  {rescheduling === b.id && (
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}>
                      <span style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>Move to:</span>
                      <select
                        value={rsForm.date}
                        onChange={(e) => setRsForm((f) => ({ ...f, date: e.target.value }))}
                        style={{ padding: "4px 8px", borderRadius: 8, fontSize: 13 }}
                      >
                        {dateOpts.map((d) => (
                          <option key={d.date} value={d.date}>{d.label}</option>
                        ))}
                      </select>
                      <select
                        value={rsForm.time}
                        onChange={(e) => setRsForm((f) => ({ ...f, time: e.target.value }))}
                        style={{ padding: "4px 8px", borderRadius: 8, fontSize: 13 }}
                      >
                        {timeOpts.map((t) => (
                          <option key={t.time} value={t.time}>{t.label}</option>
                        ))}
                      </select>
                      <button className="link-btn" style={{ fontWeight: 700 }} onClick={() => saveReschedule(b.id)}>Save</button>
                      <button className="link-btn" style={{ color: "var(--ink-soft)" }} onClick={() => setRescheduling(null)}>Cancel</button>
                      <span style={{ fontSize: 11.5, color: "var(--ink-soft)", flexBasis: "100%" }}>
                        The customer is emailed the new time when you save.
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      <div className="panel">
        <h3>Private session requests {openRequests.length > 0 && `(${openRequests.length} new)`}</h3>
        {requests.length === 0 ? (
          <div className="empty-note">No requests yet.</div>
        ) : (
          requests.map((r) => (
            <div
              key={r.id}
              style={{ padding: "10px 0", borderBottom: "1px solid var(--line)", opacity: r.status === "handled" ? 0.55 : 1 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <strong>{r.customer_name}</strong> · {r.customer_phone} · {r.customer_email}
                  <div style={{ fontSize: 13, color: "var(--rust-dark)", marginTop: 2 }}>Wants: {r.preferred}</div>
                  {r.message && <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 2 }}>“{r.message}”</div>}
                </div>
                <span style={{ display: "flex", gap: 10, alignItems: "center", whiteSpace: "nowrap" }}>
                  {r.status === "new" ? (
                    <button className="link-btn" onClick={() => handleRequest(r.id)}>
                      Mark handled
                    </button>
                  ) : (
                    <span className="reason-tag">Handled</span>
                  )}
                  {confirming === `r${r.id}` ? (
                    <span style={{ fontSize: 12.5 }}>
                      Delete?{" "}
                      <button className="link-btn" style={{ color: "var(--danger)", fontWeight: 700 }} onClick={() => delRequest(r.id)}>Yes</button>
                      {"  "}
                      <button className="link-btn" onClick={() => setConfirming(null)}>No</button>
                    </span>
                  ) : (
                    <button className="link-btn" style={{ color: "var(--ink-soft)" }} onClick={() => setConfirming(`r${r.id}`)}>Delete</button>
                  )}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="panel">
        <h3>Pottery — upcoming slots</h3>
        <p style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: -6 }}>
          Disable a slot to hide it from the website (e.g. when the space has an event). Public holds 6; a private booking takes the whole slot.
        </p>
        {byDate.length === 0 ? (
          <div className="empty-note">No upcoming slots.</div>
        ) : (
          byDate.map((g) => (
            <div key={g.date} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{g.label}</div>
                <button
                  className="link-btn"
                  style={g.slots.every((s) => s.blocked) ? undefined : { color: "var(--rust-dark)" }}
                  onClick={() => toggleDay(g)}
                >
                  {g.slots.every((s) => s.blocked) ? "Enable whole day" : "Disable whole day"}
                </button>
              </div>
              {g.slots.map((s) => {
                const st = slotStatus(s);
                return (
                  <div
                    key={s.time}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      flexWrap: "wrap",
                      padding: "8px 0",
                      borderBottom: "1px solid var(--line)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <strong style={{ minWidth: 72 }}>{s.time_label}</strong>
                      <span style={{ fontSize: 11.5, padding: "2px 9px", borderRadius: 999, background: st.bg, color: st.color, fontWeight: 600 }}>
                        {st.text}
                      </span>
                      {s.bookings.length > 0 && (
                        <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>
                          {s.bookings.map((b) => `${b.customer_name} (${b.session_type === "private" ? "private" : b.seats + "p"})`).join(", ")}
                        </span>
                      )}
                    </div>
                    <button className="link-btn" onClick={() => toggleBlock(s)} style={s.blocked ? undefined : { color: "var(--rust-dark)" }}>
                      {s.blocked ? "Enable" : "Disable"}
                    </button>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </>
  );
}
