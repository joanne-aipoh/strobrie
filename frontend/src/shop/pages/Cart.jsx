import { Link } from "react-router-dom";
import { useCart } from "../CartContext.jsx";
import { photoUrl } from "../shopApi.js";
import { shopPath } from "../shopBase.js";

function fmt(n) {
  return `₦${n.toLocaleString("en-NG")}`;
}

function formatFlavorBreakdown(breakdown) {
  return Object.entries(breakdown)
    .map(([label, qty]) => `${qty} ${label}`)
    .join(", ");
}

export default function Cart() {
  const { items, setQty, removeItem, subtotal } = useCart();

  return (
    <section className="section">
      <div className="container">
        <h1 style={{ fontSize: "2rem", marginBottom: "1.5rem" }}>Your Cart</h1>

        {items.length === 0 ? (
          <>
            <p className="empty-note">Your cart is empty.</p>
            <Link to={shopPath("/")} className="button button-primary" style={{ display: "inline-block" }}>
              Browse Products
            </Link>
          </>
        ) : (
          <>
            <div className="cart-list">
              {items.map((item) => (
                <div className="cart-list-row" key={item.lineId}>
                  {item.photo ? (
                    <img src={photoUrl(item.photo)} alt="" className="cart-list-photo" />
                  ) : (
                    <div className="cart-list-photo cart-list-photo-empty" />
                  )}
                  <div className="cart-list-info">
                    <div className="cart-list-name">{item.name}</div>
                    <div className="cart-list-price">{fmt(item.price)} each</div>
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
                    {item.flavorBreakdown && (
                      <div style={{ fontSize: 12.5, color: "var(--color-hot-pink-dark)", marginTop: 2 }}>
                        {formatFlavorBreakdown(item.flavorBreakdown)}
                      </div>
                    )}
                  </div>
                  <div className="qty-stepper">
                    <button onClick={() => setQty(item.lineId, item.qty - 1)}>&minus;</button>
                    <span>{item.qty}</span>
                    <button onClick={() => setQty(item.lineId, item.qty + 1)}>+</button>
                  </div>
                  <div className="cart-list-line-total">{fmt(item.price * item.qty)}</div>
                  <button className="remove-btn" onClick={() => removeItem(item.lineId)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <div className="cart-summary">
              <span>Subtotal</span>
              <span>{fmt(subtotal)}</span>
            </div>

            <Link to={shopPath("/checkout")} className="button button-primary" style={{ display: "inline-block" }}>
              Checkout
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
