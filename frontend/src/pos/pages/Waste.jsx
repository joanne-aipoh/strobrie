import { useEffect, useState } from "react";
import { usePosAuth } from "../PosAuthContext.jsx";
import { posApi } from "../posApi.js";

const WASTE_REASONS = ["Spoilage", "Over-prep", "Customer return", "Staff meal", "Breakage", "Expired stock", "Other"];
const UNITS = ["each", "g", "kg", "ml", "l"];

function fmt(n) {
  return "₦" + Math.round(n).toLocaleString();
}

export default function Waste() {
  const { currentStaff, isManager } = usePosAuth();
  const [ingredients, setIngredients] = useState(null);
  const [entries, setEntries] = useState([]);

  const [itemChoice, setItemChoice] = useState(null);
  const [customName, setCustomName] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("each");
  const [unitCost, setUnitCost] = useState("");
  const [reason, setReason] = useState(WASTE_REASONS[0]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    posApi.listInventory().then((items) => {
      setIngredients(items);
      if (items.length > 0) {
        setItemChoice(items[0].id);
        setUnit(items[0].unit);
      }
    });
    posApi.listWaste().then(setEntries);
  }, []);

  function onItemChoiceChange(value) {
    setItemChoice(value);
    if (value !== "__custom__") {
      const ing = ingredients.find((i) => String(i.id) === value);
      if (ing) setUnit(ing.unit);
    }
  }

  async function logWaste() {
    const isCustom = itemChoice === "__custom__";
    const name = isCustom ? customName.trim() : ingredients.find((i) => String(i.id) === String(itemChoice))?.name;
    const qtyNum = parseFloat(qty);
    const unitCostNum = parseFloat(unitCost);

    if (isCustom && !name) {
      setError("Enter an item name.");
      return;
    }
    if (!qtyNum || qtyNum <= 0) {
      setError("Enter a quantity greater than 0.");
      return;
    }
    if (isNaN(unitCostNum) || unitCostNum < 0) {
      setError("Enter a unit cost (0 if unknown).");
      return;
    }
    setError("");

    try {
      const entry = await posApi.logWaste({
        staff_id: currentStaff.id,
        item_name: name,
        qty: qtyNum,
        unit,
        unit_cost: unitCostNum,
        reason,
        notes: notes.trim() || null,
      });
      setEntries((prev) => [entry, ...prev]);
      setCustomName("");
      setQty("");
      setUnitCost("");
      setReason(WASTE_REASONS[0]);
      setNotes("");
    } catch (err) {
      setError(err.message);
    }
  }

  if (!ingredients) return <p>Loading&hellip;</p>;

  const recent = entries.slice(0, 12);
  const totalCost = entries.reduce((s, w) => s + w.cost_impact, 0);
  const isCustom = itemChoice === "__custom__";

  return (
    <>
      <div className="panel">
        <h3>Log kitchen waste</h3>
        <div className="form-grid">
          <div className="form-field">
            <label>Ingredient / inventory item</label>
            <select value={itemChoice ?? ""} onChange={(e) => onItemChoiceChange(e.target.value)}>
              {ingredients.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
              <option value="__custom__">Other / not listed…</option>
            </select>
          </div>
          {isCustom ? (
            <div className="form-field">
              <label>Custom item name</label>
              <input type="text" value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="e.g. Unsold whole cake" />
            </div>
          ) : (
            <div />
          )}
          <div className="form-field">
            <label>Quantity</label>
            <input type="number" min="0" step="0.1" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="e.g. 2" />
          </div>
          <div className="form-field">
            <label>Unit</label>
            <select value={unit} onChange={(e) => setUnit(e.target.value)}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Unit cost (₦)</label>
            <input type="number" min="0" step="1" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} placeholder="e.g. 800" />
          </div>
          <div className="form-field">
            <label>Reason</label>
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              {WASTE_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field full">
            <label>Notes (optional)</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any context worth remembering" />
          </div>
        </div>
        {error && <div className="error-text">{error}</div>}
        <button className="log-btn" onClick={logWaste}>
          Log waste
        </button>
      </div>

      <div className="panel">
        <h3>{isManager ? `Waste total logged: ${fmt(totalCost)}` : "Recent waste entries"}</h3>
        {recent.length === 0 ? (
          <div className="empty-note">No waste logged yet.</div>
        ) : (
          <table className="log-table">
            <thead>
              <tr>
                <th>Ingredient</th>
                <th>Qty</th>
                {isManager && <th>Cost</th>}
                <th>Reason</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((w) => (
                <tr key={w.id}>
                  <td>{w.item_name}</td>
                  <td>
                    {w.qty} {w.unit}
                  </td>
                  {isManager && <td>{fmt(w.cost_impact)}</td>}
                  <td>
                    <span className="reason-tag">{w.reason}</span>
                  </td>
                  <td>{new Date(w.timestamp).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
