import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { usePosAuth } from "../PosAuthContext.jsx";
import { posApi, PAYMENT_METHODS } from "../posApi.js";
import { posPath } from "../posBase.js";

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

  const [editing, setEditing] = useState(false);
  const [editFields, setEditFields] = useState(null);
  const [editError, setEditError] = useState("");
  const [newTier, setNewTier] = useState({ name: "", price: "", qty: "", online_purchasable: true });
  const [tierError, setTierError] = useState("");

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

  async function deleteEvent() {
    if (!window.confirm(`Delete "${event.name}"? This can't be undone.`)) return;
    try {
      await posApi.deleteEvent(eventId);
      navigate(posPath("/events"));
    } catch (err) {
      setEditError(err.message);
    }
  }

  function startEdit() {
    setEditFields({
      name: event.name,
      date: event.date,
      time: event.time || "",
      capacity: event.capacity ?? "",
      description: event.description || "",
      cost_budget: event.cost_budget,
    });
    setEditError("");
    setEditing(true);
  }

  async function saveEdit() {
    if (!editFields.name.trim()) {
      setEditError("Enter an event name.");
      return;
    }
    if (!editFields.date) {
      setEditError("Pick a date.");
      return;
    }
    try {
      await posApi.updateEvent(eventId, {
        name: editFields.name.trim(),
        date: editFields.date,
        time: editFields.time || null,
        capacity: editFields.capacity === "" ? null : parseInt(editFields.capacity),
        description: editFields.description.trim() || null,
        cost_budget: parseFloat(editFields.cost_budget) || 0,
      });
      setEditing(false);
      await load();
    } catch (err) {
      setEditError(err.message);
    }
  }

  async function saveTier(tier, changes) {
    try {
      await posApi.updateTier(eventId, tier.id, changes);
      await load();
    } catch (err) {
      setTierError(err.message);
    }
  }

  async function removeTier(tier) {
    try {
      await posApi.removeTier(eventId, tier.id);
      await load();
    } catch (err) {
      setTierError(err.message);
    }
  }

  async function addTier() {
    if (!newTier.name.trim()) {
      setTierError("Enter a tier name.");
      return;
    }
    try {
      await posApi.addTier(eventId, {
        name: newTier.name.trim(),
        price: parseFloat(newTier.price) || 0,
        qty: parseInt(newTier.qty) || 0,
        online_purchasable: newTier.online_purchasable,
      });
      setNewTier({ name: "", price: "", qty: "", online_purchasable: true });
      setTierError("");
      await load();
    } catch (err) {
      setTierError(err.message);
    }
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
      <button className="link-btn" style={{ marginBottom: 12 }} onClick={() => navigate(posPath("/events"))}>
        &larr; All events
      </button>
      <div className="panel">
        {editing ? (
          <>
            <h3>Edit event</h3>
            <div className="form-grid">
              <div className="form-field">
                <label>Event name</label>
                <input type="text" value={editFields.name} onChange={(e) => setEditFields((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="form-field">
                <label>Date</label>
                <input type="date" value={editFields.date} onChange={(e) => setEditFields((f) => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="form-field">
                <label>Time</label>
                <input type="time" value={editFields.time} onChange={(e) => setEditFields((f) => ({ ...f, time: e.target.value }))} />
              </div>
              <div className="form-field">
                <label>Capacity (optional)</label>
                <input
                  type="number"
                  min="0"
                  value={editFields.capacity}
                  onChange={(e) => setEditFields((f) => ({ ...f, capacity: e.target.value }))}
                />
              </div>
              <div className="form-field full">
                <label>Description</label>
                <textarea
                  rows={2}
                  value={editFields.description}
                  onChange={(e) => setEditFields((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="form-field">
                <label>Cost budget (₦)</label>
                <input
                  type="number"
                  min="0"
                  value={editFields.cost_budget}
                  onChange={(e) => setEditFields((f) => ({ ...f, cost_budget: e.target.value }))}
                />
              </div>
            </div>
            {editError && <div className="error-text" style={{ marginTop: 8 }}>{editError}</div>}
            <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
              <button className="log-btn" onClick={saveEdit}>Save changes</button>
              <button className="link-btn" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </>
        ) : (
          <>
            <h3>
              {event.name}
              {isManager && (
                <button className="link-btn" style={{ marginLeft: 10, fontSize: 12 }} onClick={startEdit}>
                  Edit
                </button>
              )}
              {isManager && tickets.length === 0 && (
                <button className="remove-btn" style={{ marginLeft: 10, fontSize: 12 }} onClick={deleteEvent}>
                  Delete event
                </button>
              )}
            </h3>
            <div className="meta" style={{ color: "var(--ink-soft)", fontSize: 13, marginBottom: 6 }}>
              {event.date}
              {event.time ? ` · ${event.time}` : ""}
              {event.capacity ? ` · Capacity ${event.capacity}` : ""}
            </div>
            {event.description && <div style={{ fontSize: 13.5, marginBottom: 6 }}>{event.description}</div>}
          </>
        )}
      </div>

      {isManager && (
        <div className="panel">
          <h3>Ticket tiers</h3>
          <table className="log-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Price (₦)</th>
                <th>Qty (0=unlimited)</th>
                <th>Sell online</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {event.tiers.map((t) => (
                <tr key={t.id}>
                  <td>
                    <input
                      type="text"
                      defaultValue={t.name}
                      style={{ width: 140 }}
                      onBlur={(e) => e.target.value.trim() && e.target.value !== t.name && saveTier(t, { name: e.target.value.trim() })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      defaultValue={t.price}
                      style={{ width: 100 }}
                      onBlur={(e) => Number(e.target.value) !== t.price && saveTier(t, { price: parseFloat(e.target.value) || 0 })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      defaultValue={t.qty}
                      style={{ width: 100 }}
                      onBlur={(e) => Number(e.target.value) !== t.qty && saveTier(t, { qty: parseInt(e.target.value) || 0 })}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={t.online_purchasable}
                      onChange={(e) => saveTier(t, { online_purchasable: e.target.checked })}
                    />
                  </td>
                  <td>
                    {t.sold === 0 && (
                      <button className="remove-btn" onClick={() => removeTier(t)}>
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="tier-row" style={{ marginTop: 10 }}>
            <input
              type="text"
              placeholder="New tier name"
              value={newTier.name}
              onChange={(e) => setNewTier((t) => ({ ...t, name: e.target.value }))}
            />
            <input
              type="number"
              min="0"
              placeholder="Price (₦)"
              value={newTier.price}
              onChange={(e) => setNewTier((t) => ({ ...t, price: e.target.value }))}
              style={{ maxWidth: 120 }}
            />
            <input
              type="number"
              min="0"
              placeholder="Qty (0=unlimited)"
              value={newTier.qty}
              onChange={(e) => setNewTier((t) => ({ ...t, qty: e.target.value }))}
              style={{ maxWidth: 150 }}
            />
            <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, whiteSpace: "nowrap" }}>
              <input
                type="checkbox"
                checked={newTier.online_purchasable}
                onChange={(e) => setNewTier((t) => ({ ...t, online_purchasable: e.target.checked }))}
              />
              Sell online
            </label>
            <button className="link-btn" onClick={addTier}>+ Add tier</button>
          </div>
          {tierError && <div className="error-text" style={{ marginTop: 8 }}>{tierError}</div>}
        </div>
      )}

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
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>{method}</option>
                ))}
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
                            {PAYMENT_METHODS.map((method) => (
                              <option key={method} value={method}>{method}</option>
                            ))}
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
