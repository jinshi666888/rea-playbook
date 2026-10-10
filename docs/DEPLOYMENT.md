# REA（Reverse Engineer Anything）本地部署与验证报告

- 目标仓库：https://github.com/morluto/rea
- 部署版本：`rea-agents@6.3.0`（npm 包名，与仓库名 `rea` 不同）
- 本机环境：Windows / Node.js `v22.22.2` / npm `10.9.7`
- 完成时间：2026-10-10
- 部署根目录：`<repo>/`

---

## 0. 结论速览

| 项目 | 状态 | 依据 |
|---|---|---|
| 仓库真实性 | 已核实 | `gh api repos/morluto/rea` → TypeScript / MIT / main / HEAD `9defed9` |
| 本机 Node 兼容性 | 通过 | `package.json` engines = `^22.19.0 \|\| ^24.11.0 \|\| >=26.0.0`；本机 `v22.22.2` 落入 `^22.19.0` |
| npm 包安装 | 通过 | `npm install rea-agents@6.3.0` → added 144 packages |
| CLI 静态分析 | 通过 | exit 0，输出 1,799,239 字节 Evidence |
| MCP stdio 握手 | 通过 | `serverInfo: {"name":"rea","version":"6.3.0"}` |
| MCP 工具调用 | 通过 | `analyze_javascript_application` 返回 `isError: false` |
| `git clone` 源码通道 | **失败** | `fatal: fetch-pack: invalid index-pack output`（网络层，非仓库问题） |
| 原生二进制分析 | 本轮不启用 | 需 Hopper / Ghidra / IDA，且宿主基线不含 Windows（详见第 4 节） |

---

## 1. 下载 / 克隆与环境依赖准备

### 1.1 源码通道在本机不可用（已实测）

两条源码通道均已实测失败，npm 包通道可用。

```bash
# 通道 A：git clone —— 失败
git clone --depth 1 https://github.com/morluto/rea.git rea-src
# 实测输出：fatal: fetch-pack: invalid index-pack output

# 通道 B：codeload tarball —— 失败（稳定截断在 2,334,862 字节）
curl -sSL -o rea-src.tar.gz https://codeload.github.com/morluto/rea/tar.gz/refs/heads/main
tar -tzf rea-src.tar.gz   # 实测输出：tar: Unexpected EOF in archive

# 断点续传补救 —— 失败
curl -sSL -o rea-src.tar.gz -C - <URL>
# 实测输出：curl: (33) HTTP server doesn't seem to support byte ranges. Cannot resume.
```

**原因判断**：截断字节数在多次尝试中恒定（2,334,862），且 `--retry` 无效，属于本机到 GitHub 的传输链路问题（大响应体被中断），不是仓库损坏。`gh api` 等小响应体请求全程正常。

**处理建议**：
1. 正常使用走 npm 通道（已验证，本轮采用）；
2. 确需源码时：换网络 / 挂代理后重试 `git clone`，或在 GitHub 网页端下载 ZIP；
3. 不要基于截断的 tarball 做后续构建。

### 1.2 推荐安装方式（已实测通过）

```bash
mkdir -p <workspace>/rea-run
cd <workspace>/rea-run
# package.json 需存在（name/private/version 即可）
npm install rea-agents@6.3.0
```

实测输出：`added 144 packages, and audited 145 packages in 45s`，`found 0 vulnerabilities`。

> 说明：仓库 `README_zh.md` 提供 `npm install --global rea-agents`（shell 可见 `rea` 命令）与 `npx rea-agents setup` 两种方式。本轮采用**项目级本地安装**，避免污染全局，可执行文件位于 `rea-run/node_modules/.bin/rea`。

### 1.3 版本校验命令（全部实测）

```bash
node -v                                    # 实测：v22.22.2
npm -v                                     # 实测：10.9.7
npm view rea-agents version engines        # 实测：6.3.0 / { node: '^22.19.0 || ^24.11.0 || >=26.0.0' }
./node_modules/.bin/rea --version          # 实测：6.3.0
./node_modules/.bin/rea --help             # 列出全部命令
```

版本约束依据：
- `package.json` → `"engines": { "node": "^22.19.0 || ^24.11.0 || >=26.0.0" }`
- `.nvmrc` → `24.18.0`（仓库开发用版本，非硬性要求）
- `README_zh.md`「可以分析什么」章节 → Node.js 22.x(>=22.19)、24.x(>=24.11)、26+
- `docs/installation.md:39` → 「Node.js 23、25 和 prereleases 不受支持」

