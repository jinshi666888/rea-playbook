/**
 * 零依赖静态检查。做三件事：
 * 1. 没有遗留的待办标记（写法见 MARKERS 常量）
 * 2. 没有 debugger
 * 3. 源码里没有硬编码的机器绝对路径（必须走 src/paths.mjs）
 *
 * 语法与类型由 `npm run typecheck`（TypeScript checkJs）负责，这里不重复做。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIP = new Set([".git", "node_modules", ".workbuddy"]);
const SCAN_DIRS = ["src", "bin", "recreate", "scripts", "tests"];

// 拆分书写，避免本文件被自己的规则命中
const MARKERS = ["TOD" + "O", "FIXM" + "E", "XX" + "X"];
const markerRe = new RegExp(`\\b(?:${MARKERS.join("|")})\\b`);

// 测试与检查脚本本身会包含用于断言的字符串，不参与路径规则
const EXEMPT_FROM_PATH_RULE = new Set(["tests", "scripts"]);

/**
 * @param {string} dir
 * @param {string[]} acc
 * @returns {string[]}
 */
function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, acc);
    else if (e.name.endsWith(".mjs") || e.name.endsWith(".js")) acc.push(full);
  }
  return acc;
}

const files = SCAN_DIRS.flatMap((d) => walk(path.join(ROOT, d)));
const problems = [];

for (const f of files) {
  const rel = path.relative(ROOT, f).replace(/\\/g, "/");
  const src = fs.readFileSync(f, "utf8");
  const topDir = rel.split("/")[0];

  // 本文件定义规则的说明文字不算违规
  const isSelf = rel === "scripts/lint.mjs";

  if (!isSelf) {
    const m = src.match(markerRe);
    if (m) problems.push(`${rel}: 遗留待办标记 "${m[0]}"`);
  }

  if (/^\s*debugger\s*;?\s*$/m.test(src)) problems.push(`${rel}: 存在 debugger`);

  if (!EXEMPT_FROM_PATH_RULE.has(topDir)) {
    const abs = src.match(/["'`][A-Za-z]:[/\\]Users[/\\]/);
    if (abs) problems.push(`${rel}: 硬编码私有路径 ${abs[0]}`);
  }
}

if (problems.length) {
  console.error(`lint 发现 ${problems.length} 个问题:`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

console.log(`lint 通过: 扫描 ${files.length} 个源文件，无待办标记、无 debugger、无硬编码私有路径`);
