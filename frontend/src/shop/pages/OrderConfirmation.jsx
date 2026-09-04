import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { shopApi } from "../shopApi.js";
import { useCart } from "../CartContext.jsx";
import { shopPath } from "../shopBase.js";

function fmt(n) {
  return `₦${n.toLocaleString("en-NG")}`;
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
            <div
              key={item.id}
              style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: "1px solid rgba(0,0,0,0.08)" }}
            >
              <span>
                {item.qty} &times; {item.name}
              </span>
              <span>{fmt(item.price * item.qty)}</span>
            </div>
          ))}
          <div className="cart-summary">
            <span>Total</span>
            <span>{fmt(order.total)}</span>
          </div>
          <p style={{ marginTop: "1rem", fontSize: "0.9rem" }}>
            {order.fulfillment_method === "pickup" ? "Pickup at the cafe." : `Delivery to: ${order.delivery_address}`}
          </p>
        </div>

        <Link to={shopPath("/")} className="link-btn" style={{ display: "inline-block", marginTop: "1.5rem" }}>
          &larr; Continue shopping
        </Link>
      </div>
    </section>
  );
}
