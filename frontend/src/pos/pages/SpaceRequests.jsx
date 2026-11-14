import { useEffect, useState } from "react";
import { posApi } from "../posApi.js";

function titleize(s) {
  return (s || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

const STAGES = [
  { key: "new", label: "New", bg: "#fde4d0", color: "#b3500a" },
  { key: "contacted", label: "Contacted", bg: "#dfeaf7", color: "#1d4f8c" },
  { key: "quote_sent", label: "Quote sent", bg: "#e7defb", color: "#5a37a8" },
  { key: "confirmed", label: "Confirmed", bg: "#dff0e0", color: "#1e7d34" },
  { key: "declined", label: "Declined", bg: "#f7dede", color: "#9c2626" },
];

export default function SpaceRequests() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    posApi
      .spaceRequests()
      .then(setRows)
      .catch((e) => setError(e.message));
  }, []);

  const [confirmingId, setConfirmingId] = useState(null);

  async function changeStatus(id, status) {
    try {
      const updated = await posApi.setSpaceRequestStatus(id, status);
      setRows((rows) => rows.map((r) => (r.id === id ? updated : r)));
      window.dispatchEvent(new Event("space-requests-changed")); // refresh the nav badge now
    } catch (e) {
      setError(e.message);
    }
  }

  async function remove(id) {
    try {
      await posApi.deleteSpaceRequest(id);
      setRows((rows) => rows.filter((r) => r.id !== id));
      setConfirmingId(null);
      window.dispatchEvent(new Event("space-requests-changed"));
    } catch (e) {
      setError(e.message);
    }
  }

  if (error) return <div className="panel"><div className="error-text">{error}</div></div>;
  if (!rows) return <p>Loading&hellip;</p>;

  return (
    <div className="panel">
      <h3>Space-rental inquiries ({rows.length})</h3>
      <p style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: -6 }}>
        Submitted from the website's "Rent our space" form. Newest first.
      </p>
      {rows.length === 0 ? (
        <div className="empty-note">No inquiries yet.</div>
      ) : (
        rows.map((r) => (
          <div
            key={r.id}
            className="panel"
            style={{ background: "var(--cream-2)", marginBottom: 10, boxShadow: "none" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <strong style={{ fontSize: 15 }}>{r.name}</strong>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>
                  received {new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </span>
                {(() => {
                  const st = STAGES.find((s) => s.key === r.status) || STAGES[0];
                  return (
                    <select
                      value={r.status || "new"}
                      onChange={(e) => changeStatus(r.id, e.target.value)}
                      style={{ background: st.bg, color: st.color, border: "none", borderRadius: 999, padding: "5px 10px", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}
                    >
                      {STAGES.map((s) => (
                        <option key={s.key} value={s.key} style={{ background: "#fff", color: "var(--ink)" }}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  );
                })()}
              </div>
            </div>
            <div style={{ fontSize: 13.5, marginTop: 4 }}>
              <a href={`mailto:${r.email}`} style={{ color: "var(--rust-dark)" }}>{r.email}</a>
              {r.phone && (
                <>
                  {" · "}
                  <a href={`tel:${r.phone}`} style={{ color: "var(--rust-dark)" }}>{r.phone}</a>
                </>
              )}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 18px", marginTop: 8, fontSize: 13.5 }}>
              <span><span style={{ color: "var(--ink-soft)" }}>Space:</span> <strong>{titleize(r.space)}</strong></span>
              <span><span style={{ color: "var(--ink-soft)" }}>Event:</span> {titleize(r.event_type)}</span>
              <span><span style={{ color: "var(--ink-soft)" }}>Guests:</span> {r.guest_count}</span>
              {r.spend != null && (
                <span>
                  <span style={{ color: "var(--ink-soft)" }}>Booking:</span>{" "}
                  <strong>{r.spend > 0 ? `Dining spend ₦${r.spend.toLocaleString("en-NG")} (free venue)` : "Space rental only"}</strong>
                </span>
              )}
              <span><span style={{ color: "var(--ink-soft)" }}>Preferred:</span> <strong style={{ color: "var(--rust-dark)" }}>{fmtDate(r.preferred_date)}</strong></span>
            </div>
            {r.notes && (
              <div style={{ fontSize: 13, color: "var(--rust-dark)", marginTop: 6 }}>Notes: “{r.notes}”</div>
            )}
            <div style={{ marginTop: 8, textAlign: "right" }}>
              {confirmingId === r.id ? (
                <span style={{ fontSize: 12.5 }}>
                  Delete this inquiry?{" "}
                  <button className="link-btn" style={{ color: "var(--danger)", fontWeight: 700 }} onClick={() => remove(r.id)}>
                    Yes, delete
                  </button>
                  {"   "}
                  <button className="link-btn" onClick={() => setConfirmingId(null)}>
                    Cancel
                  </button>
                </span>
              ) : (
                <button className="link-btn" style={{ color: "var(--ink-soft)" }} onClick={() => setConfirmingId(r.id)}>
                  Delete
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
