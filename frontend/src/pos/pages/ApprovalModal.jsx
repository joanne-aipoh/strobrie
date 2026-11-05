import { useState } from "react";
import { posApi } from "../posApi.js";

// A front-desk/manager PIN gate shown when a staff member tries to do something
// restricted on a tab (close it, or reduce its total). The approver picks their
// name and enters their PIN; it's verified without changing who's logged in.
export default function ApprovalModal({ actionLabel, approvers, onApprove, onCancel }) {
  const [approverId, setApproverId] = useState(approvers.length === 1 ? approvers[0].id : null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!approverId) {
      setError("Select who's approving.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const staff = await posApi.login(approverId, pin);
      if (staff.role !== "manager" && staff.role !== "front_desk") {
        setError("That account can't approve this — front desk or manager only.");
        setBusy(false);
        return;
      }
      onApprove(staff);
    } catch {
      setError("Incorrect PIN.");
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(43,29,34,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
      onClick={onCancel}
    >
      <div
        className="panel"
        style={{ maxWidth: 380, width: "100%", margin: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginTop: 0 }}>Approval needed</h3>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 0 }}>
          A front desk or manager must approve to {actionLabel}.
        </p>

        {approvers.length === 0 ? (
          <div className="error-text">No front desk or manager is set up to approve.</div>
        ) : (
          <>
            <div className="form-field" style={{ marginBottom: 10 }}>
              <label>Approved by</label>
              <div className="staff-picker" style={{ justifyContent: "flex-start", marginBottom: 0 }}>
                {approvers.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className={`staff-btn ${approverId === a.id ? "selected" : ""}`}
                    onClick={() => {
                      setApproverId(a.id);
                      setError("");
                    }}
                  >
                    {a.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-field">
              <label>Their PIN</label>
              <input
                type="password"
                inputMode="numeric"
                value={pin}
                autoFocus
                onChange={(e) => setPin(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="••••"
              />
            </div>
            {error && <div className="error-text">{error}</div>}
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button className="log-btn" style={{ marginTop: 0 }} disabled={busy} onClick={submit}>
                {busy ? "Checking…" : "Approve"}
              </button>
              <button className="link-btn" onClick={onCancel}>
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