**你的环境**：`Node.js 22.19+ / 24.x / 26.x` 与要求一致。本机 `v22.22.2` 满足 `^22.19.0`。若切到 24.x，需 ≥ 24.11。

### 1.4 常见报错处理

| 报错 | 原因 | 处理 |
|---|---|---|
| `EBADENGINE Unsupported engine` | Node 不在 `^22.19.0 \|\| ^24.11.0 \|\| >=26.0.0` | 升级 Node；注意 **23 / 25 不受支持**（`docs/installation.md:39`） |
| `rea: command not found` | 用了非 `--global` 安装 | 用 `./node_modules/.bin/rea` 或 `npx -y rea-agents@latest`（`docs/installation.md:41-45`） |
| `fatal: fetch-pack: invalid index-pack output` | 到 GitHub 的传输链路中断 | 换网络/代理重试，或改用 npm 通道 |
| `curl: (33) HTTP server doesn't seem to support byte ranges` | codeload 不支持 Range | 无法续传，只能整包重下或换通道 |
| `Input validation error`（MCP 调用） | 参数名不符 schema | 用 `input_path` 而非 `path`（本轮实测踩到，见 3.2） |
| `ERR_PACKAGE_PATH_NOT_EXPORTED` | MCP SDK 子路径导入写法错误 | 用 `@modelcontextprotocol/client` 与 `.../client/stdio`（无 `.js` 后缀） |

---

## 2. MCP Server 启动与客户端配置

### 2.1 启动方式

依据 `server.json`：

```json
{
  "name": "io.github.morluto/rea",
  "version": "6.3.0",
  "packages": [{
    "registryType": "npm",
    "identifier": "rea-agents",
    "runtimeHint": "npx",
    "transport": { "type": "stdio" },
    "packageArguments": [{ "type": "positional", "value": "mcp" }]
  }]
}
```

即：**stdio 传输，入口参数为 `mcp`**。等价命令：

```bash
npx -y rea-agents@6.3.0 mcp                                   # 官方推荐（server.json）
node ./node_modules/rea-agents/scripts/rea.mjs mcp            # 本地安装直连（本轮实测）
./node_modules/.bin/rea mcp                                   # 本地 bin 等价形式
```

`package.json` 中 `"start": "node scripts/rea.mjs mcp"` 与此一致。

### 2.2 MCP 客户端配置片段

**片段 A — 官方 `mcpServers` 形式**（来源：`docs/installation.md:698-718`，原文逐字）

```json
{
  "mcpServers": {
    "rea": {
      "command": "npx",
      "args": ["-y", "rea-agents@6.3.0", "mcp"]
    }
  }
}
```

**片段 B — 本地直连形式（本轮验证通过，免每次 npx 下载）**

```json
{
  "mcpServers": {
    "rea": {
      "command": "node",
      "args": [
        "<repo>/node_modules/rea-agents/scripts/rea.mjs",
        "mcp"
      ]
    }
  }
}
```

- 依据文件：`rea-run/node_modules/rea-agents/scripts/rea.mjs`（已确认存在）
- 依据字段：`package.json` → `"bin": { "rea": "scripts/rea.mjs", "rea-agents": "scripts/rea.mjs" }`

**片段 C — WorkBuddy（本机 `~/.workbuddy/mcp.json`）**

写入 `~/.workbuddy/mcp.json` 的 `mcpServers` 下，内容同片段 B。注意路径必须是 `~/.workbuddy/mcp.json`，**不是** `~/.workbuddy/.mcp.json`。新服务器不会自动激活，需在连接器管理页右上角自定义连接器入口点击「信任」后启用。

**必要参数说明**
- 传输：`stdio`（`server.json`），**无端口、无环境变量必填项**。
- 版本固定：`docs/installation.md:715` 明确「Persistent registrations should use one exact package version」，即应写 `rea-agents@6.3.0` 而非 `@latest`。
- 超时：Codex / Grok Build 需 `startup_timeout_sec = 30`（`docs/installation.md:166`、`269`）。
- 配置后**必须重启客户端**（`README_zh.md`「设置智能体」章节）。

### 2.3 受支持的客户端 ID（`docs/installation.md:125-141`）

