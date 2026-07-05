# WonderLoop — AGENTS.md

> 本文件面向自动化 coding agent（Codex 等）。原则性约束见 CLAUDE.md，
> **两文件冲突时以 CLAUDE.md 的"五条铁律"为最高优先级**。本文件侧重：
> 怎么装、怎么跑、怎么验证、怎么提交。

## 环境与启动

```bash
# 依赖
corepack enable && pnpm install

# 本地 Supabase（需要 Docker）
pnpm dlx supabase start          # 启动本地栈
pnpm dlx supabase db reset       # 应用全部 migrations + seed

# 开发
pnpm dev                         # turborepo 并行启动 apps/web
pnpm --filter web dev            # 只启动 web

# 内容管线（独立于应用）
pnpm --filter content generate -- --topic <topic_id>
pnpm --filter content review   -- --topic 
pnpm --filter content tts      -- --topic 
```

## 环境变量（.env.example 为准，缺失时先补 example 再写代码）

```
NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY        # 仅 Route Handler / Edge Functions / content 脚本
STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET
RESEND_API_KEY
POSTHOG_KEY
AZURE_SPEECH_KEY / AZURE_SPEECH_REGION      # content 管线
LLM_API_KEY                                  # content 管线（provider 可配置）
```
⛔ `SUPABASE_SERVICE_ROLE_KEY` 只能被 `apps/web/app/api/**`、
`supabase/functions/**`、`content/scripts/**` 引用。出现在其他位置视为严重错误。

## 提交前必须全绿（CI 同款）

```bash
pnpm typecheck        # tsc --noEmit，strict，禁止 any
pnpm lint             # eslint + prettier check
pnpm test             # vitest（packages/core 覆盖率 ≥ 80%）
pnpm test:rls         # supabase/tests/ RLS 验证（改动 SQL 时必跑）
pnpm build            # turborepo 全量构建
```

## 代码地图（改哪里）

| 需求类型 | 位置 |
|---|---|
| 业务逻辑 / 状态机 / 类型 | `packages/core`（纯 TS + vitest，无 React/Supabase 依赖） |
| 数据访问 / RPC 封装 | `packages/api-client` |
| 页面与路由 | `apps/web/app/**`（RSC 优先） |
| 签名 URL / webhook | `apps/web/app/api/**`（唯一允许 service role 的应用代码） |
| Schema 变更 | 新增 `supabase/migrations/NNNN_*.sql`，禁止修改已合并的 migration |
| 定时任务 | `supabase/functions/**`（weekly-digest 等） |
| 内容管线 | `content/**`，契约类型 import 自 `packages/core` |
| 埋点 | 先登记 `docs/events.md`，再在代码中引用常量（禁止裸字符串事件名） |

## 关键领域规则（写代码前必读）

1. **loop_complete 的定义**只存在两处：SQL 生成列（migrations/0001）和
   `packages/core/src/loop.ts`。任何一处改动必须同步另一处，并更新
   `loop.consistency.test.ts`。
2. **Episode 内容契约**：`packages/core/src/types/episode.ts` 中的 zod schema
   是唯一定义，content 管线和播放器都从这里 import。改契约 = 改这一个文件
   + 相应 migration（如影响 audio jsonb 结构）。
3. **bilingual 模式没有第三版音频**：播放器按主语言加载 en 或 zh 音频，
   bilingual_bridge 和问题卡由前端双语渲染。
4. **付费门控**：客户端永远调用 `get_full_episode` RPC，根据返回的
   `access` 字段渲染 full / story_only + paywall。禁止在客户端做权益判断
   后"决定请求什么"。
5. **音频签名 URL**：`/api/audio-url` Route Handler 校验 RPC 结果后用
   service role 签发，有效期 ≤ 2 小时。

## PR 约定

- 一个任务卡 = 一个 PR；PR ≤ 600 行 diff（migration 除外），超过先拆分
- 分支名：`feat/p1-4-audio-player`、`fix/...`、`sql/...`
- 标题前缀：涉及 child_profiles / subscriptions / RLS 的加 `[SENSITIVE]`
- PR 描述四段：What / Why / How verified（贴命令输出）/ Rollback
- 禁止在 PR 中顺手重构无关代码

## 禁止事项（与 CLAUDE.md 铁律呼应，agent 常见错误清单）

- ❌ 给 `child_profiles` 加任何新字段
- ❌ 实现任何跳过 `approved_by` 校验的发布路径
- ❌ 在 migration 中 `disable row level security` 或给 episodes 加宽松 select policy
- ❌ 在客户端 bundle 中出现 service role key、Stripe secret
- ❌ 运行时调用 LLM API（AI 只在 content/ 离线管线）
- ❌ 用 `any`、`@ts-ignore`（`@ts-expect-error` + 注释原因可以）
- ❌ 新增 >1MB 依赖或常驻服务而不写 docs/adr/
- ❌ 埋点事件带孩子昵称、问题原文等内容字段

## 遇到不确定时

- 产品行为不明确 → 在 PR 描述中列出你的假设，选择**更保守**（少收集数据、
  服务端校验）的实现，不要自行扩展需求
- 契约冲突（如 content JSON 与 zod schema 不符）→ 以 `packages/core` 的
  zod schema 为准，修 content 管线
