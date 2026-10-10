# 常见问题（FAQ）

所有答案都来自本机实测，不是推测。

## 安装与运行

### `rea doctor` 报 `healthy: false`，是不是装坏了？

不是。实测输出（exit code 仍然是 1，这是正常的）：

```
node  → ok, 22.22.2
host  → ok, win32 x64
hopper → missing_analysis_engine
ghidra → missing_analysis_engine
ida    → missing_analysis_engine
skill  → missing_analysis_engine
```

`healthy` 是**全局**判定，被原生引擎拖成 false。走 JavaScript / Electron 路线时
**只看 `node` 和 `host` 两项**：都是 ok 就能跑。

### MCP 报 `58/139 tools available`，剩下 81 个是不是没装好？

不是故障，是预期。多出的 81 个工具需要 Hopper / Ghidra / IDA、Linux PTY、JADX、
CDP 端点等前置条件。JS 路线用不到它们。

### Node 23 / 25 能用吗？

不能用。REA 的 `engines` 是 `^22.19.0 || ^24.11.0 || >=26.0.0`，**23 和 25 明确不支持**。
用 `node -v` 确认落在 22.19+ / 24.11+ / 26+ 三档之一。

### 需要装 Hopper / Ghidra / IDA 吗？

分析 Electron 应用和前端页面**什么都不用装**，只要 Node.js。
原生二进制分析才需要三选一，且它的宿主基线是 macOS 12+ / Ubuntu 24.04+ / Fedora 41+，
**Windows 不在支持列表内**（Ghidra on Windows 只标了实验性 P0）。

## MCP 配置

### 调用工具报 `Input validation error: ... required`？

参数名写错了。`analyze_javascript_application` 的必需参数是 **`input_path`**，
不是 `path`、也不是 `filePath`。这是最高频的一个错。

```jsonc
{ "input_path": "/abs/path/to/app" }   // 对
{ "path": "/abs/path/to/app" }         // 错
```

### 为什么版本号要写死 `6.3.0` 而不是 `@latest`？

REA 的 MCP 工具契约会随版本变。写 `@latest` 会在某次静默升级后突然报 schema 不匹配，
且很难排查。写死后升级是显式动作。

```json
{ "mcpServers": { "rea": { "command": "npx", "args": ["-y", "rea-agents@6.3.0", "mcp"] } } }
```

改完配置**必须重启客户端**，热加载对 stdio server 不生效。

### 怎么确认 MCP 真的通了？

```bash
npm run probe
# serverInfo: {"name":"rea","version":"6.3.0"}
# tools: 139 total, 58 available
# analyze_javascript_application: isError=false
```

看到 `isError=false` 才算握手 + 调用都通。

## 分析结果

### `resolution=dynamic` 是什么意思？是不是漏分析了？

恰恰相反——这是 REA **拒绝猜测**的标记。例如 `preload.js` 里三个通道是常量引用，
REA 不会按字面相似度去凑配对：

> Dynamic IPC channel expressions remain unresolved and are never paired by
> textual similarity.

对应的事实是 `paired_renderer_transmissions: 0`，三个通道的 `channel` 字段为 `null`。
本仓库的测试专门断言了这一点，避免哪天有人"顺手修好"它。

### 支持 `.asar` 吗？

支持。REA 会自动识别格式，无需手动解包。

### `npm run analyze` 找不到 REA 怎么办？

按 `REA_BIN` 环境变量 → 本地 `node_modules/.bin/rea` → `npx rea-agents@6.3.0`
三级回退。想固定用某个可执行文件：

```bash
REA_BIN=/path/to/rea npm run analyze
```

### 为什么仓库里没有 `evidence.json`？

它含本机绝对路径，且 1.8 MB。`.gitignore` 明确排除。
测试跑在 `fixtures/electron-demo.evidence.json`（75 KB 脱敏样本）上，所以
`npm test` 完全离线。

## 网络

### `git clone` 报 `invalid index-pack output`？

这是本机到 GitHub 的传输链路问题，不是仓库损坏。实测 codeload tarball 也会稳定
截断在 2,334,862 字节，且服务端不支持 Range 续传（`curl: (33)`）。
**解决办法**：换网络/代理，或者走 npm 通道（`npm install rea-agents@6.3.0`，实测可用）。

---

还有没覆盖的？[提个 issue](https://github.com/jinshi666888/rea-playbook/issues)，
它会变成下一条 FAQ。