`claude_code` / `claude_desktop` / `codex` / `cursor` / `gemini_cli` / `windsurf` / `devin` / `opencode` / `antigravity` / `copilot_cli` / `commandcode` / `qwen_code` / `vscode` / `grok_build` / `omp`

一键自动配置：`npx rea-agents setup`（交互式，会先展示变更计划并备份原配置）。

---

## 3. 可验证的最小示例（已完整跑通）

### 3.1 目标

构造了一个最小 Electron 应用（覆盖你要求的全部维度），路径：
`<repo>/targets/electron-demo/`

```
electron-demo/
├── package.json              # name=electron-demo, main=main.js
├── main.js                   # 主进程：BrowserWindow + ipcMain.handle/on
├── preload.js                # contextBridge.exposeInMainWorld('demoBridge', ...)
├── src/routes.js             # 路由解析
├── src/profile-store.js      # fetch 网络请求
└── renderer/
    ├── index.html            # DOM 结构 + hash 路由链接
    ├── app.js                # hashchange 路由 + 调用 bridge
    └── styles.css
```

### 3.2 Decompile — 自动提取结构化证据链

**CLI 方式**

```bash
cd <workspace>/rea-run
./node_modules/.bin/rea analyze-javascript-application \
  "<repo>/targets/electron-demo" \
  --json > evidence.json 2> evidence.err
```

实测：`EXIT=0`，Evidence 文件 1,799,239 字节。stderr 为 20 条 `rea_progress` 阶段日志（Inventorying → Parsing → build_javascript_application_graph → seal → validate → hash），证明流程分阶段完成。

**MCP 方式**（参数名实测修正）

```json
{
  "name": "analyze_javascript_application",
  "arguments": {
    "input_path": "<repo>/targets/electron-demo",
    "format": "directory"
  }
}
```

- 工具 schema（从运行中的 MCP 服务 `tools/list` 实际读取）：
  - `input_path`：string，必需，`minLength:1`
  - `format`：`auto` \| `asar` \| `directory`，默认 `auto`
  - `integrity_policy`：`fail` \| `record-and-continue`，默认 `fail`
- 实测返回 `isError: false`，服务端日志 `status":"ok","durationMs":629.91`
- 首次用 `path` 调用触发 `Input validation error` → 确认必需字段为 `input_path`

### 3.3 Understand — 追踪执行链路（每条结论带文件:行号）

以下全部来自本机实际产出的 `evidence.json`（`normalized_result.summary` / `graph.nodes` / `semantic_graph.nodes`）。

**统计**（`normalized_result.statistics`）
```
relevant_files: 7        parsed_javascript_files: 5
visited_ast_nodes: 767   findings: 27     parse_failures: 0
```

**① 模块结构与依赖导入**（14 个 `javascript-module` 节点，14 条 `imports` 边）

```
main.js  -> node:path          main.js  -> electron
main.js  -> src/routes.js      main.js  -> src/profile-store.js
preload.js -> electron
```
模块位置示例：`node:path @ main.js:1:6`、`electron @ main.js:2:6`、`src/routes.js:default @ src/routes.js:14:0`

**② IPC 通信**（`ipc-channel` 6 个 + `ipc-handler` 3 个）

| 通道 | 侧 | 操作 | 解析 | 位置 |
|---|---|---|---|---|
| `profile:read` | main | handle | literal | `main.js:26:0` |
| `route:resolve` | main | handle | literal | `main.js:30:0` |
| `profile:telemetry` | main | on（listen） | literal | `main.js:34:0` |
| `PROFILE_CHANNEL` | renderer | invoke | **dynamic** | `preload.js:8:30` |
| `ROUTE_CHANNEL` | renderer | invoke | **dynamic** | `preload.js:9:29` |
| `TELEMETRY_CHANNEL` | renderer | send | **dynamic** | `preload.js:10:30` |

> 注意：REA 明确把常量引用标记为 `resolution: dynamic` 且**不做配对**（`limitations` 原文：「Dynamic IPC channel expressions remain unresolved and are never paired by textual similarity.」）。这是它「不臆造结论」的设计——`summary.ipc.paired_renderer_transmissions = 0`。

**③ Electron 边界**

