# Coding Style Guide

> 此文件定义团队编码规范，所有 LLM 工具在修改代码时必须遵守。
> 提交到 Git，团队共享。

## General
- Prefer small, reviewable changes; avoid unrelated refactors.
- Keep functions short (<50 lines); avoid deep nesting (≤3 levels).
- Name things explicitly; no single-letter variables except loop counters.
- Handle errors explicitly; never swallow errors silently.

## Language-Specific

### JavaScript (ES Modules)
- `"type": "module"`，禁止 CommonJS 混用
- 2 空格缩进，UTF-8，LF 换行
- 不使用分号
- 单引号，对象花括号内加空格（`{ a, b }`）
- 方法括号前加空格（`function () {}`）
- ESLint v9（`standard` 风格）
- 优先使用 `const`，仅在必要时使用 `let`
- 异步使用 `async/await`，避免裸 Promise 链

## Git Commits
- Conventional Commits, imperative mood.
- Atomic commits: one logical change per commit.
- 中文优先（参照仓库历史提交风格）。

## Testing
- 当前 `tests/` 目录已清空；新增功能若涉及核心逻辑，建议补回单测。
- 覆盖率不应下降。
- Fix flow: write failing test FIRST, then fix code.

## Logging
- 业务流程不打 INFO 级日志；只保留 `console.error` / `console.warn`。
- 用户可见信息走 `e.reply` / `bot.pickFriend`，不重复 `console.log`。

## Security
- Never log secrets (tokens/keys/cookies/JWT).
- Validate inputs at trust boundaries.
