const { contextBridge, ipcRenderer } = require("electron");

const PROFILE_CHANNEL = "profile:read";
const ROUTE_CHANNEL = "route:resolve";
const TELEMETRY_CHANNEL = "profile:telemetry";

contextBridge.exposeInMainWorld("demoBridge", {
  readProfile: (profileId) => ipcRenderer.invoke(PROFILE_CHANNEL, profileId),
  resolveRoute: (rawPath) => ipcRenderer.invoke(ROUTE_CHANNEL, rawPath),
  sendTelemetry: (payload) => ipcRenderer.send(TELEMETRY_CHANNEL, payload)
});
