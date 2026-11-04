import { createContext, useContext, useEffect, useState } from "react";
import { posApi } from "./posApi.js";

const STORAGE_KEY = "strobrie-pos-staff";
const PosAuthContext = createContext(null);

export function PosAuthProvider({ children }) {
  const [staffList, setStaffList] = useState(null);
  const [currentStaff, setCurrentStaff] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  async function refreshStaffList() {
    const list = await posApi.listStaff();
    setStaffList(list);
    return list;
  }

  useEffect(() => {
    refreshStaffList().catch(() => setStaffList([]));
  }, []);

  function persist(staff) {
    setCurrentStaff(staff);
    try {
      if (staff) localStorage.setItem(STORAGE_KEY, JSON.stringify(staff));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // localStorage unavailable — session just won't survive a refresh
    }
  }

  async function login(staffId, pin) {
    const staff = await posApi.login(staffId, pin);
    persist(staff);
    return staff;
  }

  async function setupFirstManager(name, pin) {
    const staff = await posApi.setupFirstManager({ name, pin });
    await refreshStaffList();
    persist(staff);
    return staff;
  }

  // Self-service PIN change (also used for the forced change on first login).
  // On success the stored session is updated so the forced-change gate clears.
  async function changePin(currentPin, newPin) {
    const staff = await posApi.changePin(currentStaff.id, currentPin, newPin);
    persist(staff);
    return staff;
  }

  function logout() {
    persist(null);
  }

  const role = currentStaff?.role;
  const value = {
    staffList,
    currentStaff,
    isManager: role === "manager",
    // Front desk sits above staff: it gets the operational areas (orders,
    // products, events, reports) but not staff admin or voids.
    canManageOps: role === "manager" || role === "front_desk",
    refreshStaffList,
    login,
    logout,
    setupFirstManager,
    changePin,
  };

  return <PosAuthContext.Provider value={value}>{children}</PosAuthContext.Provider>;
}

export function usePosAuth() {
  const ctx = useContext(PosAuthContext);
  if (!ctx) throw new Error("usePosAuth must be used within PosAuthProvider");
  return ctx;
}
