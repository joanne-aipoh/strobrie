import { useEffect, useState } from "react";
import { usePosAuth } from "../PosAuthContext.jsx";
import { posApi } from "../posApi.js";

const CATEGORY_ORDER = ["Coffee", "Drinks", "Breakfast", "Lunch", "Bakery", "Cakes", "Bar", "Brunch"];
const NAIRA_PER_POINT_REDEEM = 10;

function fmt(n) {
  return "₦" + Math.round(n).toLocaleString();
}

function printReceipt(receipt) {
  const rows = receipt.items
    .map((it) => `<tr><td>${it.qty} × ${it.name}</td><td style="text-align:right;">${fmt(it.price * it.qty)}</td></tr>`)
    .join("");
  const win = window.open("", "receipt", "width=380,height=600");
  if (!win) return;
  win.document.write(`
    <html><head><title>Receipt</title>
    <style>
      body{font-family:monospace;padding:16px;color:#222;}
      h2{text-align:center;margin:0 0 2px;}
      .sub{text-align:center;font-size:12px;margin-bottom:14px;}
      table{width:100%;border-collapse:collapse;font-size:13px;}
      td{padding:3px 0;}
      .line{border-top:1px dashed #999;margin:8px 0;}
      .total{font-weight:bold;font-size:15px;}
    </style></head><body>
      <h2>Strobrie</h2>
      <div class="sub">${new Date(receipt.timestamp).toLocaleString()}<br/>Served by ${receipt.staffName}</div>
      <div class="line"></div>
      <table>${rows}</table>
      <div class="line"></div>
      <table>
        <tr><td>Subtotal</td><td style="text-align:right;">${fmt(receipt.subtotal)}</td></tr>
        ${receipt.discount > 0 ? `<tr><td>Loyalty discount</td><td style="text-align:right;">-${fmt(receipt.discount)}</td></tr>` : ""}
        <tr class="total"><td>Total</td><td style="text-align:right;">${fmt(receipt.total)}</td></tr>
        <tr><td>${receipt.paymentMethod}</td><td></td></tr>
        ${receipt.customerName ? `<tr><td>${receipt.customerName}</td><td style="text-align:right;">+${receipt.pointsEarned} pts</td></tr>` : ""}
      </table>
      <div class="line"></div>
      <div class="sub">Thank you!</div>
      <script>window.print();<\/script>
    </body></html>
  `);
  win.document.close();
}

