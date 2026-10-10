# REA 使用手册 —— 照着做就能跑通

本文所有命令与输出均在本机（Windows / Node `v22.22.2`）**实际执行过**。凡标注「实测」的，是真实回显，不是推测。

---

## 1. 它是干什么的，什么时候该用它

### 一句话

你在别人的软件里看到一个想要的功能，REA 帮你**查清它怎么实现的**，而且每个结论都给你**文件和行号**当证据。

### 它做的是三件事

| 阶段 | 干什么 | 产出 |
|---|---|---|
| **Decompile** | 读取目标文件，不运行它，提取结构化证据 | 模块、导入、字符串、调用关系、伪代码 |
| **Understand** | 顺着证据追踪链路 | 每条结论带 `文件:行号` |
| **Recreate** | 你（或你的 AI）照着证据写代码，再跑测试验证 | 可运行的复现代码 |

### 该用的场景

- **看到 Electron 应用的一个功能，想知道它怎么做的** → 本文示例就是这个
- 想知道一个网站前端的路由、请求、DOM 是怎么组织的
- 想知道一个原生二进制里某个函数的伪代码（**要装额外引擎，见第 5 节**）
- 想逆向 .NET、Android APK、固件（同样要额外工具）

### 不该指望它的地方

- **它不会帮你生成复现代码**。它给证据，代码要你自己或 AI 写（第 4 步第 4 小步会给演示）。
- **它不运行目标程序**。纯静态读取，所以「运行时才注册的行为」它看不到，并且会明确告诉你「这条我没证明」。
- **它不联网上传你的目标**。分析全在本机。

### 本文覆盖的范围

只跑**零额外引擎**的那条路：**JavaScript / Electron 应用 + 网站前端**。这是门槛最低、本机能直接跑通的路线。

---

## 2. 用之前的准备

### 2.1 你要有的东西

| 项目 | 要求 | 怎么查 |
|---|---|---|
| Node.js | `22.x ≥ 22.19`、`24.x ≥ 24.11` 或 `26+` | `node -v` |
| npm | 跟 Node 一起的就行 | `npm -v` |
| 一个要分析的目标 | Electron 应用目录 / `.asar` 文件 / 网站 | — |
| 逆向引擎 | **本路线不需要** | — |

> 实测本机：`node -v` → `v22.22.2`，`npm -v` → `10.9.7`。满足要求。
>
> **注意**：Node **23 和 25 不受支持**（依据 `docs/installation.md` 第 39 行）。如果你正好是这两个版本，先换掉。

### 2.2 一个容易踩的坑：包名不叫 rea

仓库叫 `rea`，但 npm 包叫 **`rea-agents`**。装错名字会装不到。

### 2.3 安装（复制粘贴即可）

**第 1 步：建目录**

```bash
mkdir -p /c/Users/Administrator/WorkBuddy/2026-10-10-15-38-27/rea-run
cd /c/Users/Administrator/WorkBuddy/2026-10-10-15-38-27/rea-run
```

**第 2 步：建 package.json**

```bash
printf '{\n  "name": "rea-run",\n  "private": true,\n  "version": "1.0.0"\n}\n' > package.json
```

**第 3 步：装 REA**

```bash
npm install rea-agents@6.3.0
```

- **输入**：上面这条命令
- **预期结果**（实测回显）：
  ```
  added 144 packages, and audited 145 packages in 45s
  found 0 vulnerabilities
  ```
- **耗时**：约 45 秒

**第 4 步：确认装好了**

```bash
./node_modules/.bin/rea --version
```

- **预期输出**（实测）：`6.3.0`
- 如果看到这个数字，说明装好了。

> **为什么不用 `npm install --global`**：全局装会改你的系统环境。装在项目目录里更干净，卸载时直接删目录就行。代价是命令要写 `./node_modules/.bin/rea`，而不是裸 `rea`。

### 2.4 关于「下载/克隆仓库」

**先说结论：你大概率不需要克隆仓库，装 npm 包就够了。**

本机实测两条源码通道都失败了：

```bash
git clone --depth 1 https://github.com/morluto/rea.git rea-src
# 实测：fatal: fetch-pack: invalid index-pack output

curl -sSL -o rea-src.tar.gz https://codeload.github.com/morluto/rea/tar.gz/refs/heads/main
# 实测：下载到 2,334,862 字节被截断，tar -tzf 报 Unexpected EOF in archive
```

