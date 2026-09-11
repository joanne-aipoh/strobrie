import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useCart } from "../CartContext.jsx";
import { shopApi } from "../shopApi.js";
import { shopOrigin, shopPath } from "../shopBase.js";
import { areaOptionsFor, deliveryFeeFor } from "../deliveryAreas.js";
import { whatsappLink } from "../../whatsapp.js";

function fmt(n) {
  return `₦${n.toLocaleString("en-NG")}`;
}

function formatFlavorBreakdown(breakdown) {
  return Object.entries(breakdown)
    .map(([label, qty]) => `${qty} ${label}`)
    .join(", ");
}

const todayStr = () => new Date().toISOString().slice(0, 10);

// Riders/staff stop doing deliveries at 5pm — mirrors
// backend/app/routers/shop_orders.py's DELIVERY_CUTOFF_HOUR. Pickup has no
// such cutoff.
const DELIVERY_CUTOFF_HOUR = 17;
const DELIVERY_CUTOFF_LABEL = "5pm";

function isAfterDeliveryCutoff(date) {
  return date.getHours() >= DELIVERY_CUTOFF_HOUR;
}

export default function Checkout() {
  const { items, subtotal } = useCart();
  const [form, setForm] = useState({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    fulfillment_method: "pickup",
    delivery_address: "",
    delivery_method: "bike",
    delivery_area: "",
    gift_note: "",
    timing_choice: "asap",
    requested_date: "",
    requested_time: "",
    loyalty_phone: "",
    redeem_points: "",
  });
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [loyalty, setLoyalty] = useState({ status: "idle", points: 0, nairaPerPoint: 1, error: "" });

  async function checkLoyaltyPoints() {
    if (!form.loyalty_phone.trim()) return;
    setLoyalty({ status: "checking", points: 0, nairaPerPoint: 1, error: "" });
    try {
      const result = await shopApi.lookupLoyaltyPoints(form.loyalty_phone.trim());
      setLoyalty({ status: "found", points: result.points, nairaPerPoint: result.naira_per_point, error: "" });
    } catch (err) {
      setLoyalty({ status: "not-found", points: 0, nairaPerPoint: 1, error: err.message });
    }
  }

  const redeemPoints = loyalty.status === "found" ? Math.max(0, Math.min(Number(form.redeem_points) || 0, loyalty.points)) : 0;
  const discount = Math.min(redeemPoints * loyalty.nairaPerPoint, subtotal);
  const deliveryFee =
    form.fulfillment_method === "delivery" ? deliveryFeeFor(form.delivery_method, form.delivery_area) : 0;
  const total = subtotal - discount + deliveryFee;

  const isDelivery = form.fulfillment_method === "delivery";
  const asapBlockedByCutoff = isDelivery && form.timing_choice === "asap" && isAfterDeliveryCutoff(new Date());
  const scheduledAfterCutoff =
    isDelivery &&
    form.timing_choice === "scheduled" &&
    form.requested_time &&
    Number(form.requested_time.split(":")[0]) >= DELIVERY_CUTOFF_HOUR;

  if (items.length === 0) return <Navigate to={shopPath("/cart")} replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    if (asapBlockedByCutoff || scheduledAfterCutoff) {
      setError(`Delivery orders close at ${DELIVERY_CUTOFF_LABEL} — please pick a time before then, or choose pickup.`);
      return;
    }
    setStatus("submitting");
    setError("");
    try {
      let requested_at = null;
      if (form.timing_choice === "scheduled" && form.requested_date) {
        const time = form.requested_time || "09:00";
        requested_at = new Date(`${form.requested_date}T${time}`).toISOString();
      }
      const result = await shopApi.checkout({
        customer_name: form.customer_name,
        customer_email: form.customer_email,
        customer_phone: form.customer_phone,
        fulfillment_method: form.fulfillment_method,
        delivery_address: form.fulfillment_method === "delivery" ? form.delivery_address : null,
        delivery_area: form.fulfillment_method === "delivery" ? form.delivery_area : null,
        delivery_method: form.fulfillment_method === "delivery" ? form.delivery_method : null,
        gift_note: form.fulfillment_method === "delivery" ? form.gift_note : null,
        requested_at,
        loyalty_phone: loyalty.status === "found" ? form.loyalty_phone.trim() : null,
        redeem_points: redeemPoints,
        items: items.map((i) => ({
          product_id: i.productId,
          qty: i.qty,
          inscription: i.inscription,
          design_notes: i.designNotes,
          flavor_breakdown: i.flavorBreakdown,
          addons: i.addons,
        })),
        callback_url: `${shopOrigin()}/order-confirmation`,
      });
      window.location.href = result.authorization_url;
    } catch (err) {
      setError(err.message);
      setStatus("idle");
    }
  }

  // Builds a pre-filled WhatsApp message for customers who'd rather order by
  // chatting than pay online — same cart, sent as a readable order request
  // instead of going through Paystack. Nothing is submitted to the backend
  // here; staff take it from there in the chat.
  function buildWhatsAppOrderMessage() {
    const lines = ["Hi Strobriē! I'd like to order:"];
    for (const item of items) {
      let line = `- ${item.qty} × ${item.name} — ${fmt(item.price * item.qty)}`;
      if (item.inscription) line += ` (Inscription: "${item.inscription}")`;
      if (item.designNotes) line += ` (Color: "${item.designNotes}")`;
      if (item.addons) line += ` (Add-ons: "${item.addons}")`;
      if (item.flavorBreakdown) line += ` (${formatFlavorBreakdown(item.flavorBreakdown)})`;
      lines.push(line);
    }
    lines.push(`Total: ${fmt(total)}`);
    lines.push("");
    lines.push(`Name: ${form.customer_name || "—"}`);
    lines.push(`Phone: ${form.customer_phone || "—"}`);
    lines.push(`Fulfillment: ${form.fulfillment_method === "delivery" ? "Delivery" : "Pickup"}`);
    if (form.fulfillment_method === "delivery" && form.delivery_address) {
      lines.push(`Delivery address: ${form.delivery_address}${form.delivery_area ? ` (${form.delivery_area})` : ""}`);
      if (deliveryFee > 0) {
        lines.push(`${form.delivery_method === "car" ? "Car" : "Bike"} delivery fee: ${fmt(deliveryFee)}`);
      }
    }
    lines.push(`When: ${form.timing_choice === "asap" ? "As soon as possible" : `${form.requested_date || "—"} ${form.requested_time || ""}`.trim()}`);
    return lines.join("\n");
  }

  return (
    <section className="section">
      <div className="container form-grid">
        <div className="form-card" style={{ order: 2 }}>
          <h2>Checkout Details</h2>
          <form className="contact-form" onSubmit={handleSubmit}>
            <input
              type="text"
              placeholder="Your name"
              required
              value={form.customer_name}
              onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
            />
            <input
              type="email"
              placeholder="Email"
              required
              value={form.customer_email}
              onChange={(e) => setForm({ ...form, customer_email: e.target.value })}
            />
            <input
              type="text"
              placeholder="Phone"
              required
              value={form.customer_phone}
              onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
            />
            <select
              className="fulfillment-select"
              value={form.fulfillment_method}
              onChange={(e) => setForm({ ...form, fulfillment_method: e.target.value })}
            >
              <option value="pickup">Pickup at the cafe</option>
              <option value="delivery">Delivery</option>
            </select>
            {form.fulfillment_method === "delivery" && (
              <>
                <div>
                  <label style={{ display: "block", fontSize: 13, color: "var(--color-text-soft, #6b6b6b)", marginBottom: 6 }}>
                    Bike or car delivery?
                  </label>
                  <div style={{ display: "flex", gap: "0.75rem" }}>
                    {["bike", "car"].map((method) => (
                      <button
                        key={method}
                        type="button"
                        className={form.delivery_method === method ? "button button-primary" : "button button-ghost"}
                        style={{ flex: 1, padding: "0.6rem 1rem" }}
                        onClick={() => setForm({ ...form, delivery_method: method, delivery_area: "" })}
                      >
                        {method === "bike" ? "Bike" : "Car"}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  placeholder="Delivery address"
                  required
                  rows={3}
                  value={form.delivery_address}
                  onChange={(e) => setForm({ ...form, delivery_address: e.target.value })}
                />
                <div>
                  <label style={{ display: "block", fontSize: 13, color: "var(--color-text-soft, #6b6b6b)", marginBottom: 6 }}>
                    Ordering for someone else? Add a note card (optional)
                  </label>
                  <textarea
                    placeholder={'e.g. "Happy Birthday! - Love, Joanne"'}
                    rows={3}
                    maxLength={300}
                    value={form.gift_note}
                    onChange={(e) => setForm({ ...form, gift_note: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 13, color: "var(--color-text-soft, #6b6b6b)", marginBottom: 6 }}>
                    Which part of Abuja are you in?
                  </label>
                  <select
                    required
                    value={form.delivery_area}
                    onChange={(e) => setForm({ ...form, delivery_area: e.target.value })}
                  >
                    <option value="" disabled>
                      Select your area
                    </option>
                    {areaOptionsFor(form.delivery_method).map(({ name, fee }) => (
                      <option key={name} value={name}>
                        {name} — {fmt(fee)}
                      </option>
                    ))}
                  </select>
                  <p className="form-note" style={{ margin: "6px 0 0" }}>
                    We only deliver within these areas — for anywhere else, please choose pickup.
                  </p>
                </div>
              </>
            )}
            <div>
              <label style={{ display: "block", fontSize: 13, color: "var(--color-text-soft, #6b6b6b)", marginBottom: 6 }}>
                When do you want it?
              </label>
              <div style={{ display: "flex", gap: "0.5rem", marginBottom: form.timing_choice === "scheduled" ? 8 : 0 }}>
                <button
                  type="button"
                  className="button"
                  style={{
                    flex: 1,
                    alignSelf: "stretch",
                    background: form.timing_choice === "asap" ? "var(--color-hot-pink-dark)" : "var(--color-bg)",
                    color: form.timing_choice === "asap" ? "#fff" : "var(--color-text)",
                    border: "1px solid rgba(0,0,0,0.15)",
                  }}
                  onClick={() => setForm({ ...form, timing_choice: "asap" })}
                >
                  As soon as possible
                </button>
                <button
                  type="button"
                  className="button"
                  style={{
                    flex: 1,
                    alignSelf: "stretch",
                    background: form.timing_choice === "scheduled" ? "var(--color-hot-pink-dark)" : "var(--color-bg)",
                    color: form.timing_choice === "scheduled" ? "#fff" : "var(--color-text)",
                    border: "1px solid rgba(0,0,0,0.15)",
                  }}
                  onClick={() => setForm({ ...form, timing_choice: "scheduled" })}
                >
                  Schedule for later
                </button>
              </div>
              {form.timing_choice === "scheduled" && (
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input
                    type="date"
                    required
                    min={todayStr()}
                    value={form.requested_date}
                    onChange={(e) => setForm({ ...form, requested_date: e.target.value })}
                    style={{ flex: 1 }}
                  />
                  <input
                    type="time"
                    required
                    max={isDelivery ? "17:00" : undefined}
                    value={form.requested_time}
                    onChange={(e) => setForm({ ...form, requested_time: e.target.value })}
                    style={{ flex: 1 }}
                  />
                </div>
              )}
              {isDelivery && (
                <p className="form-note" style={{ margin: "6px 0 0" }}>
                  Delivery orders are accepted until {DELIVERY_CUTOFF_LABEL} daily.
                </p>
              )}
              {(asapBlockedByCutoff || scheduledAfterCutoff) && (
                <p className="form-error" style={{ margin: "6px 0 0" }}>
                  {asapBlockedByCutoff
                    ? `It's past ${DELIVERY_CUTOFF_LABEL} — please schedule a delivery time before then, or switch to pickup.`
                    : `Please pick a delivery time before ${DELIVERY_CUTOFF_LABEL}.`}
                </p>
              )}
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, color: "var(--color-text-soft, #6b6b6b)", marginBottom: 6 }}>
                Strobrie Loyalty — spend points on this order (optional)
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", justifyContent: "flex-end" }}>
                <input
                  type="text"
                  placeholder="Loyalty phone number"
                  value={form.loyalty_phone}
                  onChange={(e) => {
                    setForm({ ...form, loyalty_phone: e.target.value });
                    setLoyalty({ status: "idle", points: 0, nairaPerPoint: 1, error: "" });
                  }}
                  style={{ flex: "1 1 200px" }}
                />
                <button
                  type="button"
                  className="button button-ghost"
                  disabled={loyalty.status === "checking" || !form.loyalty_phone.trim()}
                  onClick={checkLoyaltyPoints}
                  style={{ flex: "0 0 auto" }}
                >
                  {loyalty.status === "checking" ? "Checking…" : "Check points"}
                </button>
              </div>
              {loyalty.status === "found" && (
                <div style={{ marginTop: 8 }}>
                  <p className="form-note" style={{ margin: "0 0 6px" }}>
                    {loyalty.points} points available (₦{loyalty.nairaPerPoint} off per point).
                  </p>
                  <input
                    type="number"
                    min="0"
                    max={loyalty.points}
                    placeholder="Points to redeem"
                    value={form.redeem_points}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === "") {
                        setForm({ ...form, redeem_points: "" });
                        return;
                      }
                      const clamped = Math.max(0, Math.min(Number(raw) || 0, loyalty.points));
                      setForm({ ...form, redeem_points: String(clamped) });
                    }}
                  />
                </div>
              )}
              {loyalty.status === "not-found" && <p className="form-error">{loyalty.error}</p>}
            </div>
            {error && (
              <p className="form-error">
                {error}
                {error.includes("PAYSTACK") && " (Payments aren't set up on this site yet.)"}
              </p>
            )}
            <button
              type="submit"
              className="button button-primary"
              disabled={status === "submitting" || asapBlockedByCutoff || scheduledAfterCutoff}
              style={{ alignSelf: "flex-end", width: "100%", boxSizing: "border-box" }}
            >
              {status === "submitting" ? "Redirecting to payment…" : `Pay ${fmt(total)} with Paystack`}
            </button>
            <a
              href={whatsappLink(buildWhatsAppOrderMessage())}
              target="_blank"
              rel="noopener noreferrer"
              className="button button-ghost"
              style={{ alignSelf: "flex-end", width: "100%", boxSizing: "border-box", textAlign: "center" }}
            >
              Order via WhatsApp instead
            </a>
          </form>
        </div>

        <div className="form-card" style={{ order: 1 }}>
          <h2>Order Summary</h2>
          {items.map((item) => (
            <div key={item.lineId} style={{ padding: "0.5rem 0", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>
                  {item.qty} &times; {item.name}
                </span>
                <span>{fmt(item.price * item.qty)}</span>
              </div>
              {item.inscription && (
                <div style={{ fontSize: 12.5, color: "var(--color-hot-pink-dark)", marginTop: 2 }}>
                  Inscription: &ldquo;{item.inscription}&rdquo;
                </div>
              )}
              {item.designNotes && (
                <div style={{ fontSize: 12.5, color: "var(--color-hot-pink-dark)", marginTop: 2 }}>
                  Color: &ldquo;{item.designNotes}&rdquo;
                </div>
              )}
              {item.addons && (
                <div style={{ fontSize: 12.5, color: "var(--color-hot-pink-dark)", marginTop: 2 }}>
                  Add-ons: &ldquo;{item.addons}&rdquo;
                </div>
              )}
              {item.flavorBreakdown && (
                <div style={{ fontSize: 12.5, color: "var(--color-hot-pink-dark)", marginTop: 2 }}>
                  {formatFlavorBreakdown(item.flavorBreakdown)}
                </div>
              )}
            </div>
          ))}
          <div className="cart-summary">
            <span>Subtotal</span>
            <span>{fmt(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="cart-summary" style={{ color: "var(--color-hot-pink-dark)" }}>
              <span>Loyalty discount ({redeemPoints} pts)</span>
              <span>&minus;{fmt(discount)}</span>
            </div>
          )}
          {deliveryFee > 0 && (
            <div className="cart-summary">
              <span>{form.delivery_method === "car" ? "Car" : "Bike"} delivery ({form.delivery_area})</span>
              <span>{fmt(deliveryFee)}</span>
            </div>
          )}
          <div className="cart-summary">
            <span>Total</span>
            <span>{fmt(total)}</span>
          </div>
          {loyalty.status === "found" && (
            <p className="form-note" style={{ marginTop: 6 }}>
              You'll earn {Math.floor(total / 200)} points on this order.
            </p>
          )}
          {form.fulfillment_method === "delivery" && form.gift_note && (
            <div style={{ fontSize: 12.5, color: "var(--color-hot-pink-dark)", marginTop: 10 }}>
              Note card: &ldquo;{form.gift_note}&rdquo;
            </div>
          )}
          <div style={{ fontSize: 12.5, marginTop: 10 }}>
            {form.timing_choice === "scheduled" && form.requested_date
              ? `Requested for: ${new Date(`${form.requested_date}T${form.requested_time || "09:00"}`).toLocaleString()}`
              : "As soon as possible"}
          </div>
        </div>
      </div>
    </section>
  );
}
