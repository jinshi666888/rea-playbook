/**
 * demo:offline 契约测试：证明离线预览不调用 REA、不联网。
 *
 * 做法：
 *   - 用一个预加载（tests/network-guard.cjs）注入到 demo:offline 子进程，
 *     拦截 fetch / net / dns / http(s) / tls 以及非 node 的 spawn（即 REA），
 *     一旦触达就写入违规标记文件。
 *   - 用 REA_BIN=/nonexistent/rea-xyz 确保即便误调用 REA 也会立刻失败。
 *   - 断言：子进程退出 0、打印离线横幅、不包含「REA 分析失败」、
 *     且违规标记文件不存在（即全程零网络 / 零 REA 调用）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");
const BIN = path.join(ROOT, "bin", "rea-playbook.mjs");
const GUARD = path.join(here, "network-guard.cjs");

function runDemoOffline(marker) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [BIN, "demo:offline"], {
      cwd: ROOT,
      env: {
        ...process.env,
        REA_BIN: "/nonexistent/rea-xyz",
        REA_PLAYBOOK_OFFLINE: "1",
        NODE_OPTIONS: `--require ${GUARD}`,
        NETWORK_GUARD_MARKER: marker
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

test("demo:offline 全程零网络 / 零 REA 调用（端到端）", async () => {
  const marker = path.join(os.tmpdir(), `rea-netguard-${process.pid}-e2e.log`);
  if (fs.existsSync(marker)) fs.unlinkSync(marker);

  const res = await runDemoOffline(marker);

  assert.equal(res.code, 0, `退出码应为 0，实际 ${res.code}\nstderr: ${res.stderr}`);
  assert.match(res.stdout, /OFFLINE PREVIEW/, "应打印离线预览横幅");
  assert.match(res.stdout, /不调用 REA、不联网、不启动原生逆向引擎/,
    "应声明不调用 REA / 不联网");
  assert.doesNotMatch(res.stdout, /REA 分析失败/,
    "离线预览不应尝试调用 REA（否则会打印 REA 分析失败）");
  assert.doesNotMatch(res.stdout, /npx/i,
    "离线预览不应触发 npx 安装 REA");
  assert.match(res.stdout, /离线预览结束/,
    "应完整走完离线预览流程");

  // 关键契约：守护预加载没有记录任何网络 / REA 违规
  const violated = fs.existsSync(marker) ? fs.readFileSync(marker, "utf8") : "";
  assert.equal(violated, "", `离线预览触发了网络/REA 调用:\n${violated}`);
});

test("cmdDemoOffline 源码层面不引用任何 REA / 网络入口（构造性契约）", () => {
  const src = fs.readFileSync(BIN, "utf8");
  // 只截取 cmdDemoOffline 自身函数体，避免误判其后定义的其他命令
  const start = src.indexOf("async function cmdDemoOffline");
  const end = src.indexOf("async function cmdProbe");
  const fn = src.slice(start, end);
  const blocked = [
    "resolveReaCommand", "@modelcontextprotocol", "mcp-probe",
    "probe(", "fetch(", "https://", "http://", "net.connect", "dns.lookup"
  ];
  for (const token of blocked) {
    assert.equal(fn.includes(token), false,
      `cmdDemoOffline 不应包含 ${token}（会突破离线契约）`);
  }
});