```
[electron-main]      main.js @ package.json 入口解析 resolved
[electron-preload]   preload.js @ main.js:13:14   (webPreferences.preload)
[electron-renderer]  renderer/index.html
[browser-window]     BrowserWindow @ main.js:13:14-20:4
                     web_preferences: contextIsolation / nodeIntegration / preload
[context-bridge-api] demoBridge @ preload.js:7:0
                     members: [readProfile, resolveRoute, sendTelemetry]
```

**④ 页面路由**（`semantic_graph` literal 节点）

```
"/"          @ src/routes.js:1         "dashboard" @ renderer/app.js:7
"/profile"   @ src/routes.js:1         "profile"   @ renderer/app.js:7
"/settings"  @ src/routes.js:1         "settings"  @ renderer/app.js:7
"not-found"  @ src/routes.js:7   （FALLBACK_ROUTE）
```

**⑤ 网络请求与响应**（`semantic_graph` 节点类型）

```
[request]  fetch  @ src/profile-store.js:4
[response] json   @ src/profile-store.js:13
literal: "https://api.example.com/v1/profiles"  @ src/profile-store.js:1
```

**⑥ 关系边**（`graph.edges`，共 46 条）

```
[loads]   renderer/index.html -> renderer/app.js
[loads]   electron-demo -> main.js
[loads]   BrowserWindow@13:14-20:4 -> preload.js
[exposes] preload.js -> demoBridge
[handles] profile:read -> profile:read
[sends]   preload.js -> TELEMETRY_CHANNEL
[invokes] preload.js -> PROFILE_CHANNEL
[invokes] preload.js -> ROUTE_CHANNEL
```

**⑦ 声明的局限**（`evidence.limitations`，原文摘录，务必随结论一并阅读）

- 「CommonJS and ESM binding relationships were recovered from inert syntax and resolved only within the inventoried artifact container.」
- 「Dynamic IPC channel expressions remain unresolved and are never paired by textual similarity.」
- 「Electron relationships are derived from inert syntax; runtime registration, reachability, defaults, and enforcement remain unproven.」
- 「Graph coverage is incomplete; unavailable facts remain explicit and must not be read as absence.」
- 「JavaScript and HTML were parsed as inert text; bundle bootstrap code was never executed.」

### 3.4 Recreate — 复现与迭代

REA 自身**不生成复现代码**，它交付的是「证据 + 引用」，由 Agent 据此写代码并测试（`README_zh.md`：「智能体利用这些发现编写并测试实现」）。

本例中可据此复现的骨架（依据 3.3 的证据逐条对应）：

- `main.js:26` `ipcMain.handle("profile:read", ...)` → 复现为你的后端 handler 或 RPC 端点
- `preload.js:7` `contextBridge.exposeInMainWorld("demoBridge", {...})` → 复现为你的 IPC 客户端封装
- `src/routes.js:1` 路由表 + `src/routes.js:7` fallback → 复现为你技术栈的路由表与 404
- `src/profile-store.js:4` fetch + `:13` json → 复现为你的数据层请求与错误处理

迭代测试相关工具（来自 `rea --help` 实测列表）：`compare_application_versions`、`compare_javascript_export_shapes`、`evaluate_reconstruction_coverage`、`build-reconstruction-obligation-ledger`。

### 3.5 复现脚本

工作区已留下可直接重跑的产物：
- `rea-run/extract.mjs` — 从 Evidence 提取上述结构化清单（`node extract.mjs`）
- `rea-run/mcp-probe.mjs` — MCP 握手 + `binary_session` + `analyze_javascript_application` 全流程
- `rea-run/mcp-schema.mjs` — 打印任意工具的 `inputSchema`
- `rea-run/evidence.json` / `evidence.err` — 本轮实测输出

---

## 4. 需额外引擎的场景：前置条件与本轮不启用范围

### 4.1 前置条件（依据 `README_zh.md`「可以分析什么」表格 + `docs/installation.md:306-343`）

