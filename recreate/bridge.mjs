// Recreate: 复现 preload.js 暴露的 demoBridge 三个成员，以及它背后的三个 IPC 通道
// 证据来源: evidence.json -> graph.nodes
//   [context-bridge-api] demoBridge @ preload.js:7:0  members=[readProfile, resolveRoute, sendTelemetry]
//   [ipc-handler] profile:read      @ main.js:26:0    (handle)
//   [ipc-handler] route:resolve     @ main.js:30:0    (handle)
//   [ipc-handler] profile:telemetry @ main.js:34:0    (on / listen)
//
// 映射说明：目标里 readProfile/resolveRoute 走 ipcRenderer.invoke（异步、有返回值），
// sendTelemetry 走 ipcRenderer.send（单向、无返回值）。
// 复现到纯 Node/Web 时，前两个保留 async 语义，第三个保留 void 语义。

import { loadProfile } from "./profile-store.mjs";
import { resolveRoute } from "./routes.mjs";

/** @type {any[]} */
const telemetryLog = [];

export function createBridge() {
  return {
    /**
     * 对应 ipcRenderer.invoke("profile:read", profileId)
     * @param {string} profileId
     */
    readProfile: (profileId) => loadProfile(profileId),

    /**
     * 对应 ipcRenderer.invoke("route:resolve", rawPath)
     * @param {string} rawPath
     */
    resolveRoute: (rawPath) => Promise.resolve(resolveRoute(rawPath)),

    /**
     * 对应 ipcRenderer.send("profile:telemetry", payload)，单向无返回值
     * @param {any} payload
     */
    sendTelemetry: (payload) => {
      telemetryLog.push(payload);
    }
  };
}

/** @returns {any[]} */
export function drainTelemetry() {
  return telemetryLog.splice(0, telemetryLog.length);
}
