import { useEffect, useState } from "react";
import { NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import "./pos.css";
import { PosAuthProvider, usePosAuth } from "./PosAuthContext.jsx";
import { isFlowHost, posPath, ordersEnabled } from "./posBase.js";
import { useOrderAlerts } from "./useOrderAlerts.js";
import Login from "./pages/Login.jsx";
import ManageStaff from "./pages/ManageStaff.jsx";
import { ChangePinForm, ForcePinChange } from "./pages/ChangePin.jsx";
import OfflineBar from "./OfflineBar.jsx";

const MAIN_SITE_URL = "https://strobrie.com";

function roleLabel(role) {
  return role === "front_desk" ? "front desk" : role;
}

function PosShell() {
  const { currentStaff, isManager, canManageOps, logout } = usePosAuth();
  const [showManageStaff, setShowManageStaff] = useState(false);
  const [showChangePin, setShowChangePin] = useState(false);
  const location = useLocation();
  const { unseenCount, markSeen } = useOrderAlerts(canManageOps && ordersEnabled);

  // Opening the Orders tab clears the badge — that's "seeing" the new ones.
  useEffect(() => {
    if (canManageOps && ordersEnabled && location.pathname.endsWith("/orders")) markSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, canManageOps]);

  if (!currentStaff) {
    return (
      <div className="pos-app">
        <div className="pos-shell">
          <Login />
        </div>
      </div>
    );
  }

  // New hires (and manager-reset accounts) must set their own PIN before they
  // can use anything else.
  if (currentStaff.must_change_pin) {
    return <ForcePinChange />;
  }

  return (
    <div className="pos-app">
      <div className="pos-shell">
        <header className="top">
          <div className="brand">
            <h1>Flow</h1>
            <span>by Strobrie</span>
          </div>
          <div className="header-user">
            <span>{currentStaff.name}</span>
            <span className="role-tag">{roleLabel(currentStaff.role)}</span>
            <button className="link-btn" onClick={() => setShowChangePin((v) => !v)}>
              {showChangePin ? "Close" : "Change PIN"}
            </button>
            {isManager && (
              <button className="link-btn" onClick={() => setShowManageStaff((v) => !v)}>
                {showManageStaff ? "Hide staff admin" : "Manage staff"}
              </button>
            )}
            <button className="link-btn" onClick={logout}>
              Switch user
            </button>
            {isFlowHost && (
              <a className="link-btn" href={MAIN_SITE_URL}>
                Main Site
              </a>
            )}
          </div>
        </header>

        <nav className="tabs">
          <NavLink to={posPath("/sell")}>Sell</NavLink>
          <NavLink to={posPath("/customers")}>Customer Loyalty</NavLink>
          {canManageOps && <NavLink to={posPath("/products")}>Products</NavLink>}
          <NavLink to={posPath("/events")}>Events</NavLink>
          {canManageOps && ordersEnabled && (
            <NavLink to={posPath("/orders")} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              Orders
              {unseenCount > 0 && (
                <span
                  style={{
                    background: "var(--rust)",
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 700,
                    lineHeight: 1,
                    padding: "3px 6px",
                    borderRadius: 999,
                    minWidth: 18,
                    textAlign: "center",
                  }}
                >
                  {unseenCount}
                </span>
              )}
            </NavLink>
          )}
          {canManageOps && <NavLink to={posPath("/reports")}>Reports</NavLink>}
        </nav>

        <OfflineBar />

        {showChangePin && (
          <ChangePinForm onDone={() => setShowChangePin(false)} onCancel={() => setShowChangePin(false)} />
        )}
        {showManageStaff && isManager && <ManageStaff />}

        <Outlet />
      </div>
    </div>
  );
}

function RequireManager({ children }) {
  const { isManager } = usePosAuth();
  if (!isManager) return <Navigate to={posPath("/sell")} replace />;
  return children;
}

export function PosManagerRoute({ children }) {
  return <RequireManager>{children}</RequireManager>;
}

// Front-desk-or-manager areas (orders, products, inventory, reports). Staff are
// bounced back to the till.
export function PosOpsRoute({ children }) {
  const { canManageOps } = usePosAuth();
  if (!canManageOps) return <Navigate to={posPath("/sell")} replace />;
  return children;
}

export default function PosLayout() {
  // Nothing else sets a title, so every route inherited index.html's — the
  // cafe's marketing one. Staff often have the public site open in another
  // tab, and both read the same. Restored on the way out so navigating back
  // to the site doesn't leave the till's title behind.
  useEffect(() => {
    const previous = document.title;
    document.title = "Flow — Strobriē";
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <PosAuthProvider>
      <PosShell />
    </PosAuthProvider>
  );
}