| 目标 | 前置条件 | 文档出处 |
|---|---|---|
| **原生二进制**（伪代码/汇编/符号/调用） | Hopper、Ghidra 或 IDA 三选一 | `docs/installation.md#hopper`、`docs/ida-provider.md`、`docs/ghidra-provider.md` |
| **原生宿主基线** | macOS 12+ / Ubuntu 24.04+ / Fedora 41+ / Nobara 44+ / 64-bit Arch / CachyOS | `docs/installation.md:312-314` |
| Windows 上的 Ghidra | 实验性 P0 边界，需 Windows native 组件 + JDK | `docs/windows-ghidra-p0.md` |
| Hopper 许可 | 商业软件，免费 demo 有厂商限制；付费许可可选 | `docs/installation.md:308-310` |
| Hopper 安装位置（macOS） | `~/Applications/Hopper Disassembler.app`，不用 Homebrew / 管理员权限 | `docs/installation.md:316-320` |
| Hopper（Linux） | 校验官方 .deb/.rpm/Arch 包 + Xvfb 私有显示 | `docs/installation.md:332-342` |
| **网站 / 浏览器分析** | Chrome 系浏览器（CDP） | `README_zh.md` 表格「网站」行 |
| 离线 ELF 布局 | Linux x64 + 调用方提供 pwntools | `docs/binary-diagnostics.md` |
| Android APK | Linux/macOS + 无界面 JADX + 完整 JDK | `docs/android-analysis.md` |
| 固件 | Linux + Binwalk / Unblob | `docs/firmware-analysis.md` |
| 已记录崩溃 | pwntools，可选 GDB/pwndbg | `docs/recorded-crashes.md` |
| 进程行为 | Linux/macOS 原生 PTY | `docs/process-capture.md` |
| **JavaScript / Electron（本轮）** | **仅 Node.js + npm，无需任何引擎** | `README_zh.md`：「静态 JavaScript 分析不需要这两个引擎」 |

### 4.2 本轮明确不启用的部分

1. **原生二进制分析** — 无 Hopper / Ghidra / IDA；且 Windows 不在原生宿主基线内（Ghidra on Windows 仅为实验性 P0）。
2. **MCP 工具集未全量可用** — 实测 `binary_session` 报告 **58 / 139 工具 available**。其余 81 个依赖未安装的引擎或平台能力（Linux/macOS PTY、pwntools、JADX、Chrome CDP 目标等），属预期状态，非故障。
3. **网站实时分析（CDP）** — `inspect_web_page` 工具存在（已确认 PRESENT），但需先有运行中的 Chrome 及 `cdp_endpoint` + `target_id`；本轮无目标页面，未执行。
4. **Android / 固件 / EVM / .NET / 进程捕获 / 已记录崩溃** — 均需 Linux/macOS 或额外工具链，未启用。
5. **`rea setup` 自动注册** — 未执行。它属于交互式流程，会写入客户端配置并可能安装 Hopper；本轮改用手动配置（第 2.2 节），变更面可控。如需自动注册：`npx rea-agents setup --client <id> --dry-run --json` 先预览计划。
6. **源码构建（`npm run build` / `test`）** — 源码通道不可用（1.1），未做编译与测试。

### 4.3 需要你补充的信息

1. **MCP 客户端是哪个** — 你提到「我的 MCP 客户端」但未指明。若需我直接写入配置文件，请确认客户端（WorkBuddy / Claude Code / Cursor / Codex / 其他），我给出的 `--client` ID 需与之匹配。
2. **真实分析目标** — 本轮用的是我构造的最小示例以验证链路。若你有实际 Electron 应用（`.asar` 或解包目录）或目标网站，提供绝对路径即可切换：`format` 用 `asar` 或 `auto`。
3. **浏览器分析目标** — 若要跑网站维度（DOM / 脚本 / 网络请求响应），需提供已启动的 Chrome CDP 端点（如 `--remote-debugging-port=9222` 的 `http://127.0.0.1:9222`）。
4. **是否需要原生分析** — 若后续要做，需先确认Hopper 许可与宿主平台；当前 Windows 环境不是官方支持的原生宿主基线。

---

## 附：本轮实测命令汇总

```bash
# 环境
node -v                                          # v22.22.2
npm view rea-agents version engines              # 6.3.0 / ^22.19.0 || ^24.11.0 || >=26.0.0

# 安装
cd <workspace>/rea-run
npm install rea-agents@6.3.0                     # added 144 packages
./node_modules/.bin/rea --version                # 6.3.0

# CLI 分析
./node_modules/.bin/rea analyze-javascript-application <TARGET> --json > evidence.json
node extract.mjs                                 # 结构化证据清单

# MCP
node mcp-probe.mjs                               # 握手 + binary_session + analyze_javascript_application
node mcp-schema.mjs                              # 打印工具 inputSchema

# 诊断
./node_modules/.bin/rea doctor --json            # 只读，审计注册与引擎
./node_modules/.bin/rea doctor --provider hopper --json
```
