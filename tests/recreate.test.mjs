/**
 * Recreate 阶段断言：证明「证据 -> 代码 -> 测试」闭环真的成立。
 * 每条断言都对应 evidence 里的一条具体结论，注释里标了出处。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveRoute, PROFILE_ROUTES, FALLBACK_ROUTE } from "../recreate/routes.mjs";
import { createBridge, drainTelemetry } from "../recreate/bridge.mjs";
import { PROFILE_ENDPOINT } from "../recreate/profile-store.mjs";

// 证据: literal "/" "/profile" "/settings" @ src/routes.js:1
test("路由表三条路径命中", () => {
  assert.equal(resolveRoute("/").view, "dashboard");
  assert.equal(resolveRoute("/profile").view, "profile");
  assert.equal(resolveRoute("/settings").view, "settings");
});

// 证据: literal "not-found" @ src/routes.js:7 (FALLBACK_ROUTE)
test("未知路径回落 not-found", () => {
  assert.equal(resolveRoute("/nope").view, "not-found");
  assert.equal(resolveRoute("/nope").title, "Not Found");
});

// 证据: src/routes.js 中 rawPath.split("?")[0]
test("查询串被剥离", () => {
  assert.equal(resolveRoute("/profile?x=1").view, "profile");
});

test("路由表规模与证据一致（3 条 + 1 fallback）", () => {
  assert.equal(Object.keys(PROFILE_ROUTES).length, 3);
  assert.equal(FALLBACK_ROUTE.view, "not-found");
});

// 证据: [context-bridge-api] demoBridge @ preload.js:7:0, members 3 个
test("bridge 暴露与证据相同的三个成员", () => {
  const bridge = createBridge();
  assert.deepEqual(Object.keys(bridge).sort(), ["readProfile", "resolveRoute", "sendTelemetry"]);
});

// 证据: ipcRenderer.invoke 是异步且有返回值 -> main.js:26 / :30
test("readProfile 与 resolveRoute 为 async（对应 invoke 语义）", async () => {
  const bridge = createBridge();
  const route = await bridge.resolveRoute("/profile");
  assert.equal(route.view, "profile");

  const profile = await bridge.readProfile("u-1001");
  assert.equal(profile.id, "u-1001");
});

// 证据: src/profile-store.js 的 .catch(...) 降级分支
test("远端不可用时降级到 local-cache", async () => {
  const bridge = createBridge();
  const profile = await bridge.readProfile("u-1001");
  assert.equal(profile.source, "local-cache");
});

// 证据: ipcRenderer.send 单向、无返回值 -> preload.js:10 / main.js:34 (op=on)
test("sendTelemetry 是单向调用（对应 send 语义）", () => {
  const bridge = createBridge();
  assert.equal(bridge.sendTelemetry({ unread: 1, view: "profile" }), undefined);
  assert.equal(drainTelemetry().length, 1);
  assert.equal(drainTelemetry().length, 0, "取出后应清空");
});

// 证据: literal "https://api.example.com/v1/profiles" @ src/profile-store.js:1
test("端点常量与证据一致", () => {
  assert.equal(PROFILE_ENDPOINT, "https://api.example.com/v1/profiles");
});
