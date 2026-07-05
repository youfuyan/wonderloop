# WonderLoop — CLAUDE.md

## 项目一句话

WonderLoop（好奇循环）是面向北美华人家庭（5–8 岁孩子 + 家长）的每日双语
好奇心音频产品。每集 5–8 分钟，完成一次循环：猜一猜 → 听故事 → 回答问题 →
用自己的话解释 → 提出新问题 → 隔天回顾。家长是账户主体和操作者，孩子只是
"和家长一起听"。Web (Next.js) + iOS (Expo)，Freemium 订阅。

## ⛔ 五条不可违背的铁律（任何任务不得突破）

1. **零儿童数据**：数据库中与孩子有关的字段只允许 `nickname` 和 `age_band`。
   禁止新增任何字段收集孩子的真实姓名、生日、照片、语音、自由文本、位置。
   孩子提出的"新问题"由家长手动输入，数据归属家长账户（`family_id`）。
   任何涉及 `child_profiles` 表的 migration 必须在 PR 描述中显式声明
   "本变更未新增儿童数据字段"。

2. **内容必须人工批准**：`episodes` 表中 `status='published'` 的行必须有
   `approved_by` 和 `approved_at`。发布逻辑（publish.ts / RPC）必须校验这两个
   字段，禁止实现任何"自动发布"路径。

3. **RLS 永远开启**：所有表启用 Row Level Security。前端只通过 anon key 访问，
   永不信任客户端。订阅状态只能由 service role（webhook）写入。
   禁止在任何 migration 中出现 `disable row level security`。

4. **付费内容门控在服务端**：交互内容和音频签名 URL 只通过
   `get_full_episode()` RPC 下发，该函数在服务端校验订阅权益。
   禁止把完整 episode content 放进客户端可直接 select 的表/视图。

5. **TypeScript strict，禁止 `any`**：`tsconfig` 的 strict 不可关闭；
   如确需逃逸请用 `unknown` + 类型收窄，并注释原因。

## Monorepo 结构

```
wonderloop/
├── apps/
│   ├── web/            # Next.js 14+ App Router，部署 Cloudflare Pages
│   └── mobile/         # Expo (React Native)，Phase 3 才启用
├── packages/
│   ├── core/           # 纯 TS 业务逻辑：循环状态机、entitlement、类型（无 React 依赖）
│   ├── api-client/     # Supabase 封装 + RPC 调用 + 订阅状态
│   └── ui/             # 设计 token 与跨端组件（可选）
├── content/            # 内容管线（见 content/README.md，独立于应用运行）
├── supabase/
│   ├── migrations/     # SQL migrations（唯一的 schema 变更途径）
│   └── functions/      # Edge Functions：webhooks、weekly-digest
├── docs/
│   ├── events.md       # 埋点事件字典（新事件先改这里再写代码）
│   └── adr/            # 架构决策记录
├── CLAUDE.md
└── AGENTS.md
```

## 技术栈与版本约定

| 层 | 选择 | 备注 |
|---|---|---|
| Web | Next.js 14+ (App Router) + TypeScript + Tailwind | RSC 优先，客户端组件仅限交互处 |
| iOS | Expo SDK 50+ / expo-audio | Phase 3 |
| 后端 | Supabase (Postgres 15 + Auth + Storage + Edge Functions) | |
| 支付 | Stripe (Web) + RevenueCat (iOS)，状态统一进 `subscriptions` 表 | |
| 邮件 | Resend | 每周家长摘要 |
| 分析 | PostHog | 事件名以 docs/events.md 为准 |
| 包管理 | pnpm workspace + Turborepo | |

## 核心领域模型（必须先读懂再写代码）

- **Family**（家庭）= 账户与订阅主体，1 个 auth user ↔ 1 个 family。
- **Episode**（集）= 内容管线产出的 final.json 整体存入 `content` JSONB，
  六环节结构见 `packages/core/src/types/episode.ts`（与 content/ 契约同源，
  由 zod schema 单一定义，两处 import 同一份）。
- **DailySession**（每日会话）= 某家庭对某集的完成记录。
  `loop_complete = listened ∧ answered_think ∧ taught_back ∧ asked_new_question`
  是北极星指标 WHF 的原子单位，**这个定义只能在 SQL 生成列和
  `packages/core` 中各存在一份，且必须有测试保证两者一致**。
- **语言模式**：en / zh / bilingual。bilingual 是前端组装
  （主语言音频 + bilingual_bridge 卡片），没有第三版音频。

## 编码规范

- 所有跨端业务逻辑写在 `packages/core`，用 vitest 单测覆盖；
  apps/ 里只放"接线"代码。
- 循环状态机（segment 推进、暂停点、回顾插入）必须是纯函数 + 单测，
  UI 只消费状态机输出。
- 数据库访问：Web 端优先在 Server Component / Route Handler 中执行；
  客户端组件只调用 `packages/api-client` 暴露的函数。
- 错误处理：对用户展示中英双语文案（从 `packages/core/i18n` 取），
  日志中禁止打印 email 等 PII。
- 命名：数据库 snake_case，TS camelCase，转换在 api-client 层完成。

## Migration 规则

1. 只允许通过 `supabase/migrations/` 新增文件变更 schema，禁止手改线上。
2. 每个 migration 文件头部注释：目的、影响的表、回滚方式。
3. 破坏性变更（drop/rename）必须拆成两个 PR（先加后删）。
4. 改动 `child_profiles` / `subscriptions` / RLS 的 PR 标题加 `[SENSITIVE]` 前缀。

## 测试要求（Definition of Done）

- [ ] `pnpm typecheck && pnpm lint && pnpm test` 全绿
- [ ] `packages/core` 新逻辑有单测；状态机变更必须补状态转移用例
- [ ] RLS 变更附带 `supabase/tests/` 中的 pgTAP 或脚本化验证
      （至少验证：A 家庭读不到 B 家庭的 sessions）
- [ ] 涉及埋点：事件已登记 docs/events.md
- [ ] PR 描述包含：做了什么 / 为什么 / 如何验证 / 回滚方式

## 埋点事件字典（docs/events.md 摘要）

```
episode_started        { episode_id, language_mode }
segment_completed      { episode_id, segment_type }
predict_answered       { episode_id, choice_id }
think_answered         { episode_id }
teach_back_done        { episode_id }
new_question_added     { episode_id }
loop_completed         { episode_id }          ← 北极星原子事件
recall_answered        { episode_id }
trial_started          { plan }
subscription_activated { plan, platform }
paywall_viewed         { source }
```
事件属性中禁止出现孩子昵称、问题原文等内容，只传 ID 与枚举。

## 永远不要做

- 不做社交、排行榜、开放式 AI 聊天、广告
- 不在运行时调用 LLM（所有 AI 只存在于 content/ 离线管线）
- 不引入新的重量级依赖（>1MB 或需常驻服务）而不先写 ADR
- 不在客户端存储 Stripe/RevenueCat secret
- 不用 `service_role` key 出现在 apps/ 目录任何代码中
