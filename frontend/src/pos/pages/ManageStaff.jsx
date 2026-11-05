import { useState } from "react";
import { usePosAuth } from "../PosAuthContext.jsx";
import { posApi } from "../posApi.js";

function roleLabel(role) {
  return role === "front_desk" ? "front desk" : role;
}

export default function ManageStaff() {
  const { staffList, currentStaff, refreshStaffList } = usePosAuth();
  const [name, setName] = useState("");
  const [role, setRole] = useState("staff");
  const [error, setError] = useState("");
  // Per-row name drafts while a manager is editing a teammate's name.
  const [nameDrafts, setNameDrafts] = useState({});
  // Shown once after a create/reset so the manager can read out the temp PIN.
  const [issued, setIssued] = useState(null); // { name, pin }

  async function addStaff() {
    if (!name.trim()) {
      setError("Enter a name.");
      return;
    }
    try {
      const created = await posApi.addStaff({ name: name.trim(), role });
      await refreshStaffList();
      setIssued({ name: created.name, pin: created.temp_pin });
      setName("");
      setRole("staff");
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  async function resetPin(id, staffName) {
    if (!window.confirm(`Reset ${staffName}'s PIN? They'll get a new temporary PIN and must set their own next login.`)) return;
    try {
      const res = await posApi.resetPin(id);
      await refreshStaffList();
      setIssued({ name: staffName, pin: res.temp_pin });
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeStaff(id) {
    if (id === currentStaff.id) {
      setError("You can't remove the account you're logged in as.");
      return;
    }
    await posApi.removeStaff(id);
    await refreshStaffList();
  }

  async function changeRole(id, newRole) {
    try {
      await posApi.setStaffRole(id, newRole);
      await refreshStaffList();
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  async function commitName(id, current) {
    const draft = (nameDrafts[id] ?? "").trim();
    // Nothing to do if unchanged or the field was emptied.
    if (!draft || draft === current) {
      setNameDrafts((d) => {
        const next = { ...d };
        delete next[id];
        return next;
      });
      return;
    }
    try {
      await posApi.renameStaff(id, draft);
      await refreshStaffList();
      setNameDrafts((d) => {
        const next = { ...d };
        delete next[id];
        return next;
      });
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="panel">
      <h3>Staff accounts</h3>

      {issued && (
        <div
          className="panel"
          style={{ background: "var(--sand, #fdf6ec)", border: "1px solid var(--rust, #c2773f)", marginBottom: 12 }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Temporary PIN for {issued.name}</div>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: 4, fontVariantNumeric: "tabular-nums" }}>
            {issued.pin}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 4 }}>
            Give this to {issued.name}. They'll be asked to set their own PIN on first login. This won't be shown again.
          </div>
          <button className="link-btn" style={{ marginTop: 8 }} onClick={() => setIssued(null)}>
            Done
          </button>
        </div>
      )}

      {(staffList || []).map((s) => (
        <div className="staff-row" key={s.id}>
          <span>
            <input
              className="staff-name-input"
              value={nameDrafts[s.id] ?? s.name}
              onChange={(e) => setNameDrafts((d) => ({ ...d, [s.id]: e.target.value }))}
              onBlur={() => commitName(s.id, s.name)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.target.blur();
                if (e.key === "Escape") {
                  setNameDrafts((d) => {
                    const next = { ...d };
                    delete next[s.id];
                    return next;
                  });
                  e.target.blur();
                }
              }}
              aria-label={`Name for ${s.name}`}
            />
            {s.id === currentStaff.id ? (
              <span className="role-tag" style={{ marginLeft: 6 }}>{roleLabel(s.role)}</span>
            ) : (
              <select
                value={s.role}
                onChange={(e) => changeRole(s.id, e.target.value)}
                style={{ marginLeft: 8, fontSize: 12, padding: "2px 6px" }}
                title="Change role"
              >
                <option value="staff">Staff</option>
                <option value="front_desk">Front desk</option>
                <option value="manager">Manager</option>
              </select>
            )}
            {s.must_change_pin && (
              <span style={{ marginLeft: 6, fontSize: 11, color: "var(--rust-dark, #a2531f)" }}>
                · PIN not set yet
              </span>
            )}
          </span>
          <span style={{ display: "flex", gap: 10 }}>
            <button className="link-btn" onClick={() => resetPin(s.id, s.name)}>
              Reset PIN
            </button>
            {s.id !== currentStaff.id && (
              <button className="link-btn" onClick={() => removeStaff(s.id)}>
                Remove
              </button>
            )}
          </span>
        </div>
      ))}

      <div className="form-grid" style={{ marginTop: 14 }}>
        <div className="form-field">
          <label>Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
        </div>
        <div className="form-field">
          <label>Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="staff">Staff</option>
            <option value="front_desk">Front desk</option>
            <option value="manager">Manager</option>
          </select>
        </div>
      </div>
      <p style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 6 }}>
        Tap a name to rename someone, or use the dropdown to change their role.
        <br />
        New staff get an auto-generated temporary PIN (shown once here) and set their own on first login.
        <br />
        <strong>Staff</strong>: till, tabs, loyalty, waste, event tickets. <strong>Front desk</strong>: + orders,
        products, events &amp; reports. <strong>Manager</strong>: everything, incl. staff admin &amp; voids.
      </p>
      {error && <div className="error-text">{error}</div>}
      <button className="log-btn" onClick={addStaff}>
        Add staff member
      </button>
    </div>
  );
}
