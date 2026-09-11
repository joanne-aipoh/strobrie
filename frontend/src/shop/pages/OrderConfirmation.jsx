import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { shopApi } from "../shopApi.js";
import { useCart } from "../CartContext.jsx";
import { shopPath } from "../shopBase.js";
import { whatsappLink } from "../../whatsapp.js";

function fmt(n) {
  return `₦${n.toLocaleString("en-NG")}`;
}

function formatFlavorBreakdown(json) {
  return Object.entries(JSON.parse(json))
    .map(([label, qty]) => `${qty} ${label}`)
    .join(", ");
}

export default function OrderConfirmation() {
  const [searchParams] = useSearchParams();
  const reference = searchParams.get("reference") || searchParams.get("trxref");
  const { clear } = useCart();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!reference) return;
    shopApi
      .verifyOrder(reference)
      .then((o) => {
        setOrder(o);
        if (o.payment_status === "paid") clear();
      })
      .catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference]);

  if (!reference) {
    return (
      <div className="container" style={{ padding: "3rem 1.5rem" }}>
        <p>No order reference found.</p>
        <Link to={shopPath("/")}>&larr; Back to shop</Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container" style={{ padding: "3rem 1.5rem" }}>
        <p className="form-error">Couldn't confirm this order ({error}).</p>
      </div>
    );
  }

  if (!order) return <p className="container" style={{ padding: "3rem 1.5rem" }}>Confirming your payment&hellip;</p>;

  return (
    <section className="section">
      <div className="container">
        {order.payment_status === "paid" ? (
          <>
            <h1 style={{ fontSize: "2rem" }}>Thank you, {order.customer_name}!</h1>
            <p className="form-success">Payment confirmed — order #{order.id} is on its way to being prepared.</p>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: "2rem" }}>Payment not confirmed</h1>
            <p className="form-error">
              We couldn't confirm payment for this order. If you were charged, please contact us with reference{" "}
              {reference}.
            </p>
          </>
        )}

        <div className="form-card" style={{ marginTop: "1.5rem", maxWidth: 480 }}>
          <h2>Order #{order.id}</h2>
          {order.items.map((item) => (
            <div key={item.id} style={{ padding: "0.5rem 0", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
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
              {item.design_notes && (
                <div style={{ fontSize: 12.5, color: "var(--color-hot-pink-dark)", marginTop: 2 }}>
                  Color: &ldquo;{item.design_notes}&rdquo;
                </div>
              )}
              {item.addons && (
                <div style={{ fontSize: 12.5, color: "var(--color-hot-pink-dark)", marginTop: 2 }}>
                  Add-ons: &ldquo;{item.addons}&rdquo;
                </div>
              )}
              {item.flavor_breakdown && (
                <div style={{ fontSize: 12.5, color: "var(--color-hot-pink-dark)", marginTop: 2 }}>
                  {formatFlavorBreakdown(item.flavor_breakdown)}
                </div>
              )}
            </div>
          ))}
          {order.points_redeemed > 0 && (
            <div className="cart-summary" style={{ color: "var(--color-hot-pink-dark)" }}>
              <span>Loyalty discount ({order.points_redeemed} pts)</span>
              <span>&minus;{fmt(order.subtotal - order.total + order.delivery_fee)}</span>
            </div>
          )}
          {order.delivery_fee > 0 && (
            <div className="cart-summary">
              <span>
                {order.delivery_method === "car" ? "Car" : "Bike"} delivery ({order.delivery_area})
              </span>
              <span>{fmt(order.delivery_fee)}</span>
            </div>
          )}
          <div className="cart-summary">
            <span>Total</span>
            <span>{fmt(order.total)}</span>
          </div>
          {order.points_earned > 0 && order.payment_status === "paid" && (
            <p className="form-note">You earned {order.points_earned} loyalty points on this order.</p>
          )}
          <p style={{ marginTop: "1rem", fontSize: "0.9rem" }}>
            {order.fulfillment_method === "pickup"
              ? "Pickup at the cafe."
              : `Delivery to: ${order.delivery_address}${order.delivery_area ? ` (${order.delivery_area})` : ""}`}
          </p>
          {order.fulfillment_method === "delivery" && order.delivery_fee === 0 && (
            <p style={{ fontSize: "0.85rem", color: "var(--color-text-soft, #6b6b6b)" }}>
              A delivery fee (car or bike, depending on your location) applies separately — we'll
              confirm the rate with you and add it to your total.
            </p>
          )}
          <p style={{ fontSize: "0.9rem" }}>
            {order.requested_at
              ? `Requested for: ${new Date(order.requested_at).toLocaleString()}`
              : "As soon as possible."}
          </p>
          {order.gift_note && (
            <p style={{ fontSize: "0.9rem", color: "var(--color-hot-pink-dark)" }}>
              Note card: &ldquo;{order.gift_note}&rdquo;
            </p>
          )}
        </div>

        <p style={{ marginTop: "1.5rem", fontSize: "0.9rem" }}>
          Questions about your order?{" "}
          <a
            href={whatsappLink(`Hi Strobriē! I have a question about my order #${order.id}.`)}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--color-hot-pink-dark)", fontWeight: 600 }}
          >
            Message us on WhatsApp
          </a>
          .
        </p>

        <Link to={shopPath("/")} className="link-btn" style={{ display: "inline-block", marginTop: "1rem" }}>
          &larr; Continue shopping
        </Link>
      </div>
    </section>
  );
}
