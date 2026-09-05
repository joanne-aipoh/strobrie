const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail = Array.isArray(body?.detail) ? body.detail[0]?.msg : body?.detail;
    throw new Error(detail || `Request to ${path} failed (${res.status})`);
  }

  if (res.status === 204) return null;
  return res.json();
}

export const posApi = {
  // staff / auth
  listStaff: () => request("/api/pos/staff"),
  setupFirstManager: (data) => request("/api/pos/staff/setup", { method: "POST", body: JSON.stringify(data) }),
  addStaff: (data) => request("/api/pos/staff", { method: "POST", body: JSON.stringify(data) }),
  removeStaff: (id) => request(`/api/pos/staff/${id}`, { method: "DELETE" }),
  login: (staffId, pin) =>
    request("/api/pos/staff/login", { method: "POST", body: JSON.stringify({ staff_id: staffId, pin }) }),

  // sales
  charge: (data) => request("/api/pos/sales", { method: "POST", body: JSON.stringify(data) }),
  listSales: () => request("/api/pos/sales"),
  voidSale: (id, staffId) =>
    request(`/api/pos/sales/${id}/void`, { method: "POST", body: JSON.stringify({ staff_id: staffId }) }),

  // customers
  listCustomers: (search) => request(`/api/pos/customers${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  lookupCustomer: (phone) => request(`/api/pos/customers/lookup?phone=${encodeURIComponent(phone)}`),
  createCustomer: (data) => request("/api/pos/customers", { method: "POST", body: JSON.stringify(data) }),

  // waste
  listWaste: () => request("/api/pos/waste"),
  logWaste: (data) => request("/api/pos/waste", { method: "POST", body: JSON.stringify(data) }),

  // inventory & recipes
  listInventory: () => request("/api/pos/inventory"),
  restock: (id, qty) => request(`/api/pos/inventory/${id}/restock`, { method: "POST", body: JSON.stringify({ qty }) }),
  getRecipe: (menuItemId) => request(`/api/pos/recipes/${menuItemId}`),
  setRecipe: (menuItemId, lines) =>
    request(`/api/pos/recipes/${menuItemId}`, { method: "PUT", body: JSON.stringify({ lines }) }),

  // ticketed events
  listEvents: () => request("/api/pos/events"),
  getEvent: (id) => request(`/api/pos/events/${id}`),
  createEvent: (data) => request("/api/pos/events", { method: "POST", body: JSON.stringify(data) }),
  listTickets: (eventId) => request(`/api/pos/events/${eventId}/tickets`),
  sellTicket: (eventId, data) =>
    request(`/api/pos/events/${eventId}/tickets`, { method: "POST", body: JSON.stringify(data) }),
  checkinTicket: (ticketId) => request(`/api/pos/tickets/${ticketId}/checkin`, { method: "POST" }),
  collectAndCheckin: (ticketId, staffId, paymentMethod) =>
    request(`/api/pos/tickets/${ticketId}/collect-and-checkin`, {
      method: "POST",
      body: JSON.stringify({ staff_id: staffId, payment_method: paymentMethod }),
    }),
};
