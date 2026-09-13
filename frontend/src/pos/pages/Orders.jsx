import { useEffect, useState } from "react";
import { shopApi } from "../../shop/shopApi.js";
import { formatRequestedAt } from "../../shop/formatRequestedAt.js";

const STATUSES = ["pending", "paid", "fulfilled", "cancelled"];

const STATUS_COLORS = {
  pending: { bg: "#fde4d0", text: "#b3500a", border: "#f0975a" },
  paid: { bg: "#dfeaf7", text: "#1d4f8c", border: "#7ea9d8" },
  fulfilled: { bg: "#dff0e0", text: "#1e7d34", border: "#7cc48c" },
  cancelled: { bg: "#f7dede", text: "#9c2626", border: "#e08a8a" },
};

function fmt(n) {
  return `₦${n.toLocaleString("en-NG")}`;
}

function formatFlavorBreakdown(json) {
  return Object.entries(JSON.parse(json))
    .map(([label, qty]) => `${qty} ${label}`)
    .join(", ");
}

export default function Orders() {
  const [orders, setOrders] = useState(null);
  const [showFulfilled, setShowFulfilled] = useState(false);

  function load() {
    return shopApi.adminListOrders().then(setOrders);
  }

  useEffect(() => {
    load();
  }, []);

  async function changeStatus(orderId, status) {
    await shopApi.updateOrderStatus(orderId, status);
    await load();
  }

  if (!orders) return <p>Loading&hellip;</p>;

  // Fulfilled orders are done — keep them out of the working list by default
  // so it doesn't pile up with orders that no longer need attention.
  const fulfilledCount = orders.filter((o) => o.status === "fulfilled").length;
  const visibleOrders = showFulfilled ? orders : orders.filter((o) => o.status !== "fulfilled");

  return (
    <div className="panel">
      <h3>Shop Orders ({orders.length})</h3>
      {fulfilledCount > 0 && (
        <button
          className="link-btn"
          style={{ marginBottom: 10 }}
          onClick={() => setShowFulfilled((v) => !v)}
        >
          {showFulfilled ? "Hide fulfilled orders" : `Show ${fulfilledCount} fulfilled order${fulfilledCount === 1 ? "" : "s"}`}
        </button>
      )}
      {visibleOrders.length === 0 ? (
        <div className="empty-note">{orders.length === 0 ? "No orders yet." : "No orders need attention right now."}</div>
      ) : (
        visibleOrders.map((order) => (
          <div
            key={order.id}
            className="panel"
            style={{
              background: "var(--cream-2)",
              borderLeft: `4px solid ${STATUS_COLORS[order.status]?.border || "transparent"}`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div>
                <strong>Order #{order.id}</strong> &middot; <strong>{order.customer_name.split(" ")[0]}</strong> (
                {order.customer_email}, {order.customer_phone})
                <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 2 }}>
                  {new Date(order.created_at).toLocaleString()} &middot;{" "}
                  {order.fulfillment_method === "pickup"
                    ? "Pickup"
                    : `Delivery (${order.delivery_area || "area not set"}): ${order.delivery_address}`}{" "}
                  &middot; Payment:{" "}
                  <strong style={{ color: order.payment_status === "paid" ? "#1e7d34" : "#9c2626" }}>
                    {order.payment_status}
                  </strong>
                </div>
                {order.fulfillment_method === "delivery" && (
                  <div style={{ fontSize: 12.5, color: "var(--rust-dark)", marginTop: 2 }}>
                    {order.delivery_fee > 0
                      ? `${order.delivery_method === "car" ? "Car" : "Bike"} delivery fee of ₦${order.delivery_fee.toLocaleString()} already collected — pay the rider out separately.`
                      : `Area not in the priced list — confirm the car/bike rate for ${order.delivery_area || "their area"} with the customer and collect it separately.`}
                  </div>
                )}
                <div style={{ fontSize: 12.5, marginTop: 2 }}>
                  {order.requested_at ? (
                    <span style={{ color: "var(--rust-dark)", fontWeight: 600 }}>
                      Requested for: {formatRequestedAt(order.requested_at)}
                    </span>
                  ) : (
                    <span style={{ color: "var(--ink-soft)" }}>Now</span>
                  )}
                </div>
                {order.gift_note && (
                  <div style={{ fontSize: 12.5, color: "var(--rust-dark)", marginTop: 2 }}>
                    Note card: &ldquo;{order.gift_note}&rdquo;
                  </div>
                )}
                {order.customer_notes && (
                  <div style={{ fontSize: 12.5, color: "var(--rust-dark)", marginTop: 2 }}>
                    Notes: &ldquo;{order.customer_notes}&rdquo;
                  </div>
                )}
                {(order.points_redeemed > 0 || order.points_earned > 0) && (
                  <div style={{ fontSize: 12.5, color: "var(--rust-dark)", marginTop: 2 }}>
                    Loyalty: {order.points_redeemed > 0 ? `-${order.points_redeemed} pts redeemed` : ""}
                    {order.points_redeemed > 0 && order.points_earned > 0 ? " · " : ""}
                    {order.points_earned > 0 ? `+${order.points_earned} pts earned` : ""}
                  </div>
                )}
              </div>
              <select
                value={order.status}
                onChange={(e) => changeStatus(order.id, e.target.value)}
                style={{
                  background: STATUS_COLORS[order.status]?.bg,
                  color: STATUS_COLORS[order.status]?.text,
                  border: `1px solid ${STATUS_COLORS[order.status]?.border}`,
                  fontWeight: 600,
                  textTransform: "capitalize",
                  borderRadius: 6,
                  padding: "4px 8px",
                }}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s} style={{ textTransform: "capitalize" }}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <table className="log-table" style={{ marginTop: 10 }}>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.qty} &times; {item.name}
                      {item.inscription && (
                        <div style={{ fontSize: 12, color: "var(--rust-dark)" }}>
                          Inscription: &ldquo;{item.inscription}&rdquo;
                        </div>
                      )}
                      {item.design_notes && (
                        <div style={{ fontSize: 12, color: "var(--rust-dark)" }}>
                          Color: &ldquo;{item.design_notes}&rdquo;
                        </div>
                      )}
                      {item.addons && (
                        <div style={{ fontSize: 12, color: "var(--rust-dark)" }}>
                          Add-ons: &ldquo;{item.addons}&rdquo; — confirm extra cost with customer
                        </div>
                      )}
                      {item.flavor_breakdown && (
                        <div style={{ fontSize: 12, color: "var(--rust-dark)" }}>
                          {formatFlavorBreakdown(item.flavor_breakdown)}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>{fmt(item.price * item.qty)}</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ fontWeight: 700 }}>Total</td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>{fmt(order.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}
