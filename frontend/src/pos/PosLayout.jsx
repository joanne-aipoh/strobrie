import { useState } from "react";
import { NavLink, Navigate, Outlet } from "react-router-dom";
import "./pos.css";
import { PosAuthProvider, usePosAuth } from "./PosAuthContext.jsx";
import Login from "./pages/Login.jsx";
import ManageStaff from "./pages/ManageStaff.jsx";

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
          </div>
        </header>

        <nav className="tabs">
          <NavLink to="/pos/sell">Sell</NavLink>
          <NavLink to="/pos/waste">Waste log</NavLink>
          <NavLink to="/pos/customers">Customers</NavLink>
          <NavLink to="/pos/events">Events</NavLink>
          {isManager && <NavLink to="/pos/inventory">Inventory</NavLink>}
          {isManager && <NavLink to="/pos/reports">Reports</NavLink>}
        </nav>

        {showManageStaff && isManager && <ManageStaff />}

        <Outlet />
      </div>
    </div>
  );
}

function RequireManager({ children }) {
  const { isManager } = usePosAuth();
  if (!isManager) return <Navigate to="/pos/sell" replace />;
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
