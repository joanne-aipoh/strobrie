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

export default function PotteryAdmin() {
  const [slots, setSlots] = useState(null);
  const [requests, setRequests] = useState(null);
  const [error, setError] = useState("");

  function load() {
    return Promise.all([posApi.potteryOverview(), posApi.potteryRequests()])
      .then(([o, r]) => {
        setSlots(o);
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

  async function handleRequest(id) {
    try {
      await posApi.potteryHandleRequest(id);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  if (!slots || !requests) return <p>Loading&hellip;</p>;

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

  const openRequests = requests.filter((r) => r.status === "new");
  const bookedSlots = slots.filter((s) => s.bookings.length > 0);
  const totalBooked = bookedSlots.reduce((n, s) => n + s.bookings.length, 0);

  return (
    <>
      {error && <div className="error-text" style={{ marginBottom: 10 }}>{error}</div>}

      <div className="panel">
        <h3>Pottery bookings ({totalBooked})</h3>
        {bookedSlots.length === 0 ? (
          <div className="empty-note">No bookings yet.</div>
        ) : (
          bookedSlots.map((s) => (
            <div key={`${s.date}-${s.time}`} style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
              <strong>{s.label} · {s.time_label}</strong>
              <div style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 2 }}>
                {s.bookings
                  .map(
                    (b) =>
                      `${b.customer_name} — ${b.session_type === "private" ? "private" : b.seats + (b.seats === 1 ? " person" : " people")}` +
                      (b.customer_phone ? ` · ${b.customer_phone}` : ""),
                  )
                  .join("   ·   ")}
              </div>
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
                {r.status === "new" ? (
                  <button className="link-btn" onClick={() => handleRequest(r.id)}>
                    Mark handled
                  </button>
                ) : (
                  <span className="reason-tag">Handled</span>
                )}
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
              <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 6 }}>{g.label}</div>
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
