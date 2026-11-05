// When this app is served from flow.strobrie.com (or flow.<anything>, e.g. a
// staging subdomain), the Flow routes are mounted at "/" instead of "/pos"
// so the subdomain gets clean URLs. Everywhere a Flow page links to another
// Flow page, use posPath() instead of hardcoding "/pos/...".
export const isFlowHost = typeof window !== "undefined" && window.location.hostname.split(".")[0] === "flow";

export const posBase = isFlowHost ? "" : "/pos";

// The public online shop is paused (behind a maintenance page), so no online
// orders come in. Hide Flow's "Orders" queue and stop polling for new orders
// until the shop is live again — flip this back to true to restore it.
export const ordersEnabled = false;

export function posPath(path = "/") {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${posBase}${normalized}` || "/";
}
