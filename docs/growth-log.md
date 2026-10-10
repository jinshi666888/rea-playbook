# 增长日志（Growth Log）

本仓库的 GitHub Traffic 只保留最近 14 天。这个文件用于每周保存快照，避免数据丢失。

**记录人：** jinshi666888  
**基线日期：** 2026-10-10  
**仓库：** https://github.com/jinshi666888/rea-playbook

---

## 采集指标

| 指标 | 含义 | 采集命令 |
|---|---|---|
| Stars | 点赞收藏 | `gh repo view jinshi666888/rea-playbook --json stargazerCount` |
| Forks | 派生仓库数 | `gh repo view jinshi666888/rea-playbook --json forkCount` |
| Watchers | 关注者 | `gh repo view jinshi666888/rea-playbook --json watchers --jq .watchers.totalCount` |
| 14 天浏览 | 仓库页面总浏览 | `gh api repos/jinshi666888/rea-playbook/traffic/views --jq '{count,uniques}'` |
| 14 天克隆 | 仓库被 clone 次数 | `gh api repos/jinshi666888/rea-playbook/traffic/clones --jq '{count,uniques}'` |
| 推荐来源 | 外部引荐站点 | `gh api repos/jinshi666888/rea-playbook/traffic/popular/referrers` |
| 热门内容 | 仓库内被浏览最多的路径 | `gh api repos/jinshi666888/rea-playbook/traffic/popular/paths` |
| Open Issues | 未关闭 issue 数 | `gh repo view ... --json openIssuesCount` |
| Open PRs | 未合并 PR 数 | `gh api repos/.../pulls?state=open --jq 'length'` |
| npm 周下载 | 发布后 | `curl -s https://api.npmjs.org/downloads/point/last-week/rea-playbook` |
| CI 成功率 | 最近 30 天 | `gh run list --limit 50 --json conclusion` |

---

## 基线（2026-10-10，本次方案启动时）

| 指标 | 值 |
|---|---|
| Stars | 0 |
| Forks | 0 |
| Watchers | 0 |
| 14 天浏览 count / uniques | 0 / 0 |
| 14 天克隆 count / uniques | 0 / 0 |
| 推荐来源 | 空 |
| 热门内容 | 空 |
| Open Issues | 0 |
| Open PRs | 0 |
| npm 周下载 | 未发布 |

---

## 记录模板

每周复制下面这段，填写后追加到文件末尾。

```markdown
### 第 X 周（yyyy-mm-dd ~ yyyy-mm-dd）

| 指标 | 本周值 | 环比 | 备注 |
|---|---|---|---|
| Stars | | | |
| Forks | | | |
| 14 天浏览 | | | |
| 14 天克隆 | | | |
| 推荐来源 | | | |
| Open Issues | | | |
| Open PRs | | | |

本周主要改动：
- 

本周主要推广：
- 

观察：
- 
```

---

## 健康阈值速查

- `Star / 独立访客` 1% ~ 3%（低于 0.5% 大概率是首屏问题）
- `克隆 / 独立访客` 5% ~ 15%
- `Fork / Star` 10% ~ 25%

达不到阈值时优先修体验，不要刷量。
