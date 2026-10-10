#!/usr/bin/env node
/**
 * rea-playbook 统一入口。
 *
 *   analyze [target]   对一个目标跑静态分析，产出 Evidence JSON
 *   extract [file]     把 Evidence 压缩成带文件:行号的可读清单
 *   verify             跑 Recreate 复现代码的断言测试
 *   probe [target]     通过 MCP 协议验证 REA 可用性与工具清单
 *   doctor             透传 REA 的自检
 */
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  ROOT, DEFAULT_TARGET, FIXTURE_EVIDENCE, resolveReaCommand, toReaPath
} from "../src/paths.mjs";
import { extractEvidence, formatReport } from "../src/extract.mjs";

const [, , command = "help", ...rest] = process.argv;

/**
 * @param {string} file
 * @param {string[]} args
 * @param {object} [opts]
 */
function run(file, args, opts = {}) {
  return new Promise((resolve, reject) => {
    // Windows 上 node_modules/.bin 里的入口是 .cmd 批处理，必须经 shell 启动
    const child = spawn(file, args, {
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
      ...opts
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

/** @param {string} p */
async function readJson(p) {
  return JSON.parse(await fs.readFile(p, "utf8"));
}

/**
 * @param {string} target
 * @param {string} [outArg]
 */
async function cmdAnalyze(target = DEFAULT_TARGET, outArg) {
  const rea = resolveReaCommand();
  const out = outArg ?? path.join(ROOT, "evidence.json");
  const args = [
    ...rea.args,
    "analyze-javascript-application",
    toReaPath(target),
    "--json"
  ];
  const res = await run(rea.command, args);
  if (res.code !== 0) {
    process.stderr.write(res.stderr || res.stdout);
    throw new Error(`REA 分析失败，退出码 ${res.code}`);
  }
  await fs.writeFile(out, res.stdout, "utf8");
  const ev = JSON.parse(res.stdout);
  console.log(`Evidence 已写入: ${out}`);
  console.log(`体积: ${Buffer.byteLength(res.stdout)} 字节`);
  console.log(`统计: ${JSON.stringify(ev.normalized_result?.statistics ?? {})}`);
  return out;
}

async function cmdExtract(file = FIXTURE_EVIDENCE) {
  const evidence = await readJson(file);
  console.log(formatReport(extractEvidence(evidence)));
}

async function cmdVerify() {
  const res = await run(process.execPath, [path.join(ROOT, "recreate", "verify.mjs")]);
  process.stdout.write(res.stdout);
  if (res.code !== 0) {
    process.stderr.write(res.stderr);
    throw new Error(`复现验证失败，退出码 ${res.code}`);
  }
}

/**
 * 离线预览：只读仓库自带的脱敏样本，跑 Recreate 断言。
 * 契约（README 与 CI 都依赖它）：
 *   - 不调用 REA，不 spawn npx，不访问网络
 *   - 只需要 node，不需要 npm install 之外的任何东西
 */
async function cmdDemoOffline() {
  const line = "─".repeat(64);
  console.log(line);
  console.log("OFFLINE PREVIEW / 离线预览");
  console.log("读取仓库自带的脱敏样本，不调用 REA、不联网、不启动原生逆向引擎。");
  console.log(line);
  console.log("");
  console.log(`样本: ${path.relative(ROOT, FIXTURE_EVIDENCE)}`);
  console.log("");
  await cmdExtract(FIXTURE_EVIDENCE);
  console.log("");
  console.log(line);
  console.log("Recreate 断言（evidence -> code -> test）:");
  console.log(line);
  await cmdVerify();
  console.log("");
  console.log(line);
  console.log("离线预览结束。以上结果全部来自仓库内已提交的文件。");
  console.log("要跑真实分析（会调用 REA 并下载 rea-agents）：npm run analyze");
  console.log(line);
}

async function cmdProbe(target = DEFAULT_TARGET) {
  let mod;
  try {
    mod = await import("@modelcontextprotocol/client");
  } catch {
    throw new Error("未安装 @modelcontextprotocol/client，请执行 npm install");
  }
  const stdio = await import("@modelcontextprotocol/client/stdio");
  const { probe, formatProbe } = await import("../src/mcp-probe.mjs");
  const r = await probe({ target, Client: mod.Client, StdioClientTransport: stdio.StdioClientTransport });
  console.log(formatProbe(r));
  if (r.error) throw new Error(r.error);
}

async function cmdDoctor() {
  const rea = resolveReaCommand();
  const res = await run(rea.command, [...rea.args, "doctor", "--json"]);
  process.stdout.write(res.stdout);
  // doctor 在无原生引擎时返回 1 属预期，不视为命令失败
  return res.code;
}

/** @type {Record<string, (...args: any[]) => any>} */
const commands = {
  analyze: cmdAnalyze,
  extract: cmdExtract,
  verify: cmdVerify,
  "demo:offline": cmdDemoOffline,
  probe: cmdProbe,
  doctor: cmdDoctor
};

if (command === "help" || !commands[command]) {
  console.log(`用法: rea-playbook <command> [args]

  demo:offline           【离线预览】只读自带样本，不调用 REA、不联网
  analyze [target] [out] 【真实分析】调用 REA 分析目标，产出本地 Evidence
  extract [file]         把 Evidence 转成可读清单，默认仓库自带样本
  verify                 跑 Recreate 断言测试
  probe [target]         通过 MCP 验证 REA
  doctor                 透传 REA 自检
`);
  process.exit(command === "help" ? 0 : 1);
}

commands[command](...rest).catch((/** @type {Error} */ err) => {
  console.error(`错误: ${err.message}`);
  process.exit(1);
});
