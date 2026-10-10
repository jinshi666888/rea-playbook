const path = require("node:path");
const { app, BrowserWindow, ipcMain } = require("electron");
const { PROFILE_ROUTES, resolveRoute } = require("./src/routes");
const { loadProfile } = require("./src/profile-store");

const WINDOW_BOOTSTRAP = {
  width: 1024,
  height: 720,
  title: "REA Demo Shell"
};

function createWindow() {
  const win = new BrowserWindow({
    ...WINDOW_BOOTSTRAP,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, "renderer", "index.html"));
  return win;
}

ipcMain.handle("profile:read", async (_event, profileId) => {
  return loadProfile(profileId);
});

ipcMain.handle("route:resolve", async (_event, rawPath) => {
  return resolveRoute(rawPath);
});

ipcMain.on("profile:telemetry", (_event, payload) => {
  app.setBadgeCount(payload && payload.unread ? payload.unread : 0);
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

module.exports = { WINDOW_BOOTSTRAP, PROFILE_ROUTES };
