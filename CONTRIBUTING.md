# 贡献指南

感谢你愿意一起完善这份 playbook。

## 这个仓库收什么

**收**：

- 新的可分析目标（`targets/` 下，必须是自己写的或者可自由分发的）
- Evidence 提取器支持的新维度（比如把路由表、存储访问也抽出来）
- 新的 Recreate 示例（证据 → 代码 → 测试）
- 排版、错字、更清楚的说明

**不收**：

- REA 自身的代码。REA 是独立项目，问题请提到 <https://github.com/morluto/rea>
- 需要付费许可才能复现的示例
- 任何包含真实密钥、私有路径的分析产物

## 本地开发

```bash
npm install
npm run check      # lint + typecheck + test，提交前必须全绿
```

单个环节：

```bash
npm run lint       # 零依赖静态检查
npm run typecheck  # TypeScript checkJs
npm test           # Node 内置 test runner
npm run verify     # Recreate 闭环断言
```

## 提交前必过的三道闸

1. **`npm run check` 全绿**
2. **没有私有路径**。`tests/hygiene.test.mjs` 会扫描全仓库，命中
   `[A-Za-z]:/Users/...` 形态就红。所有路径必须走 `src/paths.mjs`。
3. **没有密钥**。同一份测试会扫 `sk-`、`ghp_`、`AKIA`、PEM 私钥头等形态。

## 新增一个分析目标

1. 在 `targets/<name>/` 下建目录，至少要有 `package.json`
2. 跑 `npm run analyze -- targets/<name> /tmp/<name>.json`
3. 如果它的 Evidence 进了 `fixtures/`，必须先用 `scripts/make-fixture.mjs`
   脱敏（它会移除 `input_path` 里的绝对路径）
4. 在 `tests/` 里补断言。**断言数字要来自真实分析，不要手写"看起来合理"的值**

## 新增一个 Recreate 示例

每个复现文件头部写清楚它对应哪条证据：

```js
// 证据: [context-bridge-api] demoBridge @ preload.js:7:0, members 3 个
```

这样别人（和三个月后的你）能一眼看出这段代码为什么长这样。

## 提交信息

用 Conventional Commits：

```
feat: 新增 XX 目标的 Evidence 提取
fix: 修正 Windows 下 spawn .cmd 的启动方式
docs: 补充 MCP 配置说明
test: 为路由字面量补断言
chore: 升级 devDependencies
```

## 提 PR

- 一个 PR 一件事
- 说清楚**你验证过什么**（贴命令输出，不要只说"应该可以"）
- CI 在 Node 22.19 与 24.11 上跑，两边都要绿

## License

贡献即表示同意你的代码以 MIT 许可发布。
