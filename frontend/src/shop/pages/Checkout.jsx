import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useCart } from "../CartContext.jsx";
import { shopApi } from "../shopApi.js";
import { shopOrigin, shopPath } from "../shopBase.js";

function fmt(n) {
  return `₦${n.toLocaleString("en-NG")}`;
}

export default function Checkout() {
  const { items, subtotal } = useCart();
  const [form, setForm] = useState({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    fulfillment_method: "pickup",
    delivery_address: "",
  });
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  if (items.length === 0) return <Navigate to={shopPath("/cart")} replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("submitting");
    setError("");
    try {
      const result = await shopApi.checkout({
        ...form,
        delivery_address: form.fulfillment_method === "delivery" ? form.delivery_address : null,
        items: items.map((i) => ({ product_id: i.productId, qty: i.qty })),
        callback_url: `${shopOrigin()}/order-confirmation`,
      });
      window.location.href = result.authorization_url;
    } catch (err) {
      setError(err.message);
      setStatus("idle");
    }
  }

  return (
    <section className="section">
      <div className="container form-grid">
        <div className="form-card">
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
              value={form.fulfillment_method}
              onChange={(e) => setForm({ ...form, fulfillment_method: e.target.value })}
            >
              <option value="pickup">Pickup at the cafe</option>
              <option value="delivery">Delivery</option>
            </select>
            {form.fulfillment_method === "delivery" && (
              <textarea
                placeholder="Delivery address"
                required
                rows={3}
                value={form.delivery_address}
                onChange={(e) => setForm({ ...form, delivery_address: e.target.value })}
              />
            )}
            {error && (
              <p className="form-error">
                {error}
                {error.includes("PAYSTACK") && " (Payments aren't set up on this site yet.)"}
              </p>
            )}
            <button type="submit" className="button button-primary" disabled={status === "submitting"}>
              {status === "submitting" ? "Redirecting to payment…" : `Pay ${fmt(subtotal)} with Paystack`}
            </button>
          </form>
        </div>

        <div className="form-card">
          <h2>Order Summary</h2>
          {items.map((item) => (
            <div key={item.productId} style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
              <span>
                {item.qty} &times; {item.name}
              </span>
              <span>{fmt(item.price * item.qty)}</span>
            </div>
          ))}
          <div className="cart-summary">
            <span>Total</span>
            <span>{fmt(subtotal)}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
