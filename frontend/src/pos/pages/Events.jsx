import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePosAuth } from "../PosAuthContext.jsx";
import { posApi } from "../posApi.js";
import { posPath } from "../posBase.js";

function fmt(n) {
  return "₦" + Math.round(n).toLocaleString();
}

export default function Events() {
  const { currentStaff, isManager } = usePosAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [capacity, setCapacity] = useState("");
  const [description, setDescription] = useState("");
  const [costBudget, setCostBudget] = useState("");
  const [tiers, setTiers] = useState([{ name: "General", price: "", qty: "", online_purchasable: true }]);
  const [error, setError] = useState("");

  useEffect(() => {
    posApi.listEvents().then(setEvents);
  }, []);

  function addTierRow() {
    setTiers((prev) => [...prev, { name: "", price: "", qty: "", online_purchasable: true }]);
  }
  function removeTierRow(idx) {
    setTiers((prev) => prev.filter((_, i) => i !== idx));
  }
  function updateTier(idx, field, value) {
    setTiers((prev) => prev.map((t, i) => (i === idx ? { ...t, [field]: value } : t)));
  }

  async function createEvent() {
    if (!name.trim()) {
      setError("Enter an event name.");
      return;
    }
    if (!date) {
      setError("Pick a date.");
      return;
    }
    const cleanTiers = tiers
      .filter((t) => t.name.trim())
      .map((t) => ({
        name: t.name.trim(),
        price: parseFloat(t.price) || 0,
        qty: parseInt(t.qty) || 0,
        online_purchasable: t.online_purchasable,
      }));
    if (cleanTiers.length === 0) {
      setError("Add at least one ticket tier with a name.");
      return;
    }
    try {
      const event = await posApi.createEvent({
        staff_id: currentStaff.id,
        name: name.trim(),
        date,
        time: time || null,
        capacity: capacity ? parseInt(capacity) : null,
        description: description.trim() || null,
        cost_budget: parseFloat(costBudget) || 0,
        tiers: cleanTiers,
      });
      setEvents((prev) => [...prev, event]);
      setName("");
      setDate("");
      setTime("");
      setCapacity("");
      setDescription("");
      setCostBudget("");
      setTiers([{ name: "General", price: "", qty: "", online_purchasable: true }]);
      setShowCreate(false);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  if (!events) return <p>Loading&hellip;</p>;

  const sorted = [...events].sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  return (
    <>
      <div className="panel">
        <h3>Events</h3>
        {sorted.length === 0 ? (
          <div className="empty-note">No events yet.</div>
        ) : (
          sorted.map((ev) => (
            <div className="event-card" key={ev.id} onClick={() => navigate(posPath(`/events/${ev.id}`))}>
              <h4>{ev.name}</h4>
              <div className="meta">
                {ev.date}
                {ev.time ? ` · ${ev.time}` : ""} · {ev.tickets_sold} ticket{ev.tickets_sold === 1 ? "" : "s"} sold
                {ev.capacity ? ` / ${ev.capacity} capacity` : ""}
              </div>
              <div>
                {ev.tiers.map((t) => (
                  <span className="tier-chip" key={t.id}>
                    {t.name} · {fmt(t.price)}
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
        {isManager && (
          <button className="link-btn" style={{ marginTop: 10 }} onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? "Cancel" : "+ Create event"}
          </button>
        )}
      </div>

      {showCreate && (
        <div className="panel">
          <h3>New event</h3>
          <div className="form-grid">
            <div className="form-field">
              <label>Event name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Book Club Night" />
            </div>
            <div className="form-field">
              <label>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="form-field">
              <label>Time</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div className="form-field">
              <label>Capacity (optional)</label>
              <input type="number" min="0" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="e.g. 40" />
            </div>
            <div className="form-field full">
              <label>Description</label>
              <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's the event about?" />
            </div>
            <div className="form-field">
              <label>Cost budget (₦)</label>
              <input type="number" min="0" value={costBudget} onChange={(e) => setCostBudget(e.target.value)} placeholder="Staff, decor, performer fees..." />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={{ display: "block", fontSize: 12, color: "var(--ink-soft)", marginBottom: 6 }}>Ticket tiers</label>
            {tiers.map((t, i) => (
              <div className="tier-row" key={i}>
                <input type="text" placeholder="Tier name" value={t.name} onChange={(e) => updateTier(i, "name", e.target.value)} />
                <input
                  type="number"
                  min="0"
                  placeholder="Price (₦)"
                  value={t.price}
                  onChange={(e) => updateTier(i, "price", e.target.value)}
                  style={{ maxWidth: 120 }}
                />
                <input
                  type="number"
                  min="0"
                  placeholder="Qty (0=unlimited)"
                  value={t.qty}
                  onChange={(e) => updateTier(i, "qty", e.target.value)}
                  style={{ maxWidth: 150 }}
                />
                <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, whiteSpace: "nowrap" }}>
                  <input
                    type="checkbox"
                    checked={t.online_purchasable}
                    onChange={(e) => updateTier(i, "online_purchasable", e.target.checked)}
                  />
                  Sell online
                </label>
                {tiers.length > 1 && (
                  <button className="remove-btn" onClick={() => removeTierRow(i)}>
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button className="link-btn" onClick={addTierRow}>
              + Add another tier
            </button>
            <p style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 6 }}>
              Uncheck "Sell online" for tiers too expensive or risky to sell unattended (e.g. a multi-session pack) —
              you can still sell those in person here, they just won't show on the public booking page.
            </p>
          </div>
          {error && <div className="error-text" style={{ marginTop: 8 }}>{error}</div>}
          <button className="log-btn" onClick={createEvent}>
            Create event
          </button>
        </div>
      )}
    </>
  );
}
