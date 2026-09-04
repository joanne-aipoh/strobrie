// When this app is served from shop.strobrie.com (or shop.<anything>, e.g. a
// staging subdomain), the shop routes are mounted at "/" instead of "/shop"
// so the subdomain gets clean URLs. Everywhere a shop page links to another
// shop page, use shopPath() instead of hardcoding "/shop/...".
export const isShopHost = typeof window !== "undefined" && window.location.hostname.split(".")[0] === "shop";

export const shopBase = isShopHost ? "" : "/shop";

export function shopPath(path = "/") {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${shopBase}${normalized}` || "/";
}

export function shopOrigin() {
  return `${window.location.origin}${shopBase}`;
}
