# rea-playbook 阶段一验收报告：优化访客体验

> 生成时间：2026-10-10
> 仓库：`https://github.com/jinshi666888/rea-playbook`
> 范围：阶段一「优化首次访客体验」，不推广、不刷 Star、不发布、不改 GitHub 设置、不 push。

---

## 1. 仓库路径、分支、初始 Git 状态

| 项 | 值 |
|---|---|
| 本地路径 | `<repo>`（已脱敏，不在文档中写入真实绝对路径） |
| 分支 | `main` |
| 远程 | `https://github.com/jinshi666888/rea-playbook.git` |
| 起始 HEAD | `77e70c8`（与 `origin/main` 完全同步，ahead 0 / behind 0） |
| 起始工作树 | **干净**（前一阶段的工作已提交并推送为 `77e70c8`） |
| 当前工作树 | **有未提交改动，未推送**（所有改动停留在本地，未执行任何 push / force-push / 改历史） |

> 阶段一的所有修改均为本地未提交状态，由你 review 后再决定是否提交与推送。

---

## 2. 发现的问题和已完成的修改

### 发现的问题
1. **离线预览并非真正零网络**：`npm run demo:offline` 在 Recreate 验证环节会真实调用 `fetch()` 访问 `api.example.com`，靠 `catch` 静默降级。它"不依赖网络也能跑完"，但**过程确实发起了网络请求**，与 README 声称的"不联网"存在事实出入。
2. **README 首屏有虚假「30 秒」承诺**：英文 `## 30-second demo`、中文 `## 30 秒看效果`，而真实分析要 `npx` 拉取 `rea-agents@6.3.0`，首次运行需数分钟，并非 30 秒。
3. **缺少显式「环境要求」一节**：首屏有快速开始，但 Node 版本、是否需要原生引擎、何时联网散落各处，新访客不易一眼看清。
4. **缺 `SECURITY.md`**：反馈入口（Issue/PR 模板、growth-log 已具备）尚差安全披露策略。
5. **测试计数过期**：README/架构图仍写「28 tests」，实际已 32。
6. **离线预览缺专门契约测试**：此前只有"跑通即可"的端到端验证，没有"证明无 REA/网络调用"的断言。

### 已完成的修改
- `recreate/profile-store.mjs`：`loadProfile` 增加 `REA_PLAYBOOK_OFFLINE=1` 短路分支，离线模式**直接返回 local-cache，完全不发起 fetch**。
- `bin/rea-playbook.mjs`：`cmdDemoOffline` 入口设置 `REA_PLAYBOOK_OFFLINE=1`，从契约上锁死"离线不联网"。
- `tests/network-guard.cjs`（新增）：测试预加载，拦截 `fetch`/`net`/`dns`/`http(s)`/`tls` 及非 node 的 `spawn`（即 REA），一旦触达即写违规标记。
- `tests/demo-offline.test.mjs`（新增）：端到端断言 `demo:offline` 退出 0、打印离线横幅、不含「REA 分析失败」、且违规标记文件不存在（= 全程零网络/零 REA）。另加源码构造性契约：校验 `cmdDemoOffline` 不引用 `resolveReaCommand`/`mcp-probe`/`fetch`/`https://` 等入口。
- `tests/profile-store.test.mjs`（新增）：单元断言离线模式不调用 `fetch`、真实模式仍走 fetch+降级。
- `README.md` / `README.zh-CN.md`：移除「30 秒」承诺，新增「Requirements / 环境要求」一节，测试计数 28→32，真实演示注明首次运行需下载 `rea-agents`。
- `SECURITY.md`（新增）：私有漏洞上报、支持版本、响应时效。
- `CHANGELOG.md`：Unreleased 增补上述变更。

---

## 3. 离线预览与真实分析的使用方法

### 离线预览（推荐首次访客，零依赖、零网络）
```bash
npm install            # Codespaces 中已自动完成，可跳过
npm run demo:offline   # 读取 fixtures/electron-demo.evidence.json，打印 file:line 报告，跑 10/10 断言
```
- 只依赖 Node.js；**不调用 REA、不联网、不启动原生逆向引擎、不触发 npx**。
- 输出完全来自仓库内已提交文件，可离线、可复现。

