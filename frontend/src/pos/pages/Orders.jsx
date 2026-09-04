import { useEffect, useState } from "react";
import { shopApi } from "../../shop/shopApi.js";

const STATUSES = ["pending", "paid", "fulfilled", "cancelled"];

function fmt(n) {
  return `₦${n.toLocaleString("en-NG")}`;
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
                  {order.fulfillment_method === "pickup" ? "Pickup" : `Delivery: ${order.delivery_address}`} &middot;{" "}
                  Payment: {order.payment_status}
                </div>
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
