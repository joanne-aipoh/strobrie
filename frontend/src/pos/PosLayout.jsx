import { useState } from "react";
import { NavLink, Navigate, Outlet } from "react-router-dom";
import "./pos.css";
import { PosAuthProvider, usePosAuth } from "./PosAuthContext.jsx";
import { isFlowHost, posPath } from "./posBase.js";
import Login from "./pages/Login.jsx";
import ManageStaff from "./pages/ManageStaff.jsx";

const MAIN_SITE_URL = "https://strobrie.com";

function PosShell() {
  const { currentStaff, isManager, logout } = usePosAuth();
  const [showManageStaff, setShowManageStaff] = useState(false);

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
          <NavLink to={posPath("/waste")}>Waste log</NavLink>
          <NavLink to={posPath("/customers")}>Customers</NavLink>
          <NavLink to={posPath("/events")}>Events</NavLink>
          {isManager && <NavLink to={posPath("/inventory")}>Inventory</NavLink>}
          {isManager && <NavLink to={posPath("/products")}>Products</NavLink>}
          {isManager && <NavLink to={posPath("/orders")}>Orders</NavLink>}
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
