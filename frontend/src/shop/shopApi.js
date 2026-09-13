const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

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

export function photoUrl(path) {
  return `${API_BASE}${path}`;
}

export const shopApi = {
  listProducts: () => request("/api/shop/products"),
  getProduct: (id) => request(`/api/shop/products/${id}`),
  checkout: (data) => request("/api/shop/checkout", { method: "POST", body: JSON.stringify(data) }),
  verifyOrder: (reference) => request(`/api/shop/orders/verify/${reference}`),
  lookupLoyaltyPoints: (phone) => request(`/api/shop/loyalty/points?phone=${encodeURIComponent(phone)}`),
  boxFlavors: (productId) => request(`/api/shop/products/${productId}/box-flavors`),
  getSettings: () => request("/api/shop/settings"),
  updateSettings: (data) => request("/api/shop/admin/settings", { method: "PUT", body: JSON.stringify(data) }),

  // admin (Flow Products tab)
  adminListProducts: () => request("/api/shop/admin/products"),
  createProduct: (data) => request("/api/shop/admin/products", { method: "POST", body: JSON.stringify(data) }),
  updateProduct: (id, data) => request(`/api/shop/admin/products/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteProduct: (id) => request(`/api/shop/admin/products/${id}`, { method: "DELETE" }),
  restockProduct: (id, qty) =>
    request(`/api/shop/admin/products/${id}/restock`, { method: "POST", body: JSON.stringify({ qty }) }),
  uploadPhoto: async (productId, file) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_BASE}/api/shop/admin/products/${productId}/photos`, { method: "POST", body: form });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.detail || `Photo upload failed (${res.status})`);
    }
    return res.json();
  },
  deletePhoto: (photoId) => request(`/api/shop/admin/photos/${photoId}`, { method: "DELETE" }),
  reorderPhotos: (productId, photoIdsInOrder) =>
    request(`/api/shop/admin/products/${productId}/photos/reorder`, {
      method: "PUT",
      body: JSON.stringify({ photo_ids_in_order: photoIdsInOrder }),
    }),
  adminListOrders: () => request("/api/shop/admin/orders"),
  updateOrderStatus: (orderId, status) =>
    request(`/api/shop/admin/orders/${orderId}/status`, { method: "PUT", body: JSON.stringify({ status }) }),
};
