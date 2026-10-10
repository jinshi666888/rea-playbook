// Recreate 阶段的迭代测试：验证复现物与原证据一致
import assert from "node:assert/strict";
import { createBridge, drainTelemetry } from "./bridge.mjs";
import { resolveRoute, PROFILE_ROUTES, FALLBACK_ROUTE } from "./routes.mjs";
import { PROFILE_ENDPOINT } from "./profile-store.mjs";

const bridge = createBridge();
let passed = 0;
/**
 * @param {string} name
 * @param {() => void | Promise<void>} fn
 */
const check = async (name, fn) => {
  await fn();
  passed += 1;
  console.log(`  PASS  ${name}`);
};

console.log("Recreate verification");

await check("路由表命中 / -> dashboard", () => {
  assert.equal(resolveRoute("/").view, "dashboard");
});
await check("路由表命中 /profile -> profile", () => {
  assert.equal(resolveRoute("/profile").view, "profile");
});
await check("路由表命中 /settings -> settings", () => {
  assert.equal(resolveRoute("/settings").view, "settings");
});
await check("未知路径走 FALLBACK_ROUTE -> not-found", () => {
  assert.equal(resolveRoute("/nope").view, "not-found");
  assert.equal(resolveRoute("/nope").title, "Not Found");
});
await check("查询串被剥离 (与 src/routes.js split('?')[0] 一致)", () => {
  assert.equal(resolveRoute("/profile?x=1").view, "profile");
});
await check("bridge.resolveRoute 为 async（对应 ipcRenderer.invoke）", async () => {
  const r = await bridge.resolveRoute("/profile");
  assert.equal(r.view, "profile");
});
await check("bridge.readProfile 降级到 local-cache（对应 catch 分支）", async () => {
  const p = await bridge.readProfile("u-1001");
  assert.equal(p.id, "u-1001");
  assert.equal(p.source, "local-cache");
});
await check("bridge.sendTelemetry 单向无返回值（对应 ipcRenderer.send）", () => {
  assert.equal(bridge.sendTelemetry({ unread: 1, view: "profile" }), undefined);
  assert.equal(drainTelemetry().length, 1);
});
await check("端点常量与证据一致", () => {
  assert.equal(PROFILE_ENDPOINT, "https://api.example.com/v1/profiles");
});
await check("导出的路由对象结构完整", () => {
  assert.equal(Object.keys(PROFILE_ROUTES).length, 3);
  assert.equal(FALLBACK_ROUTE.view, "not-found");
});

console.log(`\n${passed}/${passed} checks passed`);
