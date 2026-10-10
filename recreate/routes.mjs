// Recreate: 复现 src/routes.js 的路由表与 fallback
// 证据来源: evidence.json -> semantic_graph literal "/" "/profile" "/settings" @ src/routes.js:1
//                                          "not-found" @ src/routes.js:7

/** @typedef {{ view: string, title: string }} RouteEntry */

/** @type {Record<string, RouteEntry>} */
export const PROFILE_ROUTES = {
  "/": { view: "dashboard", title: "Dashboard" },
  "/profile": { view: "profile", title: "Profile" },
  "/settings": { view: "settings", title: "Settings" }
};

/** @type {RouteEntry} */
export const FALLBACK_ROUTE = { view: "not-found", title: "Not Found" };

/**
 * @param {string} rawPath
 * @returns {RouteEntry}
 */
export function resolveRoute(rawPath) {
  const normalized = typeof rawPath === "string" ? rawPath.split("?")[0] : "/";
  return PROFILE_ROUTES[normalized] || FALLBACK_ROUTE;
}
