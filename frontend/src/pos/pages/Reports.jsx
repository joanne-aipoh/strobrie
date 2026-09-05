import { useEffect, useState } from "react";
import { usePosAuth } from "../PosAuthContext.jsx";
import { posApi } from "../posApi.js";

function fmt(n) {
  return "₦" + Math.round(n).toLocaleString();
}

function downloadCSV(filename, rows) {
  const csv = rows
    .map((r) =>
      r
        .map((v) => {
          const s = String(v ?? "");
          return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
        })
        .join(","),
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const { currentStaff } = usePosAuth();
  const [sales, setSales] = useState(null);
  const [waste, setWaste] = useState(null);
  const [customers, setCustomers] = useState(null);
  const [staffList, setStaffList] = useState(null);

  async function loadAll() {
    const [s, w, c, st] = await Promise.all([
      posApi.listSales(),
      posApi.listWaste(),
      posApi.listCustomers(),
      posApi.listStaff(),
    ]);
    setSales(s);
    setWaste(w);
    setCustomers(c);
    setStaffList(st);
  }

  useEffect(() => {
    loadAll();
  }, []);

  if (!sales || !waste || !customers || !staffList) return <p>Loading&hellip;</p>;

  const staffName = (id) => staffList.find((s) => s.id === id)?.name || "—";
  const customerName = (id) => (id ? customers.find((c) => c.id === id)?.name || "—" : "—");

  const validSales = sales.filter((s) => !s.voided);
  const todayStr = new Date().toDateString();
  const todaysSales = validSales.filter((s) => new Date(s.timestamp).toDateString() === todayStr);
  const todaysTotal = todaysSales.reduce((s, x) => s + x.total, 0);
  const allTimeTotal = validSales.reduce((s, x) => s + x.total, 0);
  const wasteTotal = waste.reduce((s, w) => s + w.cost_impact, 0);

  const catTotals = {};
  validSales.forEach((s) => {
    s.items.forEach((it) => {
      const key = it.category || "Other";
      catTotals[key] = (catTotals[key] || 0) + it.price * it.qty;
    });
  });
  const maxCat = Math.max(1, ...Object.values(catTotals));
  const catEntries = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);

  const recentSales = sales.slice(0, 15);

  async function handleVoid(saleId, total) {
    if (!window.confirm(`Void this sale for ${fmt(total)}? This restores inventory and loyalty points.`)) return;
    await posApi.voidSale(saleId, currentStaff.id);
    await loadAll();
  }

  function printReceipt(sale) {
    const rows = sale.items.map((it) => `<tr><td>${it.qty} × ${it.name}</td><td style="text-align:right;">${fmt(it.price * it.qty)}</td></tr>`).join("");
    const win = window.open("", "receipt", "width=380,height=600");
    if (!win) return;
    win.document.write(`
      <html><head><title>Receipt</title>
      <style>body{font-family:monospace;padding:16px;} h2{text-align:center;} table{width:100%;font-size:13px;} td{padding:3px 0;} .line{border-top:1px dashed #999;margin:8px 0;} .total{font-weight:bold;}</style>
      </head><body>
      <h2>Strobrie</h2>
      <div style="text-align:center;font-size:12px;">${new Date(sale.timestamp).toLocaleString()}<br/>Served by ${staffName(sale.staff_id)}${sale.voided ? " — VOIDED" : ""}</div>
      <div class="line"></div>
      <table>${rows}</table>
      <div class="line"></div>
      <table>
        <tr><td>Subtotal</td><td style="text-align:right;">${fmt(sale.subtotal)}</td></tr>
        ${sale.discount > 0 ? `<tr><td>Loyalty discount</td><td style="text-align:right;">-${fmt(sale.discount)}</td></tr>` : ""}
        <tr class="total"><td>Total</td><td style="text-align:right;">${fmt(sale.total)}</td></tr>
        <tr><td>${sale.payment_method}</td><td></td></tr>
      </table>
      <div class="line"></div>
      <script>window.print();<\/script>
      </body></html>
    `);
    win.document.close();
  }

  function exportSalesCSV() {
    const rows = [["Date", "Staff", "Payment", "Customer", "Subtotal", "Discount", "Total", "Points Earned", "Points Redeemed", "Voided"]];
    sales.forEach((s) =>
      rows.push([
        new Date(s.timestamp).toLocaleString(),
        staffName(s.staff_id),
        s.payment_method,
        customerName(s.customer_id),
        s.subtotal,
        s.discount,
        s.total,
        s.points_earned,
        s.points_redeemed,
        s.voided ? "yes" : "no",
      ]),
    );
    downloadCSV("strobrie-sales.csv", rows);
  }

  function exportWasteCSV() {
    const rows = [["Date", "Item", "Qty", "Unit", "Unit Cost", "Cost Impact", "Reason", "Staff", "Notes"]];
    waste.forEach((w) =>
      rows.push([
        new Date(w.timestamp).toLocaleString(),
        w.item_name,
        w.qty,
        w.unit,
        w.unit_cost,
        w.cost_impact,
        w.reason,
        staffName(w.staff_id),
        w.notes,
      ]),
    );
    downloadCSV("strobrie-waste.csv", rows);
  }

  return (
    <>
      <div className="metric-grid">
        <div className="metric-card">
          <div className="label">Today's sales</div>
          <div className="value">{fmt(todaysTotal)}</div>
        </div>
        <div className="metric-card">
          <div className="label">All-time sales</div>
          <div className="value">{fmt(allTimeTotal)}</div>
        </div>
        <div className="metric-card">
          <div className="label">Transactions</div>
          <div className="value">{validSales.length}</div>
        </div>
        <div className="metric-card">
          <div className="label">Waste cost logged</div>
          <div className="value">{fmt(wasteTotal)}</div>
        </div>
        <div className="metric-card">
          <div className="label">Loyalty customers</div>
          <div className="value">{customers.length}</div>
        </div>
      </div>

      <div className="panel">
        <h3>Sales by category</h3>
        {catEntries.length === 0 ? (
          <div className="empty-note">No sales recorded yet.</div>
        ) : (
          catEntries.map(([cat, amt]) => (
            <div className="bar-row" key={cat}>
              <div className="label">{cat}</div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${((amt / maxCat) * 100).toFixed(0)}%` }} />
              </div>
              <div className="amt">{fmt(amt)}</div>
            </div>
          ))
        )}
      </div>

      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>Recent sales (voids reverse loyalty &amp; inventory)</h3>
          <div>
            <button className="link-btn" onClick={exportSalesCSV}>
              Export sales CSV
            </button>
            <button className="link-btn" style={{ marginLeft: 12 }} onClick={exportWasteCSV}>
              Export waste CSV
            </button>
          </div>
        </div>
        {recentSales.length === 0 ? (
          <div className="empty-note">No sales recorded yet.</div>
        ) : (
          <table className="log-table">
            <thead>
              <tr>
                <th>Total</th>
                <th>Payment</th>
                <th>Customer</th>
                <th>Staff</th>
                <th>When</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {recentSales.map((s) => (
                <tr key={s.id} style={s.voided ? { opacity: 0.55, textDecoration: "line-through" } : undefined}>
                  <td>{fmt(s.total)}</td>
                  <td>{s.payment_method}</td>
                  <td>{customerName(s.customer_id)}</td>
                  <td>{staffName(s.staff_id)}</td>
                  <td>{new Date(s.timestamp).toLocaleString()}</td>
                  <td style={{ textDecoration: "none", whiteSpace: "nowrap" }}>
                    <button className="link-btn" onClick={() => printReceipt(s)}>
                      Receipt
                    </button>
                    {s.voided ? (
                      <span className="reason-tag" style={{ marginLeft: 8 }}>
                        Voided
                      </span>
                    ) : (
                      <button className="link-btn" style={{ marginLeft: 8, color: "var(--rust-dark)" }} onClick={() => handleVoid(s.id, s.total)}>
                        Void
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
