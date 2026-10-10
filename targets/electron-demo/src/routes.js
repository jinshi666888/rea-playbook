const PROFILE_ROUTES = {
  "/": { view: "dashboard", title: "Dashboard" },
  "/profile": { view: "profile", title: "Profile" },
  "/settings": { view: "settings", title: "Settings" }
};

const FALLBACK_ROUTE = { view: "not-found", title: "Not Found" };

function resolveRoute(rawPath) {
  const normalized = typeof rawPath === "string" ? rawPath.split("?")[0] : "/";
  return PROFILE_ROUTES[normalized] || FALLBACK_ROUTE;
}

module.exports = { PROFILE_ROUTES, FALLBACK_ROUTE, resolveRoute };