这是本机到 GitHub 的网络链路问题（截断字节数每次都一样，重试无效），**不是仓库坏了**。

如果你确实需要源码（比如要改代码、跑测试）：换网络或挂代理后重试 `git clone`。**不要**用被截断的压缩包做后续操作，会莫名出错。

---

## 3. 具体操作步骤

下面按**真正的使用顺序**排列。每一步都写清楚：输入什么、看到什么算成功。

---

### 步骤 1：确认你的目标路径

**输入**：你要分析的目录的**绝对路径**。

**要求**：必须是绝对路径。Windows 上用正斜杠，例如：
```
<repo>/targets/electron-demo
```

**预期结果**：这个路径下应该有 `package.json`，或者一堆 `.js` / `.html` 文件，或者一个 `.asar` 文件。

> 如果你现在手头没目标，跳到第 4 节，那里有一个现成的可以白嫖。

---

### 步骤 2：跑分析（Decompile）

**输入**：

```bash
cd /c/Users/Administrator/WorkBuddy/2026-10-10-15-38-27/rea-run

./node_modules/.bin/rea analyze-javascript-application \
  "<repo>/targets/electron-demo" \
  --json > evidence.json 2> evidence.err
```

**预期结果**：

1. 命令退出码为 0（用 `echo $?` 查）
2. `evidence.json` 是个大文件（**实测：1,799,239 字节**）
3. `evidence.err` 里是一串进度日志，最后一长这样（实测）：
   ```
   {"rea_progress":{...,"message":"Hashing the complete application analysis Evidence","sequence":19}}
   {"rea_progress":{...,"message":"Application graph and Electron boundaries reconstructed","terminal":true,"sequence":20}}
   ```
   看到 `terminal: true` 就是跑完了。

**这一步在干什么**：REA 把目标目录里的文件挨个读一遍、解析成语法树，然后抽出模块、导入、Electron 边界、IPC 通道，最后算哈希封存。全程**不执行**目标代码。

---

### 步骤 3：读证据（Understand）

`evidence.json` 有 180 万字节，直接看会瞎。用一个提取脚本把它整理成人话。

**输入**：

```bash
node extract.mjs
```

（`extract.mjs` 在第 4 节会给出，也可直接用工作区里现成的）

**预期结果**（实测真实输出，节选）：

```
### IPC CHANNELS (6)
  TELEMETRY_CHANNEL      side=renderer op=send   channel=<dynamic>        resolution=dynamic  @ preload.js:10:30
  route:resolve          side=main     op=handle channel=route:resolve    resolution=literal  @ main.js:30:0
  PROFILE_CHANNEL        side=renderer op=invoke channel=<dynamic>        resolution=dynamic  @ preload.js:8:30
  ROUTE_CHANNEL          side=renderer op=invoke channel=<dynamic>        resolution=dynamic  @ preload.js:9:29
  profile:telemetry      side=main     op=on     channel=profile:telemetry resolution=literal @ main.js:34:0
  profile:read           side=main     op=handle channel=profile:read     resolution=literal  @ main.js:26:0

### MODULES (14)
  node:path                    @ main.js:1:6
  electron                     @ main.js:2:6
  src/routes.js:default        @ src/routes.js:14:0
  ...

### ELECTRON NODES
  [electron-main] main.js              resolution_status=resolved
  [electron-preload] preload.js        @ main.js:13:14
  [browser-window] BrowserWindow@13:14-20:4
  [context-bridge-api] demoBridge      members=["readProfile","resolveRoute","sendTelemetry"]  @ preload.js:7:0

### IMPORTS EDGES (14)
  main.js  ->  node:path
  main.js  ->  electron
  main.js  ->  src/routes.js
  ...

### semantic graph: request/response (network)
  [request] fetch @ src/profile-store.js:4
  [response] json @ src/profile-store.js:13

### semantic graph: literal nodes (route/channel strings)
  "/profile"                    @ src/routes.js:1
  "https://api.example.com/v1/profiles" @ src/profile-store.js:1
```

**怎么读**：
- `@ 文件:行号` 就是证据位置，你可以直接打开文件跳过去核对
- `resolution=dynamic` 表示「REA 看不出来这个变量最终是什么值」，它**不会瞎猜**
- 每一条都能回溯到具体代码，这就是 REA 和"让 AI 凭感觉猜"的区别

