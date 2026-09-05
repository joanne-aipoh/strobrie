// When this app is served from flow.strobrie.com (or flow.<anything>, e.g. a
// staging subdomain), the Flow routes are mounted at "/" instead of "/pos"
// so the subdomain gets clean URLs. Everywhere a Flow page links to another
// Flow page, use posPath() instead of hardcoding "/pos/...".
export const isFlowHost = typeof window !== "undefined" && window.location.hostname.split(".")[0] === "flow";

export const posBase = isFlowHost ? "" : "/pos";

export function posPath(path = "/") {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${posBase}${normalized}` || "/";
}
