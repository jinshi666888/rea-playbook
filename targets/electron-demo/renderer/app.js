const VIEW_IDS = {
  dashboard: "view-dashboard",
  profile: "view-profile",
  settings: "view-settings"
};

const LOCAL_ROUTES = {
  "/": "dashboard",
  "/profile": "profile",
  "/settings": "settings"
};

function currentHashPath() {
  const raw = window.location.hash.replace(/^#/, "");
  return raw === "" ? "/" : raw.split("?")[0];
}

function activateView(viewName) {
  const root = document.getElementById("view-root");
  Object.values(VIEW_IDS).forEach((id) => {
    document.getElementById(id).hidden = true;
  });

  const target = VIEW_IDS[viewName] || VIEW_IDS.dashboard;
  document.getElementById(target).hidden = false;
  root.dataset.activeView = viewName || "dashboard";
}

function renderProfileFields(profile) {
  const list = document.getElementById("profile-fields");
  list.innerHTML = "";

  Object.entries(profile).forEach(([key, value]) => {
    const dt = document.createElement("dt");
    dt.textContent = key;
    const dd = document.createElement("dd");
    dd.textContent = String(value);
    list.append(dt, dd);
  });
}

async function handleRouteChange() {
  const path = currentHashPath();
  const localView = LOCAL_ROUTES[path];
  activateView(localView);

  if (typeof window.demoBridge === "undefined") {
    return;
  }

  const route = await window.demoBridge.resolveRoute(path);
  document.getElementById("view-root").dataset.resolvedView = route.view;

  if (route.view === "profile") {
    const profile = await window.demoBridge.readProfile("u-1001");
    renderProfileFields(profile);
    window.demoBridge.sendTelemetry({ unread: 1, view: route.view });
  }
}

document.getElementById("refresh-profile").addEventListener("click", () => {
  handleRouteChange();
});

window.addEventListener("hashchange", handleRouteChange);
window.addEventListener("DOMContentLoaded", handleRouteChange);