**务必同时看 limitations**（同一个脚本会打印，实测原文）：

```
- Dynamic IPC channel expressions remain unresolved and are never paired by textual similarity.
- Electron relationships are derived from inert syntax; runtime registration, reachability,
  defaults, and enforcement remain unproven.
- Graph coverage is incomplete; unavailable facts must not be read as absence.
```

**翻成人话**：动态通道它不配对；运行时行为它没证明；没查到的东西是"不知道"，不是"没有"。

---

### 步骤 4：照着证据写代码（Recreate）

REA 到步骤 3 就结束了，代码要你自己写。

**输入**：步骤 3 拿到的证据。

**做法**：把每条证据翻译成你的技术栈。工作区里已经有一份做好的，可以直接跑：

```bash
node recreate/verify.mjs
```

**预期结果**（实测）：

```
Recreate verification
  PASS  路由表命中 / -> dashboard
  PASS  路由表命中 /profile -> profile
  PASS  路由表命中 /settings -> settings
  PASS  未知路径走 FALLBACK_ROUTE -> not-found
  PASS  查询串被剥离 (与 src/routes.js split('?')[0] 一致)
  PASS  bridge.resolveRoute 为 async（对应 ipcRenderer.invoke）
  PASS  bridge.readProfile 降级到 local-cache（对应 catch 分支）
  PASS  bridge.sendTelemetry 单向无返回值（对应 ipcRenderer.send）
  PASS  端点常量与证据一致
  PASS  导出的路由对象结构完整

10/10 checks passed
```

**这就是闭环**：证据 → 代码 → 测试通过。如果哪条挂了，说明你复现错了，回去核对行号。

---

### 步骤 5（可选）：接上 AI 客户端，让它自动跑上面 1-4 步

如果你想让 AI 客户端直接调用 REA，需要配 MCP。

**5.1 先看 REA 支持哪些客户端**（依据 `docs/installation.md` 第 125-141 行）：

`claude_code`、`claude_desktop`、`codex`、`cursor`、`gemini_cli`、`windsurf`、`devin`、`opencode`、`antigravity`、`copilot_cli`、`commandcode`、`qwen_code`、`vscode`、`grok_build`、`omp`

**5.2 自动配（推荐，交互式）**

```bash
npx rea-agents setup
```
它会先给你看要改哪些文件，你确认后才动。

**5.3 手动配**

在客户端的 MCP 配置文件里加（依据 `docs/installation.md` 第 698-718 行，官方原文）：

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

本机直连版（**已实测可用**，省去每次 npx 下载）：

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

- 用的是 **stdio** 传输，**没有端口、没有必填环境变量**
- 版本号**写死** `6.3.0`，别写 `@latest`（官方文档明确要求固定版本）
- 配完**必须重启客户端**
- 如果你用的是 WorkBuddy：写 `~/.workbuddy/mcp.json`（注意**不是** `.mcp.json`），然后到连接器管理页点「信任」启用

**5.4 验证 MCP 真的连上了**

```bash
node mcp-probe.mjs
```

- **预期结果**（实测）：
  ```
  === connected ===
  serverInfo: {"name":"rea","version":"6.3.0"}
  capabilities: {"completions":{},"prompts":{"listChanged":true},"tools":{"listChanged":true}}
  === tool count: 139 ===
  binary_session                     PRESENT
  analyze_javascript_application     PRESENT
  inspect_web_page                   PRESENT

  tool_availability: 58/139 available
  isError: false
  ```
- **看到 `58/139` 别慌**，这是正常的。另外 81 个工具需要 Hopper/Ghidra/IDA/Linux/macOS 专属能力，你没装所以不可用。**你走 JavaScript 路线，用不到它们。**

---

## 4. 最小可运行的完整示例

这个示例**从零开始，全部命令可直接复制**。本轮已经完整跑通。

### 4.1 建目标应用

目标是一个最小 Electron 应用，故意塞进了这些元素：主进程 / preload / 渲染进程 / IPC / 路由 / fetch / DOM。

创建目录 `rea-run/targets/electron-demo/`，下面 7 个文件：

**`package.json`**
```json
{
  "name": "electron-demo",
  "version": "1.0.0",
  "private": true,
  "main": "main.js"
}
```

