import { useEffect, useState } from "react";
import { NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import "./pos.css";
import { PosAuthProvider, usePosAuth } from "./PosAuthContext.jsx";
import { isFlowHost, posPath } from "./posBase.js";
import { useOrderAlerts } from "./useOrderAlerts.js";
import Login from "./pages/Login.jsx";
import ManageStaff from "./pages/ManageStaff.jsx";

const MAIN_SITE_URL = "https://strobrie.com";

function PosShell() {
  const { currentStaff, isManager, logout } = usePosAuth();
  const [showManageStaff, setShowManageStaff] = useState(false);
  const location = useLocation();
  const { unseenCount, markSeen } = useOrderAlerts(isManager);

  // Opening the Orders tab clears the badge — that's "seeing" the new ones.
  useEffect(() => {
    if (isManager && location.pathname.endsWith("/orders")) markSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, isManager]);

  if (!currentStaff) {
    return (
      <div className="pos-app">
        <div className="pos-shell">
          <Login />
        </div>
      </div>
    );
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
            <span className="role-tag">{currentStaff.role}</span>
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
          {isManager && <NavLink to={posPath("/products")}>Products</NavLink>}
          <NavLink to={posPath("/events")}>Events</NavLink>
          {isManager && (
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
          {isManager && <NavLink to={posPath("/reports")}>Reports</NavLink>}
        </nav>

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

export default function PosLayout() {
  return (
    <PosAuthProvider>
      <PosShell />
    </PosAuthProvider>
  );
}
