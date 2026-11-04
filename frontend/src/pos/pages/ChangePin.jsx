import { useState } from "react";
import { usePosAuth } from "../PosAuthContext.jsx";

const PIN_RE = /^\d{4,6}$/;

// Shared PIN-change form. `forced` tweaks the copy for the first-login case
// where the "current" PIN is the temporary one the manager handed over.
export function ChangePinForm({ forced = false, onDone, onCancel }) {
  const { changePin } = usePosAuth();
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!PIN_RE.test(newPin)) {
      setError("New PIN must be 4-6 digits.");
      return;
    }
    if (newPin !== confirmPin) {
      setError("The new PINs don't match.");
      return;
    }
    if (newPin === currentPin) {
      setError("Your new PIN must be different from the current one.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await changePin(currentPin, newPin);
      onDone?.();
    } catch (err) {
      setError(err.message || "Couldn't change the PIN.");
      setBusy(false);
    }
  }

  return (
    <form className="panel" onSubmit={submit}>
      <div className="form-field" style={{ marginBottom: 12 }}>
        <label>{forced ? "Temporary PIN" : "Current PIN"}</label>
        <input
          type="password"
          inputMode="numeric"
          value={currentPin}
          onChange={(e) => setCurrentPin(e.target.value)}
          placeholder={forced ? "The PIN you were given" : "Your current PIN"}
          autoFocus
        />
      </div>
      <div className="form-field" style={{ marginBottom: 12 }}>
        <label>New PIN (4-6 digits)</label>
        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={newPin}
          onChange={(e) => setNewPin(e.target.value)}
          placeholder="Choose a new PIN"
        />
      </div>
      <div className="form-field" style={{ marginBottom: 12 }}>
        <label>Confirm new PIN</label>
        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={confirmPin}
          onChange={(e) => setConfirmPin(e.target.value)}
          placeholder="Re-enter the new PIN"
        />
      </div>
      {error && <div className="error-text" style={{ marginBottom: 10 }}>{error}</div>}
      <div style={{ display: "flex", gap: 10 }}>
        <button type="submit" className="log-btn" disabled={busy}>
          {busy ? "Saving…" : "Set new PIN"}
        </button>
        {!forced && onCancel && (
          <button type="button" className="link-btn" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

// Full-screen gate shown right after login when a staff member must set their
// own PIN (new hire, or a manager-reset account).
export function ForcePinChange() {
  const { currentStaff, logout } = usePosAuth();
  return (
    <div className="pos-app">
      <div className="pos-shell">
        <div className="login-wrap">
          <h1>Flow</h1>
          <div className="sub">
            Welcome, {currentStaff.name} — set your own PIN to continue
          </div>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", maxWidth: 360, margin: "0 auto 14px" }}>
            You're signed in with a temporary PIN. Choose a personal PIN now — you'll use it every time you log in.
          </p>
          <ChangePinForm forced />
          <button className="link-btn" style={{ marginTop: 12 }} onClick={logout}>
            Cancel and switch user
          </button>
        </div>
      </div>
    </div>
  );
}
