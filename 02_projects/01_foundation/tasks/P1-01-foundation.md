交付 ①：P1-01 任务卡展开 — Step-by-Step 实现说明

> 这是整个工程的入口任务。以下步骤可直接作为一次（或拆两次）Claude Code / Codex session 的执行脚本。预计 agent 工时：2–3 个 session。
Step 0 · 前置条件（你手动完成，5 分钟）

# 本机需要：Node 20+、pnpm、Docker Desktop（本地 Supabase 依赖）
node -v && docker info
npm i -g pnpm
# 创建 GitHub 私有仓库 wonderloop，clone 到本地
# 把文档 1/2/3 分别放入 docs/spec/ 目录（agent 需要引用）

Step 1 · Monorepo 骨架

给 agent 的指令：

初始化 pnpm workspace + Turborepo：

1. 根目录：
   - pnpm-workspace.yaml: packages 包含 apps/*, packages/*, content
   - turbo.json: pipeline 定义 typecheck / lint / test / build，
     build 依赖 ^build
   - .npmrc: shamefully-hoist=false
   - 根 package.json scripts:
     "dev": "turbo dev", "typecheck": "turbo typecheck",
     "lint": "turbo lint", "test": "turbo test", "build": "turbo build",
     "test:rls": "supabase test db"（占位，Step 4 实现）
2. 共享配置包 packages/config：
   - tsconfig.base.json（strict: true, noUncheckedIndexedAccess: true,
     exactOptionalPropertyTypes: true）
   - eslint 共享配置（禁止 any：@typescript-eslint/no-explicit-any: error）
   - prettier 配置
3. packages/core：空壳 + vitest 配置 + 一个 smoke test
4. packages/api-client：空壳，依赖 @supabase/supabase-js
5. apps/web：create-next-app（App Router, TS, Tailwind），删除示例代码，
   接入共享 tsconfig/eslint
6. .github/workflows/ci.yml：pnpm install → typecheck → lint → test → build
7. CLAUDE.md 和 AGENTS.md 从 docs/spec/ 复制到根目录

验收：pnpm typecheck && pnpm lint && pnpm test && pnpm build 全绿；CI 首跑通过

Step 2 · 本地 Supabase + 0001 Migration

给 agent 的指令：

1. pnpm dlx supabase init
2. 将 docs/spec/文档2 中 B 节的完整 SQL 保存为
   supabase/migrations/0001_init.sql
3. supabase start && supabase db reset，修复所有报错
   注意点（已知易错处）：
   - auth.users trigger 需要 postgres role 权限，本地默认可行
   - 视图的 security_invoker 语法需 PG15+，确认本地镜像版本
   - storage.buckets insert 在 db reset 时执行，若 storage schema
     未就绪则移入独立 seed 文件
4. 生成 TS 类型：supabase gen types typescript --local
   > packages/api-client/src/database.types.ts
   并在 package.json 加 "gen:types" script

验收：supabase db reset 无报错；database.types.ts 生成且包含全部 8 张表

Step 3 · packages/core：契约 + 循环逻辑

给 agent 的指令：

1. src/types/episode.ts：按 docs/spec/文档1 第 1 节的 Episode JSON
   写 zod schema（EpisodeContentSchema），导出推导类型。
   segments 用 discriminatedUnion('type', [...]) 精确到六种环节的字段差异。
2. src/loop.ts：
   - LoopState 类型与 advance(state, event) 纯函数（状态转移表见 P1-05 卡，
     本卡只需实现骨架 + isLoopComplete）
   - isLoopComplete(session): boolean
     = listened && answered_think && taught_back && asked_new_question
3. src/loop.consistency.test.ts：
   从 0001_init.sql 文件中用正则提取 loop_complete 生成列的表达式文本，
   断言其包含且仅包含上述四个字段——SQL 与 TS 定义漂移时测试必挂。
4. src/i18n/：en.ts / zh.ts 字典骨架 + t() 函数

验收：vitest 通过；故意改 SQL 表达式后 consistency test 失败（验证测试有效）

Step 4 · RLS 测试（7 个场景）

给 agent 的指令：

用 supabase test db（pgTAP）或脚本化方式实现 docs/spec/文档2 B 节表格的
7 个场景。推荐 pgTAP 写法示例（场景 1）：

- 用 tests helper 创建两个 auth 用户 A/B（各自触发 family 创建）
- set local role authenticated; set local request.jwt.claims 模拟 A
- 断言 select count(*) from daily_sessions（B 的数据）= 0

每个场景一个 test 文件，命名 supabase/tests/01_family_isolation.sql ... 
07_waitlist.sql。seed helper 放 supabase/tests/helpers/。

验收：pnpm test:rls 全绿；CI 加入该 job（用 supabase GitHub Action 起本地栈）

Step 5 · Seed 样片数据 + 手动验证

给 agent 的指令：

1. supabase/seed.sql：插入 2 集样片（content 来自 content/approved/ 的
   final.json，audio 字段可先用假时间戳）、1 个测试家庭、1 条已完成 session
2. 写 docs/manual-verification.md：两个测试账号互查数据的手动验证步骤

你的手动动作（10 分钟）：
- Supabase Studio 登录两个测试账号，按文档验证隔离
- 确认 episode_catalog 视图只暴露目录字段

完成定义

    CI 四件套 + test:rls 全绿
    pnpm gen:types 可重复执行且无 diff
    仓库根有 CLAUDE.md / AGENTS.md，agent 后续 session 自动读取
    打 tag v0.0.1-foundation