**`main.js`**
```js
const path = require("node:path");
const { app, BrowserWindow, ipcMain } = require("electron");
const { PROFILE_ROUTES, resolveRoute } = require("./src/routes");
const { loadProfile } = require("./src/profile-store");

const WINDOW_BOOTSTRAP = { width: 1024, height: 720, title: "REA Demo Shell" };

function createWindow() {
  const win = new BrowserWindow({
    ...WINDOW_BOOTSTRAP,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
  return win;
}

ipcMain.handle("profile:read", async (_event, profileId) => {
  return loadProfile(profileId);
});

ipcMain.handle("route:resolve", async (_event, rawPath) => {
  return resolveRoute(rawPath);
});

ipcMain.on("profile:telemetry", (_event, payload) => {
  app.setBadgeCount(payload && payload.unread ? payload.unread : 0);
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

module.exports = { WINDOW_BOOTSTRAP, PROFILE_ROUTES };
```

**`preload.js`**
```js
const { contextBridge, ipcRenderer } = require("electron");

const PROFILE_CHANNEL = "profile:read";
const ROUTE_CHANNEL = "route:resolve";
const TELEMETRY_CHANNEL = "profile:telemetry";

contextBridge.exposeInMainWorld("demoBridge", {
  readProfile: (profileId) => ipcRenderer.invoke(PROFILE_CHANNEL, profileId),
  resolveRoute: (rawPath) => ipcRenderer.invoke(ROUTE_CHANNEL, rawPath),
  sendTelemetry: (payload) => ipcRenderer.send(TELEMETRY_CHANNEL, payload)
});
```

**`src/routes.js`**
```js
const PROFILE_ROUTES = {
  "/": { view: "dashboard", title: "Dashboard" },
  "/profile": { view: "profile", title: "Profile" },
  "/settings": { view: "settings", title: "Settings" }
};

const FALLBACK_ROUTE = { view: "not-found", title: "Not Found" };

function resolveRoute(rawPath) {
  const normalized = typeof rawPath === "string" ? rawPath.split("?")[0] : "/";
  return PROFILE_ROUTES[normalized] || FALLBACK_ROUTE;
}

module.exports = { PROFILE_ROUTES, FALLBACK_ROUTE, resolveRoute };
```

**`src/profile-store.js`**
```js
const PROFILE_ENDPOINT = "https://api.example.com/v1/profiles";

async function fetchRemoteProfile(profileId) {
  const response = await fetch(`${PROFILE_ENDPOINT}/${profileId}`, {
    method: "GET",
    headers: { Accept: "application/json" }
  });
  if (!response.ok) {
    return { id: profileId, source: "remote-error", status: response.status };
  }
  return response.json();
}

function loadProfile(profileId) {
  return fetchRemoteProfile(profileId).catch(() => ({
    id: profileId,
    source: "local-cache",
    displayName: "Cached User"
  }));
}

module.exports = { PROFILE_ENDPOINT, fetchRemoteProfile, loadProfile };
```

**`renderer/index.html`**
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>REA Demo Renderer</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <header id="app-header">
      <nav id="route-nav">
        <a class="route-link" href="#/">Dashboard</a>
        <a class="route-link" href="#/profile">Profile</a>
        <a class="route-link" href="#/settings">Settings</a>
      </nav>
    </header>
    <main id="view-root" data-active-view="dashboard">
      <section id="view-dashboard" class="view" hidden>
        <h1>Dashboard</h1>
        <button id="refresh-profile" type="button">Refresh profile</button>
      </section>
      <section id="view-profile" class="view" hidden>
        <h1>Profile</h1>
        <dl id="profile-fields"></dl>
      </section>
      <section id="view-settings" class="view" hidden>
        <h1>Settings</h1>
        <input id="endpoint-input" type="text" value="https://api.example.com/v1/profiles" />
      </section>
    </main>
    <script src="./app.js"></script>
  </body>
</html>
```

**`renderer/app.js`**
```js
const VIEW_IDS = {
  dashboard: "view-dashboard",
  profile: "view-profile",
  settings: "view-settings"
};

const LOCAL_ROUTES = { "/": "dashboard", "/profile": "profile", "/settings": "settings" };

