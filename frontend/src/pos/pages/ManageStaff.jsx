import { useState } from "react";
import { usePosAuth } from "../PosAuthContext.jsx";
import { posApi } from "../posApi.js";

export default function ManageStaff() {
  const { staffList, currentStaff, refreshStaffList } = usePosAuth();
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [role, setRole] = useState("staff");
  const [error, setError] = useState("");

  async function addStaff() {
    if (!name.trim()) {
      setError("Enter a name.");
      return;
    }
    if (!/^\d{4,6}$/.test(pin)) {
      setError("PIN must be 4-6 digits.");
      return;
    }
    try {
      await posApi.addStaff({ name: name.trim(), pin, role });
      await refreshStaffList();
      setName("");
      setPin("");
      setRole("staff");
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

  return (
    <div className="panel">
      <h3>Staff accounts</h3>
      {(staffList || []).map((s) => (
        <div className="staff-row" key={s.id}>
          <span>
            {s.name} <span className="role-tag" style={{ marginLeft: 6 }}>{s.role}</span>
          </span>
          <button className="link-btn" onClick={() => removeStaff(s.id)}>
            Remove
          </button>
        </div>
      ))}
      <div className="form-grid" style={{ marginTop: 14 }}>
        <div className="form-field">
          <label>Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
        </div>
        <div className="form-field">
          <label>PIN (4-6 digits)</label>
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="e.g. 1234"
          />
        </div>
        <div className="form-field">
          <label>Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="staff">Staff</option>
            <option value="manager">Manager</option>
          </select>
        </div>
      </div>
      {error && <div className="error-text">{error}</div>}
      <button className="log-btn" onClick={addStaff}>
        Add staff member
      </button>
    </div>
  );
}
