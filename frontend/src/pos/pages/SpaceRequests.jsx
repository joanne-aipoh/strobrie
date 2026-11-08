import { useEffect, useState } from "react";
import { posApi } from "../posApi.js";

function titleize(s) {
  return (s || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

export default function SpaceRequests() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    posApi
      .spaceRequests()
      .then(setRows)
      .catch((e) => setError(e.message));
  }, []);

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
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <strong style={{ fontSize: 15 }}>{r.name}</strong>
              <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>
                received {new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              </span>
            </div>
            <div style={{ fontSize: 13.5, marginTop: 4 }}>
              <a href={`mailto:${r.email}`} style={{ color: "var(--rust-dark)" }}>{r.email}</a>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 18px", marginTop: 8, fontSize: 13.5 }}>
              <span><span style={{ color: "var(--ink-soft)" }}>Space:</span> <strong>{titleize(r.space)}</strong></span>
              <span><span style={{ color: "var(--ink-soft)" }}>Event:</span> {titleize(r.event_type)}</span>
              <span><span style={{ color: "var(--ink-soft)" }}>Guests:</span> {r.guest_count}</span>
              <span><span style={{ color: "var(--ink-soft)" }}>Preferred:</span> <strong style={{ color: "var(--rust-dark)" }}>{fmtDate(r.preferred_date)}</strong></span>
            </div>
            {r.notes && (
              <div style={{ fontSize: 13, color: "var(--rust-dark)", marginTop: 6 }}>Notes: “{r.notes}”</div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
