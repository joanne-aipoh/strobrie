import { useState } from "react";
import { usePosAuth } from "../PosAuthContext.jsx";

function FirstRunSetup() {
  const { setupFirstManager } = usePosAuth();
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Enter your name.");
      return;
    }
    if (!/^\d{4,6}$/.test(pin)) {
      setError("PIN must be 4-6 digits.");
      return;
    }
    try {
      await setupFirstManager(name.trim(), pin);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="login-wrap">
      <h1>Flow</h1>
      <div className="sub">by Strobrie — set up the first manager account</div>
      <form className="panel" onSubmit={handleSubmit}>
        <div className="form-field" style={{ marginBottom: 12 }}>
          <label>Your name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Joanne" />
        </div>
        <div className="form-field" style={{ marginBottom: 12 }}>
          <label>Choose a 4-6 digit PIN</label>
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="e.g. 4821"
          />
        </div>
        {error && <div className="error-text" style={{ marginBottom: 10 }}>{error}</div>}
        <button type="submit" className="log-btn" style={{ width: "100%" }}>
          Create manager account
        </button>
      </form>
    </div>
  );
}

function StaffPicker({ staffList }) {
  const { login } = usePosAuth();
  const [targetId, setTargetId] = useState(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  function selectTarget(id) {
    setTargetId(id);
    setPin("");
    setError("");
  }

  async function submitPin() {
    try {
      await login(targetId, pin);
    } catch (err) {
      setError("Incorrect PIN. Try again.");
      setPin("");
    }
  }

  return (
    <div className="login-wrap">
      <h1>Flow</h1>
      <div className="sub">by Strobrie — select your name to log in</div>
      <div className="staff-picker">
        {staffList.map((s) => (
          <button
            key={s.id}
            className={`staff-btn ${targetId === s.id ? "selected" : ""}`}
            onClick={() => selectTarget(s.id)}
          >
            {s.name}
          </button>
        ))}
      </div>
      {targetId && (
        <div className="pin-entry">
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitPin()}
            placeholder="PIN"
            autoFocus
          />
          {error && <div className="error-text">{error}</div>}
          <button className="log-btn" onClick={submitPin}>
            Unlock
          </button>
        </div>
      )}
    </div>
  );
}

export default function Login() {
  const { staffList } = usePosAuth();

  if (staffList === null) return <div className="login-wrap">Loading&hellip;</div>;
  if (staffList.length === 0) return <FirstRunSetup />;
  return <StaffPicker staffList={staffList} />;
}
