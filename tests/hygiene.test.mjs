/**
 * 仓库卫生检查：确保没有把私有路径、密钥或调试残留提交进来。
 * 这是发布前的最后一道闸，CI 会跑。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "../src/paths.mjs";

const SKIP_DIRS = new Set([".git", "node_modules", ".workbuddy", "artifacts"]);
const TEXT_EXT = new Set([".js", ".mjs", ".cjs", ".json", ".md", ".yml", ".yaml", ".html", ".css", ".ts"]);

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (TEXT_EXT.has(path.extname(entry.name))) acc.push(full);
  }
  return acc;
}

const files = walk(ROOT);

test("仓库里有可扫描的文本文件", () => {
  assert.ok(files.length > 10, `只扫到 ${files.length} 个文件，路径解析可能错了`);
});

test("不包含 Windows 用户私有路径", () => {
  const offenders = [];
  for (const f of files) {
    const text = fs.readFileSync(f, "utf8");
    if (/[A-Za-z]:[/\\]Users[/\\][A-Za-z0-9._-]+/i.test(text)) offenders.push(path.relative(ROOT, f));
  }
  assert.deepEqual(offenders, [], `这些文件含私有路径: ${offenders.join(", ")}`);
});

test("不包含常见密钥形态", () => {
  const patterns = [
    /sk-[A-Za-z0-9]{20,}/,
    /ghp_[A-Za-z0-9]{30,}/,
    /AKIA[0-9A-Z]{16}/,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /xox[baprs]-[A-Za-z0-9-]{10,}/
  ];
  const offenders = [];
  for (const f of files) {
    const text = fs.readFileSync(f, "utf8");
    if (patterns.some((p) => p.test(text))) offenders.push(path.relative(ROOT, f));
  }
  assert.deepEqual(offenders, [], `这些文件疑似含密钥: ${offenders.join(", ")}`);
});

test("库代码里没有调试输出", () => {
  // bin/ 与 scripts/ 是命令行工具，向 stdout 打印是它们的职责；
  // recreate/verify.mjs 同理，它本身就是被 npm run verify 调用的脚本。
  // 这里只约束会被 import 的库代码。
  const CLI_SCRIPTS = new Set(["recreate/verify.mjs"]);
  const offenders = [];
  for (const f of files) {
    const rel = path.relative(ROOT, f).replace(/\\/g, "/");
    if (!rel.startsWith("src/") && !rel.startsWith("recreate/")) continue;
    if (CLI_SCRIPTS.has(rel)) continue;
    const text = fs.readFileSync(f, "utf8");
    if (/\bconsole\.(log|debug)\(/.test(text)) offenders.push(rel);
    if (/^\s*debugger\s*;?\s*$/m.test(text)) offenders.push(`${rel} (debugger)`);
  }
  assert.deepEqual(offenders, [], `这些库文件含调试残留: ${offenders.join(", ")}`);
});

test("示例目标结构完整（8 个文件）", () => {
  const expected = [
    "targets/electron-demo/package.json",
    "targets/electron-demo/main.js",
    "targets/electron-demo/preload.js",
    "targets/electron-demo/src/routes.js",
    "targets/electron-demo/src/profile-store.js",
    "targets/electron-demo/renderer/index.html",
    "targets/electron-demo/renderer/app.js",
    "targets/electron-demo/renderer/styles.css"
  ];
  for (const rel of expected) {
    assert.ok(fs.existsSync(path.join(ROOT, rel)), `缺少 ${rel}`);
  }
});

test("示例目标覆盖 IPC、路由、网络三类关键特征", () => {
  const targetDir = path.join(ROOT, "targets/electron-demo");
  const main = fs.readFileSync(path.join(targetDir, "main.js"), "utf8");
  const preload = fs.readFileSync(path.join(targetDir, "preload.js"), "utf8");
  const store = fs.readFileSync(path.join(targetDir, "src", "profile-store.js"), "utf8");
  const app = fs.readFileSync(path.join(targetDir, "renderer", "app.js"), "utf8");

  assert.match(main, /ipcMain\.handle\(/);
  assert.match(main, /ipcMain\.on\(/);
  assert.match(preload, /contextBridge\.exposeInMainWorld\(/);
  assert.match(preload, /ipcRenderer\.invoke\(/);
  assert.match(preload, /ipcRenderer\.send\(/);
  assert.match(store, /fetch\(/);
  assert.match(app, /hashchange/);
});
