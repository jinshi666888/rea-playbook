/**
 * 集中解析所有路径，避免任何硬编码的机器相关路径。
 * 所有模块都必须从这里取路径，不要在别处拼接绝对路径。
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));

/** 仓库根目录 */
export const ROOT = path.resolve(here, "..");

/** 内置示例目标 */
export const TARGETS_DIR = path.join(ROOT, "targets");
export const DEFAULT_TARGET = path.join(TARGETS_DIR, "electron-demo");

/** 随仓库提交的精简 Evidence 样本（不含任何机器路径） */
export const FIXTURE_EVIDENCE = path.join(ROOT, "fixtures", "electron-demo.evidence.json");

/**
 * 定位 REA 可执行文件。
 * 优先级：REA_BIN 环境变量 > 本地 node_modules/.bin/rea > 系统 PATH 上的 rea。
 * @returns {{command: string, args: string[], source: string}}
 */
export function resolveReaCommand() {
  const fromEnv = process.env.REA_BIN;
  if (fromEnv && fs.existsSync(fromEnv)) {
    return { command: fromEnv, args: [], source: "REA_BIN" };
  }

  const isWin = process.platform === "win32";
  const localBin = path.join(ROOT, "node_modules", ".bin", isWin ? "rea.cmd" : "rea");
  if (fs.existsSync(localBin)) {
    return { command: localBin, args: [], source: "node_modules" };
  }

  return { command: isWin ? "npx.cmd" : "npx", args: ["-y", "rea-agents@6.3.0"], source: "npx" };
}

/**
 * 把任意路径转为 REA 期望的正斜杠绝对路径。
 * REA 的 CLI 要求绝对路径；Windows 反斜杠会导致解析失败。
 * @param {string} p
 */
export function toReaPath(p) {
  return path.resolve(p).replace(/\\/g, "/");
}