### 真实分析（调用 REA，产出你自己的 Evidence）
```bash
git clone https://github.com/jinshi666888/rea-playbook.git
cd rea-playbook
npm install
npm run analyze   # 调用 REA（首次经 npx 拉取 rea-agents@6.3.0）分析目标，产出本地 Evidence
npm run extract   # 把 Evidence 转成带 file:line 的可读清单
npm run verify    # Recreate：10/10 断言
```
- 仅真实分析需要联网（下载 `rea-agents`）与 Node 22.19+/24.11+/26+；原生引擎（Hopper/Ghidra/IDA）可选、本仓库用不到。

---

## 4. 修改文件清单及修改原因

| 文件 | 状态 | 修改原因 |
|---|---|---|
| `recreate/profile-store.mjs` | 改 | 让离线预览真正零网络（不再先 fetch 再降级） |
| `bin/rea-playbook.mjs` | 改 | `cmdDemoOffline` 锁定 `REA_PLAYBOOK_OFFLINE=1`，契约兜底 |
| `tests/network-guard.cjs` | 新增 | 测试用网络/REA 守护预加载，拦截并标记违规调用 |
| `tests/demo-offline.test.mjs` | 新增 | 端到端证明离线预览零网络/零 REA + 源码构造性契约 |
| `tests/profile-store.test.mjs` | 新增 | `loadProfile` 离线分支单测（不调用 fetch） |
| `README.md` | 改 | 移除虚假「30 秒」、加「Requirements」、计数 28→32 |
| `README.zh-CN.md` | 改 | 同上（中文版） |
| `SECURITY.md` | 新增 | 补全反馈入口的安全披露策略 |
| `CHANGELOG.md` | 改 | 记录阶段一变更 |

---

## 5. 实际运行的测试命令与 PASS / FAIL / BLOCKED 结果

> 每项测试均实际运行；未运行的标注 BLOCKED，绝不标记为通过。

| # | 测试 / 命令 | 实际结果 | 说明 |
|---|---|---|---|
| 1 | `npm run lint` | **PASS** | 扫描 src/bin/recreate/scripts/tests 共若干文件，无 TODO/FIXME/XXX、无 debugger、无私钥路径 |
| 2 | `npm run typecheck`（tsc checkJs） | **PASS** | exit 0 |
| 3 | `npm run test`（node --test） | **PASS** | **32/32 通过**（原 28 + 新增 4） |
| 3.1 | `extract.test.mjs` | **PASS** | 11 项断言（统计/通道/边界/限制等） |
| 3.2 | `hygiene.test.mjs` | **PASS** | 卫生检查 |
| 3.3 | `recreate.test.mjs` | **PASS** | Recreate 验证 10/10 |
| 3.4 | `demo-offline.test.mjs` | **PASS** | 端到端零网络/零 REA + 源码契约（2 项） |
| 3.5 | `profile-store.test.mjs` | **PASS** | 离线不 fetch + 真实降级（2 项） |
| 4 | `npm run demo:offline` | **PASS** | exit 0，打印 OFFLINE PREVIEW 横幅，10/10 checks，网络守护标记文件未生成 |
| 5 | `npm run check`（lint+typecheck+test） | **PASS** | 组合链 exit 0 |
| 6 | 隐私扫描：机器绝对路径 grep（全仓） | **PASS** | 仅命中 `tests/extract.test.mjs` 中的"断言字符串"（用于验证无泄漏，非真实路径） |
| 7 | 密钥扫描：`.pem/.key/.env` 与 `BEGIN PRIVATE KEY` | **PASS** | 无敏感文件被跟踪 |
| 8 | README 首屏合规检查（双语） | **PASS** | 无「30 秒」虚假承诺；用途/真实 demo/快速开始/环境要求/输出样例/能力边界/FAQ/贡献 全部具备 |
| 9 | Social Preview 上传到 GitHub | **BLOCKED** | GitHub 无 API 可设置 Social Preview，需你手动在 Settings 上传 `docs/assets/social-preview.png` |

---

## 6. 隐私与安全检查结果

