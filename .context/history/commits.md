# Commit Decision History

> 此文件是 `commits.jsonl` 的人类可读视图，可由工具重生成。
> Canonical store: `commits.jsonl` (JSONL, append-only)

| Date | Context-Id | Commit | Summary | Decisions | Bugs | Risk |
|------|-----------|--------|---------|-----------|------|------|
| 2026-04-27 | `12bcbb67` | `pending` | chore(context): 初始化 .context/ 决策追踪基础设施 | 采用双视图归档（JSONL canonical + md 视图）；放弃单 md（无 union merge）和 SQLite（违反纯 git 工作流） | — | 双文件需同步；current/ 不入库导致设备间手动日志不共享 |
