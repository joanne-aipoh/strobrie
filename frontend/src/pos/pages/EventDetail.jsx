import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { usePosAuth } from "../PosAuthContext.jsx";
import { posApi } from "../posApi.js";

function fmt(n) {
  return "₦" + Math.round(n).toLocaleString();
}

export default function EventDetail() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { currentStaff, isManager } = usePosAuth();
  const [event, setEvent] = useState(null);
  const [tickets, setTickets] = useState(null);
  const [checkinPay, setCheckinPay] = useState({});

  const [tierId, setTierId] = useState(null);
  const [buyerName, setBuyerName] = useState("");
  const [buyerContact, setBuyerContact] = useState("");
  const [channel, setChannel] = useState("paid");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [error, setError] = useState("");

  async function load() {
    const [ev, tix] = await Promise.all([posApi.getEvent(eventId), posApi.listTickets(eventId)]);
    setEvent(ev);
    setTickets(tix);
    if (ev.tiers.length > 0 && tierId === null) setTierId(ev.tiers[0].id);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function sellTicket() {
    if (!tierId) {
      setError("Choose a ticket tier.");
      return;
    }
    if (!buyerName.trim()) {
      setError("Enter the buyer name.");
      return;
    }
    try {
      await posApi.sellTicket(eventId, {
        staff_id: currentStaff.id,
        tier_id: tierId,
        buyer_name: buyerName.trim(),
        buyer_contact: buyerContact.trim() || null,
        channel,
        payment_method: paymentMethod,
      });
      setBuyerName("");
      setBuyerContact("");
      setError("");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function checkin(ticketId) {
    await posApi.checkinTicket(ticketId);
    await load();
  }

  async function collectAndCheckin(ticketId) {
    const method = checkinPay[ticketId] || "Cash";
    await posApi.collectAndCheckin(ticketId, currentStaff.id, method);
    await load();
  }

  if (!event || !tickets) return <p>Loading&hellip;</p>;

  const checkedInCount = tickets.filter((t) => t.checked_in).length;
  const revenue = tickets.filter((t) => t.paid).reduce((s, t) => {
    const tier = event.tiers.find((tr) => tr.id === t.tier_id);
    return s + (tier?.price || 0);
  }, 0);
  const profit = revenue - event.cost_budget;

  return (
    <>
      <button className="link-btn" style={{ marginBottom: 12 }} onClick={() => navigate("/pos/events")}>
        &larr; All events
      </button>
      <div className="panel">
        <h3>{event.name}</h3>
        <div className="meta" style={{ color: "var(--ink-soft)", fontSize: 13, marginBottom: 6 }}>
          {event.date}
          {event.time ? ` · ${event.time}` : ""}
          {event.capacity ? ` · Capacity ${event.capacity}` : ""}
        </div>
        {event.description && <div style={{ fontSize: 13.5, marginBottom: 6 }}>{event.description}</div>}
      </div>

      {isManager && (
        <div className="metric-grid">
          <div className="metric-card">
            <div className="label">Ticket revenue</div>
            <div className="value">{fmt(revenue)}</div>
          </div>
          <div className="metric-card">
            <div className="label">Cost budget</div>
            <div className="value">{fmt(event.cost_budget)}</div>
          </div>
          <div className="metric-card">
            <div className="label">{profit >= 0 ? "Profit" : "Shortfall"}</div>
            <div className="value">{fmt(Math.abs(profit))}</div>
          </div>
          <div className="metric-card">
            <div className="label">Checked in</div>
            <div className="value">
              {checkedInCount}/{tickets.length}
            </div>
          </div>
        </div>
      )}

      <div className="panel">
        <h3>Sell a ticket</h3>
        <div className="form-grid">
          <div className="form-field">
            <label>Tier</label>
            <select value={tierId ?? ""} onChange={(e) => setTierId(Number(e.target.value))}>
              {event.tiers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} — {fmt(t.price)}
                  {t.remaining !== null ? ` (${t.remaining} left)` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Buyer name</label>
            <input type="text" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="Guest name" />
          </div>
          <div className="form-field">
            <label>Buyer phone (optional)</label>
            <input type="text" value={buyerContact} onChange={(e) => setBuyerContact(e.target.value)} placeholder="For reminders" />
          </div>
          <div className="form-field">
            <label>Channel</label>
            <select value={channel} onChange={(e) => setChannel(e.target.value)}>
              <option value="paid">Pay now</option>
              <option value="reserved">Reserve — pay at door</option>
            </select>
          </div>
          {channel === "paid" ? (
            <div className="form-field">
              <label>Payment method</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                <option value="Cash">Cash</option>
                <option value="Card">Card (terminal)</option>
              </select>
            </div>
          ) : (
            <div />
          )}
        </div>
        {error && <div className="error-text">{error}</div>}
        <button className="log-btn" onClick={sellTicket}>
          Sell ticket
        </button>
      </div>

      <div className="panel">
        <h3>Guest list ({tickets.length})</h3>
        {tickets.length === 0 ? (
          <div className="empty-note">No tickets sold yet.</div>
        ) : (
          <table className="log-table">
            <thead>
              <tr>
                <th>Guest</th>
                <th>Tier</th>
                <th>Paid</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => {
                const tier = event.tiers.find((tr) => tr.id === t.tier_id);
                return (
                  <tr key={t.id}>
                    <td>{t.buyer_name}</td>
                    <td>{tier?.name}</td>
                    <td>{t.paid ? fmt(tier?.price || 0) : <span className="checkin-badge out">Pay at door</span>}</td>
                    <td>{t.checked_in ? "" : t.paid ? <span className="checkin-badge out">Not checked in</span> : ""}</td>
                    <td>
                      {t.checked_in ? (
                        <span className="checkin-badge in">Checked in</span>
                      ) : t.paid ? (
                        <button className="log-btn" style={{ margin: 0, padding: "6px 10px", fontSize: 12 }} onClick={() => checkin(t.id)}>
                          Check in
                        </button>
                      ) : (
                        <>
                          <select
                            value={checkinPay[t.id] || "Cash"}
                            onChange={(e) => setCheckinPay((prev) => ({ ...prev, [t.id]: e.target.value }))}
                            style={{ fontSize: 12, padding: 4, marginRight: 6 }}
                          >
                            <option value="Cash">Cash</option>
                            <option value="Card">Card</option>
                          </select>
                          <button
                            className="log-btn"
                            style={{ margin: 0, padding: "6px 10px", fontSize: 12 }}
                            onClick={() => collectAndCheckin(t.id)}
                          >
                            Collect & check in
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