function currentHashPath() {
  const raw = window.location.hash.replace(/^#/, "");
  return raw === "" ? "/" : raw.split("?")[0];
}

function activateView(viewName) {
  const root = document.getElementById("view-root");
  Object.values(VIEW_IDS).forEach((id) => { document.getElementById(id).hidden = true; });
  const target = VIEW_IDS[viewName] || VIEW_IDS.dashboard;
  document.getElementById(target).hidden = false;
  root.dataset.activeView = viewName || "dashboard";
}

function renderProfileFields(profile) {
  const list = document.getElementById("profile-fields");
  list.innerHTML = "";
  Object.entries(profile).forEach(([key, value]) => {
    const dt = document.createElement("dt"); dt.textContent = key;
    const dd = document.createElement("dd"); dd.textContent = String(value);
    list.append(dt, dd);
  });
}

async function handleRouteChange() {
  const path = currentHashPath();
  activateView(LOCAL_ROUTES[path]);
  if (typeof window.demoBridge === "undefined") return;

  const route = await window.demoBridge.resolveRoute(path);
  document.getElementById("view-root").dataset.resolvedView = route.view;

  if (route.view === "profile") {
    const profile = await window.demoBridge.readProfile("u-1001");
    renderProfileFields(profile);
    window.demoBridge.sendTelemetry({ unread: 1, view: route.view });
  }
}

document.getElementById("refresh-profile").addEventListener("click", () => { handleRouteChange(); });
window.addEventListener("hashchange", handleRouteChange);
window.addEventListener("DOMContentLoaded", handleRouteChange);
```

**`renderer/styles.css`**
```css
#app-header { border-bottom: 1px solid #ccc; padding: 8px 16px; }
.route-link { margin-right: 12px; }
.view { padding: 16px; }
```

> 这些文件已经在工作区里了，不用手打：`rea-run/targets/electron-demo/`

### 4.2 跑分析

```bash
cd /c/Users/Administrator/WorkBuddy/2026-10-10-15-38-27/rea-run
./node_modules/.bin/rea analyze-javascript-application \
  "<repo>/targets/electron-demo" \
  --json > evidence.json 2> evidence.err
echo "退出码: $?"
wc -c evidence.json
```

**实测结果**：退出码 `0`，`evidence.json` = `1799239` 字节。

### 4.3 看证据

```bash
node extract.mjs
```

输出见第 3 节步骤 3。核心结论统计（实测）：

```
relevant_files: 7        parsed_javascript_files: 5
visited_ast_nodes: 767   findings: 27     parse_failures: 0
```

### 4.4 复现并验证

```bash
node recreate/verify.mjs
```

**实测**：`10/10 checks passed`

复现代码在 `rea-run/recreate/`：`routes.mjs`、`profile-store.mjs`、`bridge.mjs`、`verify.mjs`。每个文件头部都注释了它对应哪条证据（哪个文件哪一行）。

### 4.5 用 MCP 跑同一件事（可选）

工具调用参数（**注意是 `input_path`，不是 `path`**）：

```json
{
  "name": "analyze_javascript_application",
  "arguments": {
    "input_path": "<repo>/targets/electron-demo",
    "format": "directory"
  }
}
```

**实测返回**：`isError: false`，服务端日志 `status":"ok","durationMs":629.91`，`summary` 与 CLI 完全一致。

参数说明（从运行中的服务 `tools/list` 实际读取）：
- `input_path`：字符串，**必填**
- `format`：`auto` / `asar` / `directory`，默认 `auto`
- `integrity_policy`：`fail` / `record-and-continue`，默认 `fail`

---

## 5. 常见报错和卡点排查

### 5.1 先看这个：一键自检

```bash
./node_modules/.bin/rea doctor --json
```

**实测结果**：退出码 `1`，`healthy: false`。但里面的关键项：

```json
{"name":"node","ok":true,"classification":"healthy","detail":"22.22.2"}
{"name":"host","ok":true,"classification":"healthy","detail":"win32 x64"}
{"name":"hopper","ok":false,"classification":"missing_analysis_engine"}
{"name":"ghidra","ok":false,"classification":"missing_analysis_engine"}
{"name":"ida-registration","ok":false,"classification":"missing_analysis_engine"}
```

**重点理解**：`doctor` 报 `healthy: false` **不代表你不能用**。它审计的是"全部能力"，而你只走 JavaScript 路线。只要 `node` 和 `host` 是 `ok`，第 3、4 节的操作就能跑。官方文档原话：整体 healthy 可以是 false，而你选的那条工作流照样能用。

要看单项：
```bash
rea doctor --provider hopper --json     # 只看某个引擎
rea doctor --client codex --json        # 只看某个客户端注册
rea doctor --skill --json               # 只看工作流文件
```

---

### 5.2 报错对照表

| 报错 / 现象 | 原因 | 怎么修 |
|---|---|---|
| `npm ERR! 404` 装不上 | 包名写成了 `rea` | 正确包名是 **`rea-agents`** |
| `EBADENGINE Unsupported engine` | Node 版本不在 `22.19+ / 24.11+ / 26+` | 升级 Node。**23 和 25 不受支持**，别用 |
| `rea: command not found` | 用了项目级安装，命令不在 PATH | 写全 `./node_modules/.bin/rea`，或用 `npx -y rea-agents@latest` |
| `Input validation error`（MCP 调用） | 参数写成了 `path` | 改成 **`input_path`**（实测踩过） |
| `ERR_PACKAGE_PATH_NOT_EXPORTED` | MCP SDK 导入写了 `/index.js` 后缀 | 用 `@modelcontextprotocol/client` 和 `.../client/stdio`，**不带 `.js`** |
| `fatal: fetch-pack: invalid index-pack output` | 到 GitHub 的网络断了 | 换网络/代理重试，或干脆用 npm 包（第 2.4 节） |
| `tar: Unexpected EOF in archive` | 源码包下载被截断 | 同上，别用截断包 |
| `curl: (33) HTTP server doesn't seem to support byte ranges` | codeload 不支持续传 | 无法续传，只能整包重下 |
| MCP 里 `58/139 available` | 81 个工具要额外引擎 | **正常现象**，JavaScript 路线用不到 |
| `doctor` 退出码 1、`healthy: false` | 审计全量能力，引擎没装 | 只看 `node`/`host` 是否 ok（第 5.1 节） |
| 分析完但找不到 IPC 配对 | 通道是变量不是字面量 | 预期行为。REA 标 `resolution: dynamic` 且**不配对**，去看 `limitations` |
| 配置了 MCP 但客户端里看不到 | 没重启 / 没信任 | 重启客户端；WorkBuddy 需去连接器页点「信任」 |

---

### 5.3 卡点排查顺序

遇到问题时按这个顺序走，**别跳步**：

**第 1 步 —— 确认 REA 本身是好的**
```bash
./node_modules/.bin/rea --version
```
能输出 `6.3.0`，说明安装没问题，问题在别处。

**第 2 步 —— 确认路径对**
```bash
ls "你的目标绝对路径"
```
必须能看到 `package.json` 或 `.js` 文件。路径写错是最常见的原因。
- 必须是**绝对路径**，相对路径会失败
- Windows 用正斜杠 `C:/...`，别用反斜杠

**第 3 步 —— 看完整错误，别只看最后一行**
```bash
./node_modules/.bin/rea analyze-javascript-application "路径" --json > out.json 2> err.txt
cat err.txt
```
REA 把进度和错误都写到 **stderr**，所以必须重定向 `2>` 才能看到。

**第 4 步 —— 先升版本再排查**
```bash
rea update
# 或用 npx 走的：
npx rea-agents@latest setup
```
REA 更新很勤，很多 bug 新版本已经修了。官方文档的排错建议第一条就是「先更新」。

**第 5 步 —— 缩小范围**
用 `doctor` 的定向检查，别看全量：
```bash
rea doctor --provider hopper --json    # 只查一个引擎
```

---

### 5.4 什么时候该放弃自修

如果上面都试过还不行，去提 issue：https://github.com/morluto/rea/issues

带上这四样：**REA 版本号、目标类型、复现步骤、完整错误输出**。

---

## 附：本轮用到的文件

| 文件 | 作用 |
|---|---|
| `rea-run/targets/electron-demo/` | 示例目标（最小 Electron 应用） |
| `rea-run/evidence.json` / `evidence.err` | 实测分析输出 |
| `rea-run/extract.mjs` | 把 Evidence 整理成人话（`node extract.mjs`） |
| `rea-run/mcp-probe.mjs` | MCP 握手 + 工具调用全流程（`node mcp-probe.mjs`） |
| `rea-run/mcp-schema.mjs` | 打印任意工具的入参定义（`node mcp-schema.mjs`） |
| `rea-run/recreate/` | Recreate 阶段的复现代码与测试 |
| `rea-run/doctor.json` | `rea doctor --json` 的实测输出 |
| `REA本地部署与验证报告.md` | 上一轮的完整部署与验证报告（含证据出处） |
