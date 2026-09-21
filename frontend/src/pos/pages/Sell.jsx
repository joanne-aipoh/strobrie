import { useEffect, useRef, useState } from "react";
import { usePosAuth } from "../PosAuthContext.jsx";
import { posApi, PAYMENT_METHODS } from "../posApi.js";
import { shopApi } from "../../shop/shopApi.js";

const CATEGORY_ORDER = ["Coffee", "Tea", "Juices", "Smoothies", "Milkshakes", "Lemonades", "Extras", "Breakfast", "Lunch", "Brunch", "Bakery", "Cakes", "Cheesecakes", "Mocktails", "Cocktails", "Schweppes", "Beer"];
const NAIRA_PER_POINT_REDEEM = 1;

function tabTotal(tab) {
  return tab.items.reduce((sum, i) => sum + i.price * i.qty, 0);
}

// "25m" / "2h 10m" — how long a table has been sitting on an unpaid tab.
function since(iso) {
  // Server times are UTC; if the string carries no zone, say so explicitly
  // rather than letting the browser read it as local time.
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(iso);
  const ms = new Date(hasZone ? iso : `${iso}Z`).getTime();
  const mins = Math.max(0, Math.round((Date.now() - ms) / 60000));
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

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

  const [openTabs, setOpenTabs] = useState([]);
  const [activeTab, setActiveTab] = useState(null);   // the tab loaded into the cart, if any
  const [tabBusy, setTabBusy] = useState(false);
  const [tabError, setTabError] = useState("");

  const [chargeStatus, setChargeStatus] = useState("idle");
  const [chargeError, setChargeError] = useState("");
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);

  function showToast(message, ms = 8000) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(""), ms);
  }

  function clearToast() {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast("");
  }

  useEffect(() => () => toastTimer.current && clearTimeout(toastTimer.current), []);
  const [lastReceipt, setLastReceipt] = useState(null);

  function loadMenu() {
    return shopApi.adminListProducts().then((items) => {
      setMenu(items);
      setActiveCat((prev) => prev || CATEGORY_ORDER.find((c) => items.some((i) => i.category === c)) || items[0]?.category);
      return items;
    });
  }

  function loadTabs() {
    return posApi.listTabs().then(setOpenTabs);
  }

  useEffect(() => {
    loadMenu();
    loadTabs();
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

  function cartToLines() {
    return cart.map((c) => ({
      menu_item_id: c.menuItemId,
      name: c.name,
      category: c.category,
      qty: c.qty,
      price: c.price,
    }));
  }

  function clearOrder() {
    setCart([]);
    setActiveTab(null);
    setTabError("");
    detachCustomer();
  }

  // Put a saved tab back on screen so it can be added to or paid off.
  function openTab(tab) {
    setCart(
      tab.items.map((i) => ({
        menuItemId: i.menu_item_id,
        name: i.name,
        category: i.category,
        price: i.price,
        qty: i.qty,
      })),
    );
    setActiveTab(tab);
    setTabError("");
    clearToast();
    setAttachedCustomer(tab.customer ?? null);
    setCustSearchResult(tab.customer ? "found" : "idle");
    setCustSearchPhone(tab.customer?.phone ?? "");
    setRedeemPoints("");
  }

  async function saveTab() {
    if (cart.length === 0) return;
    let label = activeTab?.label;
    if (!label) {
      label = window.prompt("Save this order as a tab. Name it — a table number, or the customer:", "");
      if (label === null) return;
      label = label.trim();
      if (!label) {
        setTabError("Give the tab a name so it can be found again.");
        return;
      }
    }
    setTabBusy(true);
    setTabError("");
    try {
      const body = { label, items: cartToLines(), customer_id: attachedCustomer?.id ?? null };
      const saved = activeTab
        ? await posApi.updateTab(activeTab.id, body)
        : await posApi.openTab({ staff_id: currentStaff.id, ...body });
      await loadTabs();
      loadMenu();
      clearOrder();
      setLastReceipt(null);
      showToast(`Tab saved — ${saved.label}. Charge it when they're ready to pay.`);
    } catch (err) {
      setTabError(err.message);
    } finally {
      setTabBusy(false);
    }
  }

  async function cancelTab() {
    if (!activeTab) return;
    if (!window.confirm(`Close "${activeTab.label}" without taking payment? Anything on it goes back into stock.`)) return;
    setTabBusy(true);
    setTabError("");
    try {
      await posApi.cancelTab(activeTab.id, currentStaff.id);
      await loadTabs();
      loadMenu();
      clearOrder();
      setLastReceipt(null);
      showToast("Tab closed without payment.", 6000);
    } catch (err) {
      setTabError(err.message);
    } finally {
      setTabBusy(false);
    }
  }

  async function charge() {
    if (cart.length === 0) return;
    setChargeStatus("submitting");
    setChargeError("");
    try {
      const body = {
        staff_id: currentStaff.id,
        payment_method: payMethod,
        items: cartToLines(),
        customer_id: attachedCustomer?.id ?? null,
        redeem_points: cappedRedeem,
      };
      // Settling a tab records the same sale, and closes the tab with it.
      const sale = activeTab
        ? await posApi.settleTab(activeTab.id, body)
        : await posApi.charge(body);
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
      showToast(`Sale recorded — ${fmt(sale.total)} (${sale.payment_method})${custNote}`);
      clearOrder();
      setChargeStatus("idle");
      loadMenu();
      if (activeTab) loadTabs();
    } catch (err) {
      setChargeError(err.message);
      setChargeStatus("idle");
    }
  }

  if (!menu) return <p>Loading menu&hellip;</p>;

  return (
    <div className="layout">
      <div>
        {openTabs.length > 0 && (
          <div className="panel" style={{ padding: 12, marginBottom: 14 }}>
            <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginBottom: 8 }}>
              Open tabs ({openTabs.length}) — ordered, not paid for yet. Tap one to add to it or take payment.
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {openTabs.map((t) => (
                <button
                  key={t.id}
                  className={`cat-btn ${activeTab?.id === t.id ? "active" : ""}`}
                  onClick={() => openTab(t)}
                >
                  {t.label} &middot; {fmt(tabTotal(t))} &middot; {since(t.opened_at)}
                </button>
              ))}
            </div>
          </div>
        )}
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
        <h3>{activeTab ? `Tab — ${activeTab.label}` : "Current order"}</h3>
        {activeTab && (
          <div
            style={{
              background: "var(--cream-2)",
              borderRadius: 8,
              padding: 10,
              marginBottom: 12,
              fontSize: 12.5,
              color: "var(--ink-soft)",
            }}
          >
            Open {since(activeTab.opened_at)}. Add to it and save, or take payment now.
            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              <button className="link-btn" onClick={clearOrder}>
                Leave it open
              </button>
              <button className="link-btn" style={{ color: "var(--rust-dark)" }} onClick={cancelTab} disabled={tabBusy}>
                Close without paying
              </button>
            </div>
          </div>
        )}
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
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") {
                    setRedeemPoints("");
                    return;
                  }
                  setRedeemPoints(String(Math.max(0, Math.min(Number(raw) || 0, attachedCustomer.points))));
                }}
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
          {PAYMENT_METHODS.map((method) => (
            <button
              key={method}
              className={`pay-btn ${payMethod === method ? "selected" : ""}`}
              onClick={() => setPayMethod(method)}
            >
              {method}
            </button>
          ))}
        </div>
        {chargeError && <div className="error-text" style={{ marginBottom: 8 }}>{chargeError}</div>}
        {tabError && <div className="error-text" style={{ marginBottom: 8 }}>{tabError}</div>}
        <button className="charge-btn" disabled={cart.length === 0 || chargeStatus === "submitting"} onClick={charge}>
          {chargeStatus === "submitting" ? "Charging…" : `Charge ${fmt(finalTotal)}`}
        </button>
        <button
          className="log-btn"
          style={{ width: "100%", marginTop: 8 }}
          disabled={cart.length === 0 || tabBusy}
          onClick={saveTab}
        >
          {tabBusy ? "Saving…" : activeTab ? "Save changes to tab" : "Save as tab — pay later"}
        </button>
        {toast && (
          <div className="toast">
            {toast}
            {lastReceipt && (
              <>
                {" "}
                <button className="link-btn" style={{ marginLeft: 6 }} onClick={() => printReceipt(lastReceipt)}>
                  Print receipt
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
