# WonderLoop Codex Projects

本包将四份原始 Markdown 分类为同一个 `wonderloop` monorepo 下的七个执行项目。原始文件完整保存在 `00_originals/`；任务正文按原文切分，未改写产品要求、技术要求或验收标准。

## 执行顺序

1. `02_projects/01_foundation`
2. `02_projects/02_web_mvp`
3. `02_projects/03_content_pipeline`（按原文可与 Web 中后段并行）
4. `02_projects/04_retention_analytics_launch`
5. `02_projects/05_monetization`
6. `02_projects/06_ios`

`02_projects/07_growth_operations` 与 Phase 1 开发并行。

## 使用原则

- 所有执行项目都连接同一个 WonderLoop 代码仓库。
- 每次 Codex session 先读取对应目录的 `CODEX_START.md` 和 `PROJECT.md`。
- 全局约束以 `01_shared/CLAUDE.md` 为最高优先级，执行方式以 `01_shared/AGENTS.md` 为准。
- 每张任务卡保持一个 PR；任务范围和验收标准来自原文。

## 目录

- `00_originals/`：四份上传文件的逐字副本
- `01_shared/`：全局工程宪法、Codex 指南、SQL、RLS、内容契约和路线图
- `02_projects/`：七个可直接启动的执行包
- `MANIFEST.json`：每个拆分文件对应的原文件行号与 SHA-256
