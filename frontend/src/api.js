const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail || `Request to ${path} failed (${res.status})`);
  }

  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  getMenu: () => request("/api/shop/products"),
  getEvents: () => request("/api/events"),
  createRsvp: (eventId, data) =>
    request(`/api/events/${eventId}/rsvps`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  createContactMessage: (data) =>
    request("/api/contact", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  createBookingRequest: (data) =>
    request("/api/bookings", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Ticketed events (paid — Breakfast & Yoga etc.), separate from the free
  // RSVP events above.
  getTicketedEvents: () => request("/api/ticketed-events"),
  buyTicket: (eventId, data) =>
    request(`/api/ticketed-events/${eventId}/buy`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  verifyTicket: (reference) => request(`/api/ticketed-events/tickets/verify/${reference}`),
};