- **机器绝对路径**：全仓 grep（大小写不敏感）仅 `tests/extract.test.mjs` 命中，且该处是"断言 fixtures 不含本机用户目录绝对路径"的测试字符串，并非真实泄漏。其余源文件、文档、fixtures 均无本机路径。
- **密钥 / 私钥**：无 `.pem`/`.key`/`.env` 被跟踪；无 `BEGIN PRIVATE KEY`；`.gitignore` 已排除 `*.pem`、`*.key`、`.env`。
- **网络边界**：`demo:offline` 经 `REA_PLAYBOOK_OFFLINE=1` + 网络守护预加载双重验证，**零网络、零 REA 调用**（守护标记文件未生成）。
- **依赖**：仅一个运行时依赖 `@modelcontextprotocol/client`；其余为零依赖脚本。无第三方 SDK 密钥写入仓库。

---

## 7. 仍需我手动完成的事项

1. **【必须】上传 Social Preview**：在 GitHub 仓库 `Settings → General → Social preview` 手动上传 `docs/assets/social-preview.png`（1280×640，已提交但无 API 可设置）。
2. **【可选】提交并推送阶段一改动**（我未推送）：
   ```bash
   git add -A
   git commit -m "docs: 阶段一访客体验优化（离线预览零网络、README 首屏、SECURITY）"
   git push origin main
   ```
3. **【可选】修改历史作者**：9 个历史提交作者为 `jingshi56789`（GitHub 用户已 404）。需 force-push 改写历史并重建 tag，涉及风险，等你明确确认后再做。
4. **【可选，超出阶段一】**：`npm publish` 发布 CLI、启用 GitHub Discussions / Private vulnerability reporting（均为 GitHub 设置，本次未动）。

---

## 8. 是否达到阶段一验收标准

**达到（1 项 BLOCKED 为环境性手动操作，非代码缺口）。**

- Task 1（离线预览与真实分析拆分 + 测试证明无 REA/网络）：✅ `npm run demo:offline` 已验证零网络/零 REA，并配专门契约测试。
- Task 2（README 首屏）：✅ 用途、真实 demo（真 GIF）、快速开始、环境要求、输出样例、能力边界、FAQ/文档/贡献入口齐备；已删除虚假「30 秒」承诺。
- Task 3（演示图）：✅ `docs/assets/demo.gif` 为基于真实 stdout 渲染的终端 GIF（约 17s / 94 KB），非手绘、非屏幕录制；README 已引用并注明"基于真实命令输出生成"。
- Task 4（文档/FAQ）：✅ `docs/FAQ.md`、`docs/DEPLOYMENT.md`、`docs/TROUBLESHOOTING.md` 齐全；此前残留的本机路径已清除。
- Task 5（反馈入口）：✅ Issue/PR 模板、`docs/growth-log.md`、本次新增 `SECURITY.md` 均已具备。
- 测试与验收：✅ `npm run check` 32/32 PASS；隐私与安全扫描 PASS。
- 严禁项：✅ 未 push / 未 force-push / 未改历史 / 未 npm publish / 未改 GitHub 设置 / 未推广 / 未刷 Star / 未覆盖未提交工作。

---

## 9. 阶段二建议（仅建议，不执行）

1. **扩充靶场多样性**：新增 React/Vue/原生 Web 等目标，覆盖更多访客的真实场景，提升"照着做就能跑"的代入感。
2. **落地 Roadmap 中的网站前端靶场**：用 CDP 示例做 DOM/网络证据提取，呼应"Reverse Engineer Anything"的宽度。
3. **GitHub Discussions 答疑区**：把重复问题沉淀为 Discussions，降低 Issue 噪声，间接提升新访客留存。
4. **CI 加固 fixture 卫生**：在 `ci.yml` 增加"fixtures 不含机器路径"的断言，防止未来误提交本机路径。
5. **与 client-compat 项目联动**：把 `compare_application_versions` 工作流示例做出来，复用独立的多客户端版本差异方案（client-compat 已就绪，未推送）。
6. **可选着陆页**：一个静态单页（项目用途 + 真实 demo + 三条上手路径）可进一步提升首屏转化，但属于推广范畴，需你确认后再做。
