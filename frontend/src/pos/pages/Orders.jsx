import { useEffect, useState } from "react";
import { shopApi } from "../../shop/shopApi.js";

const STATUSES = ["pending", "paid", "fulfilled", "cancelled"];

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

  return (
    <div className="panel">
      <h3>Shop Orders ({orders.length})</h3>
      {orders.length === 0 ? (
        <div className="empty-note">No orders yet.</div>
      ) : (
        orders.map((order) => (
          <div key={order.id} className="panel" style={{ background: "var(--cream-2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div>
                <strong>Order #{order.id}</strong> &middot; {order.customer_name} ({order.customer_email},{" "}
                {order.customer_phone})
                <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 2 }}>
                  {new Date(order.created_at).toLocaleString()} &middot;{" "}
                  {order.fulfillment_method === "pickup"
                    ? "Pickup"
                    : `Delivery (${order.delivery_area || "area not set"}): ${order.delivery_address}`}{" "}
                  &middot; Payment: {order.payment_status}
                </div>
                {order.fulfillment_method === "delivery" && (
                  <div style={{ fontSize: 12.5, color: "var(--rust-dark)", marginTop: 2 }}>
                    Confirm the car/bike rate for {order.delivery_area || "their area"} with the
                    customer, add it to what's collected, and pay the rider out separately.
                  </div>
                )}
                <div style={{ fontSize: 12.5, marginTop: 2 }}>
                  {order.requested_at ? (
                    <span style={{ color: "var(--rust-dark)", fontWeight: 600 }}>
                      Requested for: {new Date(order.requested_at).toLocaleString()}
                    </span>
                  ) : (
                    <span style={{ color: "var(--ink-soft)" }}>No preferred time — as soon as possible</span>
                  )}
                </div>
                {order.gift_note && (
                  <div style={{ fontSize: 12.5, color: "var(--rust-dark)", marginTop: 2 }}>
                    Note card: &ldquo;{order.gift_note}&rdquo;
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
              <select value={order.status} onChange={(e) => changeStatus(order.id, e.target.value)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
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
                          Design: &ldquo;{item.design_notes}&rdquo;
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
