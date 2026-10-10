/**
 * 离线测试：对随仓库提交的精简样本做断言。
 * 这些数字来自一次真实分析（rea-agents 6.3.0），不是编造的预期值。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { extractEvidence, formatReport } from "../src/extract.mjs";
import { FIXTURE_EVIDENCE } from "../src/paths.mjs";

const evidence = JSON.parse(fs.readFileSync(FIXTURE_EVIDENCE, "utf8"));
const r = extractEvidence(evidence);

test("样本可被解析且统计与真实分析一致", () => {
  assert.equal(r.statistics.relevant_files, 7);
  assert.equal(r.statistics.parsed_javascript_files, 5);
  assert.equal(r.statistics.visited_ast_nodes, 767);
  assert.equal(r.statistics.findings, 27);
  assert.equal(r.statistics.parse_failures, 0);
});

test("样本不含任何机器相关的绝对路径", () => {
  // 防止提交 fixture 时把本机路径带进仓库
  assert.equal(r.inputFormat, "directory");
  const raw = fs.readFileSync(FIXTURE_EVIDENCE, "utf8");
  assert.equal(raw.includes("C:/Users/"), false);
  assert.equal(raw.includes("C:\\Users\\"), false);
});

test("IPC 通道被完整抽出，共 6 个", () => {
  assert.equal(r.ipcChannels.length, 6);
});

test("main 侧 3 个通道是字面量，renderer 侧 3 个是动态表达式", () => {
  const literal = r.ipcChannels.filter((c) => c.resolution === "literal");
  const dynamic = r.ipcChannels.filter((c) => c.resolution === "dynamic");
  assert.equal(literal.length, 3);
  assert.equal(dynamic.length, 3);

  // 动态通道必须明确没有解析出通道名，这是 REA 不臆造的关键表现
  for (const d of dynamic) assert.equal(d.channel, null);
});

test("三个 main 侧 handler 都能定位到 main.js 的具体行", () => {
  assert.equal(r.ipcHandlers.length, 3);
  const byChannel = Object.fromEntries(r.ipcHandlers.map((h) => [h.channel, h]));
  assert.ok(byChannel["profile:read"].location.startsWith("main.js:26"));
  assert.ok(byChannel["route:resolve"].location.startsWith("main.js:30"));
  assert.ok(byChannel["profile:telemetry"].location.startsWith("main.js:34"));
});

test("每条 IPC 结论都带文件位置", () => {
  for (const c of r.ipcChannels) {
    assert.notEqual(c.location, "(-)");
    assert.match(c.location, /^[^:]+:\d+/);
  }
});

test("Electron 边界：preload、BrowserWindow、contextBridge 全部命中", () => {
  const kinds = r.electronNodes.map((n) => n.kind);
  for (const k of ["electron-main", "electron-preload", "electron-renderer",
    "browser-window", "context-bridge-api", "package"]) {
    assert.ok(kinds.includes(k), `缺少 ${k}`);
  }

  const bridge = r.electronNodes.find((n) => n.kind === "context-bridge-api");
  assert.equal(bridge.label, "demoBridge");
  assert.deepEqual(bridge.properties.members, ["readProfile", "resolveRoute", "sendTelemetry"]);
  assert.ok(bridge.location.startsWith("preload.js:7"));
});

test("模块导入关系被抽出", () => {
  assert.equal(r.imports.length, 14);
  const pairs = r.imports.map((i) => `${i.from}->${i.to}`);
  assert.ok(pairs.includes("main.js->electron"));
  assert.ok(pairs.includes("main.js->node:path"));
});

test("网络请求与响应节点可定位", () => {
  const request = r.network.find((n) => n.kind === "request");
  assert.ok(request);
  assert.ok(request.location.startsWith("src/profile-store.js:4"));
});

test("字面量覆盖视图名、fallback 与 IPC 通道常量", () => {
  // REA 把字符串字面量的值带引号记录，比较前先剥掉
  const values = r.literals.map((l) => String(l.value ?? "").replace(/^"|"$/g, ""));
  for (const v of ["dashboard", "profile", "settings", "not-found",
    "profile:read", "route:resolve"]) {
    assert.ok(values.includes(v), `缺少字面量 ${v}`);
  }
});

test("网络端点字面量可定位到源文件", () => {
  const endpoint = r.literals.find((l) =>
    String(l.value ?? "").includes("api.example.com"));
  assert.ok(endpoint, "未找到端点字面量");
  assert.ok(endpoint.location.startsWith("src/profile-store.js"));
});

test("limitations 被保留，且明确声明不配对动态通道", () => {
  assert.ok(r.limitations.length > 0);
  const joined = r.limitations.join("\n");
  assert.match(joined, /never paired by textual similarity/);
  assert.match(joined, /remain unproven/);
});

test("渲染的报告可读且包含关键小节", () => {
  const text = formatReport(r);
  for (const section of ["IPC CHANNELS", "MODULES", "ELECTRON BOUNDARIES", "IMPORTS", "LIMITATIONS"]) {
    assert.ok(text.includes(section), `报告缺少 ${section}`);
  }
  // 报告中不应再出现 undefined
  assert.equal(text.includes("undefined"), false);
});
