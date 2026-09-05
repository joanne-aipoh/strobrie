import { useEffect, useState } from "react";
import { posApi } from "../posApi.js";

const CATEGORY_ORDER = ["Coffee", "Drinks", "Breakfast", "Lunch", "Bakery", "Cakes", "Bar", "Brunch"];
const LOW_STOCK_THRESHOLD = { kg: 2, l: 3, each: 10, g: 500, ml: 500 };

function stockStatus(qty, unit) {
  const threshold = LOW_STOCK_THRESHOLD[unit] ?? 5;
  if (qty <= 0) return { label: "Out of stock", cls: "in", color: "#b5542d", bg: "#f3e4d6" };
  if (qty <= threshold) return { label: "Low", cls: "out", color: "#8f3e1f", bg: "#f3e4d6" };
  return { label: "OK", cls: "in", color: "#3b5b31", bg: "#eaf1e5" };
}

export default function Inventory() {
  const [inventory, setInventory] = useState(null);
  const [menu, setMenu] = useState(null);

  const [restockItemId, setRestockItemId] = useState(null);
  const [restockQty, setRestockQty] = useState("");
  const [restockError, setRestockError] = useState("");

  const [recipeItemId, setRecipeItemId] = useState(null);
  const [recipeDraft, setRecipeDraft] = useState([]);
  const [recipeMsg, setRecipeMsg] = useState("");

  const [stockItemId, setStockItemId] = useState(null);
  const [batchQty, setBatchQty] = useState("");
  const [stockError, setStockError] = useState("");
  const [stockMsg, setStockMsg] = useState("");

  function loadMenu() {
    return posApi.getMenu().then(setMenu);
  }

  useEffect(() => {
    Promise.all([posApi.listInventory(), posApi.getMenu()]).then(([inv, items]) => {
      setInventory(inv);
      setMenu(items);
      if (inv.length > 0) setRestockItemId(inv[0].id);
      if (items.length > 0) {
        setRecipeItemId(items[0].id);
        setStockItemId(items[0].id);
      }
    });
  }, []);

  useEffect(() => {
    if (recipeItemId == null) return;
    posApi.getRecipe(recipeItemId).then((lines) => {
      setRecipeDraft(lines.map((l) => ({ ingredientId: l.ingredient_id, qty: String(l.qty_per_item) })));
      setRecipeMsg("");
    });
  }, [recipeItemId]);

  async function doRestock() {
    const q = parseFloat(restockQty);
    if (!q || q <= 0) {
      setRestockError("Enter a quantity greater than 0.");
      return;
    }
    const updated = await posApi.restock(restockItemId, q);
    setInventory((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    setRestockQty("");
    setRestockError("");
  }

  function addRecipeRow() {
    setRecipeDraft((prev) => [...prev, { ingredientId: inventory[0]?.id, qty: "" }]);
  }
  function removeRecipeRow(idx) {
    setRecipeDraft((prev) => prev.filter((_, i) => i !== idx));
  }
  function updateRecipeRow(idx, field, value) {
    setRecipeDraft((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  }

  async function saveRecipe() {
    const lines = recipeDraft
      .filter((r) => r.ingredientId && parseFloat(r.qty) > 0)
      .map((r) => ({ ingredient_id: r.ingredientId, qty_per_item: parseFloat(r.qty) }));
    await posApi.setRecipe(recipeItemId, lines);
    setRecipeMsg("Recipe saved.");
  }

  async function addBatch() {
    const q = parseInt(batchQty, 10);
    if (!q || q <= 0) {
      setStockError("Enter a quantity greater than 0.");
      return;
    }
    await posApi.restockMenuItem(stockItemId, q);
    await loadMenu();
    setBatchQty("");
    setStockError("");
    setStockMsg("Added to stock.");
  }

  async function clearStock() {
    await posApi.setMenuItemStock(stockItemId, null);
    await loadMenu();
    setStockMsg("Cleared — this item is unlimited again.");
  }

  if (!inventory || !menu) return <p>Loading&hellip;</p>;

  const categories = CATEGORY_ORDER.filter((c) => menu.some((m) => m.category === c));
  const currentItem = menu.find((m) => m.id === recipeItemId);
  const currentStockItem = menu.find((m) => m.id === stockItemId);

  return (
    <>
      <div className="panel">
        <h3>Restock ingredient</h3>
        <div className="form-grid">
          <div className="form-field">
            <label>Ingredient</label>
            <select value={restockItemId ?? ""} onChange={(e) => setRestockItemId(Number(e.target.value))}>
              {inventory.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Add quantity</label>
            <input type="number" min="0" step="0.1" value={restockQty} onChange={(e) => setRestockQty(e.target.value)} placeholder="e.g. 5" />
          </div>
        </div>
        {restockError && <div className="error-text">{restockError}</div>}
        <button className="log-btn" onClick={doRestock}>
          Add to stock
        </button>
      </div>

      <div className="panel">
        <h3>Stock levels</h3>
        <table className="log-table">
          <thead>
            <tr>
              <th>Ingredient</th>
              <th>Stock</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {inventory.map((ing) => {
              const st = stockStatus(ing.quantity, ing.unit);
              return (
                <tr key={ing.id}>
                  <td>{ing.name}</td>
                  <td>
                    {ing.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })} {ing.unit}
                  </td>
                  <td>
                    <span className={`checkin-badge ${st.cls}`} style={{ background: st.bg, color: st.color }}>
                      {st.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h3>Recipes (ingredients used per item sold)</h3>
        <div className="form-field" style={{ marginBottom: 10, maxWidth: 320 }}>
          <label>Menu item</label>
          <select value={recipeItemId ?? ""} onChange={(e) => setRecipeItemId(Number(e.target.value))}>
            {categories.map((cat) => (
              <optgroup label={cat} key={cat}>
                {menu
                  .filter((m) => m.category === cat)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginBottom: 8 }}>
          {currentItem?.name} — selling this deducts the ingredients below automatically.
        </div>
        {recipeDraft.length === 0 ? (
          <div className="empty-note">No ingredients linked — this item won't deduct stock when sold.</div>
        ) : (
          recipeDraft.map((r, idx) => (
            <div className="tier-row" key={idx}>
              <select value={r.ingredientId} onChange={(e) => updateRecipeRow(idx, "ingredientId", Number(e.target.value))} style={{ flex: 2 }}>
                {inventory.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.unit})
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                step="0.001"
                placeholder="Qty per item"
                value={r.qty}
                onChange={(e) => updateRecipeRow(idx, "qty", e.target.value)}
                style={{ maxWidth: 140 }}
              />
              <button className="remove-btn" onClick={() => removeRecipeRow(idx)}>
                Remove
              </button>
            </div>
          ))
        )}
        <button className="link-btn" onClick={addRecipeRow}>
          + Add ingredient
        </button>
        <div style={{ marginTop: 12 }}>
          {recipeMsg && <span style={{ color: "var(--sage)", fontSize: 12.5, marginRight: 10 }}>{recipeMsg}</span>}
          <button className="log-btn" onClick={saveRecipe}>
            Save recipe
          </button>
        </div>
      </div>

      <div className="panel">
        <h3>Menu item stock</h3>
        <p style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: -8, marginBottom: 12 }}>
          For made-in-batches items (like a limited run of cakes) — log what came out of the kitchen and the Sell
          screen tracks what's left automatically. Items with no stock logged stay unlimited (made to order).
        </p>
        <div className="form-field" style={{ marginBottom: 10, maxWidth: 320 }}>
          <label>Menu item</label>
          <select
            value={stockItemId ?? ""}
            onChange={(e) => {
              setStockItemId(Number(e.target.value));
              setStockMsg("");
              setStockError("");
            }}
          >
            {categories.map((cat) => (
              <optgroup label={cat} key={cat}>
                {menu
                  .filter((m) => m.category === cat)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div style={{ fontSize: 13, marginBottom: 10 }}>
          Current stock:{" "}
          <strong>{currentStockItem?.stock_qty === null || currentStockItem?.stock_qty === undefined ? "Unlimited" : currentStockItem.stock_qty}</strong>
        </div>
        <div className="form-grid">
          <div className="form-field">
            <label>Add batch (qty made)</label>
            <input type="number" min="1" value={batchQty} onChange={(e) => setBatchQty(e.target.value)} placeholder="e.g. 7" />
          </div>
        </div>
        {stockError && <div className="error-text">{stockError}</div>}
        {stockMsg && <div style={{ color: "var(--sage)", fontSize: 12.5, marginTop: 4 }}>{stockMsg}</div>}
        <div style={{ marginTop: 12, display: "flex", gap: 12 }}>
          <button className="log-btn" style={{ marginTop: 0 }} onClick={addBatch}>
            Add to stock
          </button>
          {currentStockItem?.stock_qty !== null && currentStockItem?.stock_qty !== undefined && (
            <button className="link-btn" onClick={clearStock}>
              Clear (make unlimited again)
            </button>
          )}
        </div>
      </div>
    </>
  );
}
