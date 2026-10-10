# Changelog

本项目的所有显著变更都记在这里。格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本 2.0.0](https://semver.org/lang/zh-CN/)。

版本规则：

- **MAJOR** — 破坏性变更：CLI 子命令改名/删除、Evidence 提取结果结构不兼容、Node 最低版本抬高
- **MINOR** — 向后兼容的新能力：新的提取维度、新的靶场、新的 CLI 子命令
- **PATCH** — 修订：修 bug、补文档、调整测试

## [Unreleased]

### Added

- `docs/FAQ.md` — 10 条高频问题的实测答案（doctor 误报、58/139 工具、`input_path` 参数名、
  Node 版本支持范围等）
- `.devcontainer/devcontainer.json` — GitHub Codespaces 一键环境，无需本地安装即可体验
- README 三种上手方式：本地 / Codespaces / 只读脱敏样本
- `.github/ISSUE_TEMPLATE/`（bug / feature / config）与 `.github/pull_request_template.md`
- `.github/workflows/release.yml` — 推送 `v*.*.*` tag 时先跑 `npm run check` 再自动发布 Release
- README 首屏终端演示图与目录

- 网站前端靶场：`inspect_web_page` 的 CDP 示例与 DOM / 网络证据提取
- `.asar` 真实应用示例
- `compare_application_versions` 的版本差异工作流
- 英文版 README

## [1.0.0] - 2026-10-10

首个公开版本。

### Added

- `targets/electron-demo/` — 8 文件最小可分析 Electron 目标，覆盖 IPC（handle / on / invoke / send）、
  hash 路由、DOM、fetch 请求与响应、contextBridge
- `src/extract.mjs` — Evidence 提取器，输出每条结论的 `文件:行号`；IPC、Electron 边界、
  路由、网络、导入依赖、limitations 六类事实
- `src/mcp-probe.mjs` — 通过 MCP stdio 协议验证 REA：握手、工具清单、真实工具调用
- `src/paths.mjs` — 路径与 REA 可执行文件的唯一解析处，无任何硬编码机器路径
- `bin/rea-playbook.mjs` — 统一 CLI：`analyze` / `extract` / `verify` / `probe` / `doctor`
- `recreate/` — 证据 → 代码 → 测试的闭环示例，10/10 断言，每个文件头部标注对应证据行号
- `fixtures/electron-demo.evidence.json` — 脱敏精简样本（1,799,239 → 75,821 字节，4.21%），供离线测试
- `scripts/lint.mjs` — 零依赖静态检查（禁硬编码路径、禁调试残留、禁 TODO）
- `scripts/make-fixture.mjs` — 从真实 Evidence 生成脱敏样本
- 28 个测试（提取器、复现闭环、仓库卫生）
- GitHub Actions CI：Node 22.19 与 24.11 双版本
- `docs/DEPLOYMENT.md`、`docs/TROUBLESHOOTING.md`

### Security

- `.gitignore` 排除 `evidence.json`（含本机绝对路径）、`.env`、`*.pem`、`*.key`
- 提交内容经私有路径与密钥模式双重扫描，无残留

[Unreleased]: https://github.com/jinshi666888/rea-playbook/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/jinshi666888/rea-playbook/releases/tag/v1.0.0