export default function Sell() {
  const { currentStaff } = usePosAuth();
  const [menu, setMenu] = useState(null);
  const [activeCat, setActiveCat] = useState(null);
  const [cart, setCart] = useState([]);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [customError, setCustomError] = useState("");
  const [payMethod, setPayMethod] = useState("Cash");

  const [custSearchPhone, setCustSearchPhone] = useState("");
  const [custSearchResult, setCustSearchResult] = useState("idle");
  const [attachedCustomer, setAttachedCustomer] = useState(null);
  const [redeemPoints, setRedeemPoints] = useState("");
  const [newCustName, setNewCustName] = useState("");
  const [custFormError, setCustFormError] = useState("");

  const [chargeStatus, setChargeStatus] = useState("idle");
  const [chargeError, setChargeError] = useState("");
  const [toast, setToast] = useState("");
  const [lastReceipt, setLastReceipt] = useState(null);

  function loadMenu() {
    return posApi.getMenu().then((items) => {
      setMenu(items);
      setActiveCat((prev) => prev || CATEGORY_ORDER.find((c) => items.some((i) => i.category === c)) || items[0]?.category);
      return items;
    });
  }

  useEffect(() => {
    loadMenu();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categories = menu ? CATEGORY_ORDER.filter((c) => menu.some((i) => i.category === c)) : [];
  const itemsInCat = menu ? menu.filter((i) => i.category === activeCat) : [];

  function qtyInCart(itemId) {
    return cart.find((c) => c.menuItemId === itemId)?.qty || 0;
  }

  function addToCart(item) {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItemId === item.id);
      const currentQty = existing?.qty || 0;
      if (item.stock_qty !== null && currentQty >= item.stock_qty) return prev;
      if (existing) {
        return prev.map((c) => (c.menuItemId === item.id ? { ...c, qty: c.qty + 1 } : c));
      }
      return [...prev, { menuItemId: item.id, name: item.name, category: item.category, price: item.price, qty: 1 }];
    });
  }

  function changeQty(idx, delta) {
    setCart((prev) => {
      const line = prev[idx];
      const menuItem = menu?.find((m) => m.id === line.menuItemId);
      const nextQty = line.qty + delta;
      if (menuItem?.stock_qty !== null && menuItem?.stock_qty !== undefined && nextQty > menuItem.stock_qty) return prev;
      const next = [...prev];
      next[idx] = { ...line, qty: nextQty };
      return next.filter((c) => c.qty > 0);
    });
  }

  function removeLine(idx) {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  }

  function editPrice(idx) {
    const line = cart[idx];
    const input = window.prompt(`Adjust price for "${line.name}" (e.g. different cake size):`, line.price);
    if (input === null) return;
    const val = parseFloat(input);
    if (!isNaN(val) && val > 0) {
      setCart((prev) => prev.map((c, i) => (i === idx ? { ...c, price: val } : c)));
    }
  }

  function addCustomItem() {
    const name = customName.trim();
    const price = parseFloat(customPrice);
    if (!name) {
      setCustomError("Enter an item name.");
      return;
    }
    if (!price || price <= 0) {
      setCustomError("Enter a price greater than 0.");
      return;
    }
    setCart((prev) => [...prev, { menuItemId: null, name, category: "Other", price, qty: 1 }]);
    setCustomName("");
    setCustomPrice("");
    setCustomError("");
    setShowCustomForm(false);
  }

  const subtotal = cart.reduce((sum, c) => sum + c.price * c.qty, 0);
  const requestedRedeem = parseInt(redeemPoints) || 0;
  const cappedRedeem = attachedCustomer ? Math.max(0, Math.min(requestedRedeem, attachedCustomer.points)) : 0;
  const discount = attachedCustomer ? Math.min(cappedRedeem * NAIRA_PER_POINT_REDEEM, subtotal) : 0;
  const finalTotal = subtotal - discount;

  async function searchCustomer() {
    const phone = custSearchPhone.trim();
    if (!phone) {
      setCustSearchResult("idle");
      return;
    }
    try {
      const customer = await posApi.lookupCustomer(phone);
      setAttachedCustomer(customer);
      setCustSearchResult("found");
    } catch {
      setCustSearchResult("notfound");
    }
  }

  function detachCustomer() {
    setAttachedCustomer(null);
    setCustSearchPhone("");
    setRedeemPoints("");
    setCustSearchResult("idle");
  }

  async function quickAddCustomer() {
    const name = newCustName.trim();
    const phone = custSearchPhone.trim();
    if (!name || !phone) {
      setCustFormError("Enter both a name and phone number.");
      return;
    }
    try {
      const customer = await posApi.createCustomer({ name, phone });
      setAttachedCustomer(customer);
      setCustSearchResult("found");
      setNewCustName("");
      setCustFormError("");
    } catch (err) {
      setCustFormError(err.message);
    }
  }

  async function charge() {
    if (cart.length === 0) return;
    setChargeStatus("submitting");
    setChargeError("");
    try {
      const sale = await posApi.charge({
        staff_id: currentStaff.id,
        payment_method: payMethod,
        items: cart.map((c) => ({ menu_item_id: c.menuItemId, name: c.name, category: c.category, qty: c.qty, price: c.price })),
        customer_id: attachedCustomer?.id ?? null,
        redeem_points: cappedRedeem,
      });
      const receipt = {
        items: cart,
        subtotal: sale.subtotal,
        discount: sale.discount,
        total: sale.total,
        paymentMethod: sale.payment_method,
        staffName: currentStaff.name,
        customerName: attachedCustomer?.name ?? null,
        pointsEarned: sale.points_earned,
        timestamp: sale.timestamp,
      };
      setLastReceipt(receipt);
      const custNote = attachedCustomer ? ` — ${attachedCustomer.name} earned ${sale.points_earned} pts` : "";
      setToast(`Sale recorded — ${fmt(sale.total)} (${sale.payment_method})${custNote}`);
      setCart([]);
      detachCustomer();
      setChargeStatus("idle");
      setTimeout(() => setToast(""), 8000);
      loadMenu();
    } catch (err) {
      setChargeError(err.message);
      setChargeStatus("idle");
    }
  }

  if (!menu) return <p>Loading menu&hellip;</p>;

  return (
    <div className="layout">
      <div>
        <div className="categories">
          {categories.map((c) => (
            <button key={c} className={`cat-btn ${c === activeCat ? "active" : ""}`} onClick={() => setActiveCat(c)}>
              {c}
            </button>
          ))}
        </div>
        <div className="item-grid">
          {showCustomForm ? (
            <div className="item-card" style={{ cursor: "default" }}>
              <div className="form-field" style={{ marginBottom: 8 }}>
                <input type="text" placeholder="Item name" value={customName} onChange={(e) => setCustomName(e.target.value)} />
              </div>
              <div className="form-field" style={{ marginBottom: 8 }}>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Price (₦)"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                />
              </div>
              {customError && <div className="error-text" style={{ marginBottom: 6 }}>{customError}</div>}
              <button className="log-btn" style={{ width: "100%", padding: 7, fontSize: 12.5 }} onClick={addCustomItem}>
                Add to order
              </button>
            </div>
          ) : (
            <button className="item-card" style={{ borderStyle: "dashed" }} onClick={() => setShowCustomForm(true)}>
              <div className="name">+ Custom item</div>
              <div className="price">Any price, any name</div>
            </button>
          )}
          {itemsInCat.map((item) => {
            const remaining = item.stock_qty === null ? null : item.stock_qty - qtyInCart(item.id);
            const soldOut = remaining !== null && remaining <= 0;
            return (
              <button
                key={item.id}
                className="item-card"
                disabled={soldOut}
                style={soldOut ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
                onClick={() => addToCart(item)}
              >
                <div className="name">{item.name}</div>
                {soldOut ? <div className="price">Sold out</div> : <div className="price">{fmt(item.price)}</div>}
                {remaining !== null && !soldOut && (
                  <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 2 }}>{remaining} left</div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="cart">
        <h3>Current order</h3>
        {cart.length === 0 ? (
          <div className="cart-empty">No items yet — tap a menu item to add it.</div>
        ) : (
          cart.map((c, idx) => (
            <div className="cart-line" key={idx}>
              <div className="info">
                <div className="n">{c.name}</div>
                <div className="p" onClick={() => editPrice(idx)}>
                  {fmt(c.price)} each · edit
                </div>
              </div>
              <div className="qty-ctrl">
                <button onClick={() => changeQty(idx, -1)}>−</button>
                <span>{c.qty}</span>
                <button onClick={() => changeQty(idx, 1)}>+</button>
              </div>
              <button className="remove-btn" onClick={() => removeLine(idx)}>
                Remove
              </button>
            </div>
          ))
        )}

        {discount > 0 ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--ink-soft)", paddingTop: 8 }}>
              <span>Subtotal</span>
              <span>{fmt(subtotal)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--sage)" }}>
              <span>Loyalty discount</span>
              <span>-{fmt(discount)}</span>
            </div>
            <div className="cart-total">
              <span>Total</span>
              <span>{fmt(finalTotal)}</span>
            </div>
          </>
        ) : (
          <div className="cart-total">
            <span>Total</span>
            <span>{fmt(finalTotal)}</span>
          </div>
        )}

        {attachedCustomer ? (
          <div style={{ background: "var(--cream-2)", borderRadius: 8, padding: 10, marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div>
                <strong style={{ fontSize: 13 }}>{attachedCustomer.name}</strong>
                <div style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>{attachedCustomer.points} points available</div>
              </div>
              <button className="link-btn" onClick={detachCustomer}>
                Remove
              </button>
            </div>
            <div className="form-field">
              <label>Redeem points (₦{NAIRA_PER_POINT_REDEEM} off per point)</label>
              <input
                type="number"
                min="0"
                max={attachedCustomer.points}
                value={redeemPoints}
                onChange={(e) => setRedeemPoints(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
        ) : (
          <div style={{ background: "var(--cream-2)", borderRadius: 8, padding: 10, marginBottom: 12 }}>
            <div className="form-field" style={{ marginBottom: 6 }}>
              <label>Customer phone (loyalty)</label>
              <input type="text" value={custSearchPhone} onChange={(e) => setCustSearchPhone(e.target.value)} placeholder="e.g. 0803..." />
            </div>
            <button className="log-btn" style={{ width: "100%", padding: 7, fontSize: 12.5, marginTop: 0 }} onClick={searchCustomer}>
              Find customer
            </button>
            {custSearchResult === "notfound" && (
              <div style={{ marginTop: 10 }}>
                <div className="error-text" style={{ marginBottom: 6 }}>No customer with that number yet.</div>
                <div className="form-field" style={{ marginBottom: 6 }}>
                  <label>Name for new customer</label>
                  <input type="text" value={newCustName} onChange={(e) => setNewCustName(e.target.value)} placeholder="Full name" />
                </div>
                {custFormError && <div className="error-text" style={{ marginBottom: 6 }}>{custFormError}</div>}
                <button className="log-btn" style={{ width: "100%", padding: 7, fontSize: 12.5 }} onClick={quickAddCustomer}>
                  Add and attach
                </button>
              </div>
            )}
          </div>
        )}

        <div className="pay-row">
          <button className={`pay-btn ${payMethod === "Cash" ? "selected" : ""}`} onClick={() => setPayMethod("Cash")}>
            Cash
          </button>
          <button className={`pay-btn ${payMethod === "Card" ? "selected" : ""}`} onClick={() => setPayMethod("Card")}>
            Card (terminal)
          </button>
        </div>
        {chargeError && <div className="error-text" style={{ marginBottom: 8 }}>{chargeError}</div>}
        <button className="charge-btn" disabled={cart.length === 0 || chargeStatus === "submitting"} onClick={charge}>
          {chargeStatus === "submitting" ? "Charging…" : `Charge ${fmt(finalTotal)}`}
        </button>
        {toast && (
          <div className="toast">
            {toast}{" "}
            <button className="link-btn" style={{ marginLeft: 6 }} onClick={() => lastReceipt && printReceipt(lastReceipt)}>
              Print receipt
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
