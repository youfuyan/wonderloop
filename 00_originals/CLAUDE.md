文档 2/3：工程宪法（CLAUDE.md + AGENTS.md）+ 数据库 Schema + RLS 策略

> 本文档三部分： > A. CLAUDE.md — 放在仓库根目录，Claude Code 的项目宪法 > B. supabase/migrations/0001_init.sql — 完整 Schema + RLS（与文档 1 的 Episode JSON 契约对齐） > C. AGENTS.md — 放在仓库根目录，Codex 的执行手册（与 CLAUDE.md 共享原则，侧重命令与验证）
A. CLAUDE.md（完整文件内容）

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

B. 数据库 Schema + RLS（supabase/migrations/0001_init.sql）

-- ============================================================
-- WonderLoop 0001_init
-- 目的：初始 schema、RLS、权益函数、WHF 分析视图
-- 回滚：drop schema public cascade（仅开发环境）
-- ============================================================

-- ---------- 枚举 ----------
create type language_mode        as enum ('en', 'zh', 'bilingual');
create type age_band             as enum ('5-6', '6-8', '5-8');
create type episode_status       as enum ('draft', 'reviewed', 'published', 'archived');
create type sensitivity_level    as enum ('none', 'low', 'high');
create type subscription_status  as enum ('trialing', 'active', 'past_due', 'canceled', 'expired');
create type subscription_platform as enum ('stripe', 'app_store');

-- ---------- 通用 updated_at 触发器 ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ============================================================
-- families：家长账户 = 订阅与数据主体
-- ============================================================
create table public.families (
  id             uuid primary key default gen_random_uuid(),
  auth_user_id   uuid not null unique references auth.users(id) on delete cascade,
  email          text not null,
  language_pref  language_mode not null default 'bilingual',
  timezone       text not null default 'America/Los_Angeles',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger trg_families_updated before update on public.families
  for each row execute function public.set_updated_at();

-- 注册时自动建 family（由 auth trigger 驱动，避免客户端插入）
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.families (auth_user_id, email) values (new.id, new.email);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 辅助函数：当前登录用户的 family_id（RLS 中反复使用）
create or replace function public.current_family_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.families where auth_user_id = auth.uid()
$$;

-- ============================================================
-- child_profiles
-- ⛔ 铁律 1：只允许 nickname + age_band，禁止新增儿童数据字段
-- ============================================================
create table public.child_profiles (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families(id) on delete cascade,
  nickname    text not null check (char_length(nickname) between 1 and 20),
  age_band    age_band not null,
  created_at  timestamptz not null default now()
);
comment on table public.child_profiles is
  'ZERO CHILD DATA POLICY: only nickname + age_band. Never add columns for real name, birthday, photo, voice, free text, or location.';
create index idx_child_profiles_family on public.child_profiles(family_id);

-- ============================================================
-- episodes：内容契约（文档 1 的 final.json 整体入 content）
-- ⛔ 铁律 2/4：published 必须有人工批准；表本身不对客户端开放 select
-- ============================================================
create table public.episodes (
  id             uuid primary key default gen_random_uuid(),
  topic_id       text not null unique,
  publish_date   date unique,                 -- 每日一集；draft 可为空
  status         episode_status not null default 'draft',
  category       text not null,
  age_band       age_band not null,
  sensitivity    sensitivity_level not null default 'none',
  title_en       text not null,
  title_zh       text not null,
  is_free        boolean not null default false,   -- 每周 2 集免费完整体验
  content        jsonb not null,              -- final.json 全量（六环节/问题/回顾/双语桥）
  audio          jsonb not null default '{}', -- { en: {path, duration_sec, segments:[{type,start,end}]}, zh: {...} }
  approved_by    text,
  approved_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- 发布前置校验：无人批准不得发布
  constraint published_requires_approval
    check (status <> 'published' or (approved_by is not null and approved_at is not null))
);
create trigger trg_episodes_updated before update on public.episodes
  for each row execute function public.set_updated_at();
create index idx_episodes_publish on public.episodes(publish_date) where status = 'published';

-- 客户端可见的安全目录视图（不含交互内容与音频路径）
create view public.episode_catalog
with (security_invoker = off) as
  select id, topic_id, publish_date, category, age_band,
         title_en, title_zh, is_free,
         (content->'estimated_duration_sec') as duration
  from public.episodes
  where status = 'published' and publish_date <= current_date;

-- ============================================================
-- subscriptions：只能由 service role 写（Stripe / RevenueCat webhook）
-- ============================================================
create table public.subscriptions (
  id                        uuid primary key default gen_random_uuid(),
  family_id                 uuid not null unique references public.families(id) on delete cascade,
  platform                  subscription_platform not null,
  status                    subscription_status not null,
  product_id                text not null,               -- monthly_799 / annual_5900
  trial_end                 timestamptz,
  current_period_end        timestamptz,
  external_customer_id      text,
  external_subscription_id  text,
  updated_at                timestamptz not null default now()
);
create trigger trg_subscriptions_updated before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- 权益判断：单一事实来源
create or replace function public.has_entitlement(fam uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.subscriptions
    where family_id = fam
      and status in ('trialing', 'active')
      and coalesce(current_period_end, now() + interval '1 day') > now()
  )
$$;

-- ============================================================
-- 付费内容门控 RPC（铁律 4 的实现）
-- 免费用户：is_free 集给全量；其余集只给 story-only 子集
-- ============================================================
create or replace function public.get_full_episode(p_episode_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  fam uuid := public.current_family_id();
  ep  public.episodes%rowtype;
  entitled boolean;
begin
  if fam is null then raise exception 'not_authenticated'; end if;

  select * into ep from public.episodes
   where id = p_episode_id and status = 'published' and publish_date <= current_date;
  if not found then raise exception 'episode_not_found'; end if;

  entitled := ep.is_free or public.has_entitlement(fam);

  if entitled then
    return jsonb_build_object(
      'access', 'full',
      'content', ep.content,
      'audio',   ep.audio      -- api 层据此换取 Storage 签名 URL
    );
  else
    -- story-only：剥离交互环节，只保留 hook + story 与标题
    return jsonb_build_object(
      'access', 'story_only',
      'content', jsonb_build_object(
        'title', jsonb_build_object('en', ep.title_en, 'zh', ep.title_zh),
        'segments', (
          select jsonb_agg(s) from jsonb_array_elements(ep.content->'segments') s
          where s->>'type' in ('hook', 'story')
        )
      ),
      'audio', ep.audio        -- api 层只签发 story 区间；见 api-client 约定
    );
  end if;
end $$;

-- ============================================================
-- daily_sessions：好奇心循环的原子记录
-- ============================================================
create table public.daily_sessions (
  id                  uuid primary key default gen_random_uuid(),
  family_id           uuid not null references public.families(id) on delete cascade,
  child_profile_id    uuid references public.child_profiles(id) on delete set null,
  episode_id          uuid not null references public.episodes(id),
  session_date        date not null default current_date,
  language_mode       language_mode not null,
  listened            boolean not null default false,
  predict_choice      text,                      -- 选项 id（a/b/c），非孩子原文
  answered_think      boolean not null default false,
  taught_back         boolean not null default false,
  asked_new_question  boolean not null default false,
  recall_answered     boolean not null default false,
  -- ⭐ 北极星原子：完整好奇心循环（定义与 packages/core 必须一致，有测试保证）
  loop_complete       boolean generated always as
    (listened and answered_think and taught_back and asked_new_question) stored,
  completed_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (family_id, episode_id)
);
create trigger trg_sessions_updated before update on public.daily_sessions
  for each row execute function public.set_updated_at();
create index idx_sessions_family_date on public.daily_sessions(family_id, session_date);
create index idx_sessions_whf on public.daily_sessions(session_date) where loop_complete;

-- ============================================================
-- child_questions：孩子的新问题（家长手动输入，归属家长账户）
-- ============================================================
create table public.child_questions (
  id                uuid primary key default gen_random_uuid(),
  family_id         uuid not null references public.families(id) on delete cascade,
  child_profile_id  uuid references public.child_profiles(id) on delete set null,
  episode_id        uuid references public.episodes(id),
  question_text     text not null check (char_length(question_text) between 1 and 300),
  created_at        timestamptz not null default now()
);
comment on table public.child_questions is
  'Entered manually by the PARENT. Treated as parent-account data, not child data.';
create index idx_child_questions_family on public.child_questions(family_id);

-- ============================================================
-- weekly_digests + waitlist
-- ============================================================
create table public.weekly_digests (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families(id) on delete cascade,
  week_start  date not null,
  stats       jsonb not null,      -- 聚合数：loops_completed、episodes、new_questions_count
  sent_at     timestamptz,
  unique (family_id, week_start)
);

create table public.waitlist (
  id             uuid primary key default gen_random_uuid(),
  email          text not null unique,
  language_pref  language_mode not null default 'bilingual',
  source         text,                          -- xiaohongshu / wechat / school / other
  created_at     timestamptz not null default now()
);

-- ============================================================
-- 分析视图：北极星 WHF（每周完成 ≥3 次完整循环的家庭数）
-- ============================================================
create view public.v_weekly_habit_families
with (security_invoker = off) as
  select week, count(*) as whf
  from (
    select family_id, date_trunc('week', session_date)::date as week
    from public.daily_sessions
    where loop_complete
    group by family_id, date_trunc('week', session_date)
    having count(*) >= 3
  ) t
  group by week;
-- 仅供 service role / 内部仪表盘使用，不授予 anon/authenticated（见下方 grants）

-- ============================================================
-- RLS：全部开启（铁律 3）
-- ============================================================
alter table public.families        enable row level security;
alter table public.child_profiles  enable row level security;
alter table public.episodes        enable row level security;
alter table public.subscriptions   enable row level security;
alter table public.daily_sessions  enable row level security;
alter table public.child_questions enable row level security;
alter table public.weekly_digests  enable row level security;
alter table public.waitlist        enable row level security;

-- families：只能读/改自己，不允许客户端 insert/delete（由 auth trigger 管理）
create policy families_select on public.families
  for select using (auth_user_id = auth.uid());
create policy families_update on public.families
  for update using (auth_user_id = auth.uid());

-- child_profiles：家庭内全权（限制每家 ≤4 个孩子由应用层校验 + 此处兜底）
create policy child_profiles_all on public.child_profiles
  for all using (family_id = public.current_family_id())
  with check (
    family_id = public.current_family_id()
    and (select count(*) from public.child_profiles c
         where c.family_id = public.current_family_id()) < 4
  );

-- episodes：客户端不可直接访问（无 select policy = 默认拒绝）
-- 目录走 episode_catalog 视图，内容走 get_full_episode RPC
grant select on public.episode_catalog to authenticated;

-- subscriptions：家长只读自己的；写入仅 service role（无 insert/update policy）
create policy subscriptions_select on public.subscriptions
  for select using (family_id = public.current_family_id());

-- daily_sessions：家庭内 select/insert/update；禁止 delete（保留学习记录审计）
create policy sessions_select on public.daily_sessions
  for select using (family_id = public.current_family_id());
create policy sessions_insert on public.daily_sessions
  for insert with check (family_id = public.current_family_id());
create policy sessions_update on public.daily_sessions
  for update using (family_id = public.current_family_id())
  with check (family_id = public.current_family_id());

-- child_questions：家庭内全权（家长可删除，兑现"家长可删除全部数据"承诺）
create policy child_questions_all on public.child_questions
  for all using (family_id = public.current_family_id())
  with check (family_id = public.current_family_id());

-- weekly_digests：家长只读
create policy digests_select on public.weekly_digests
  for select using (family_id = public.current_family_id());

-- waitlist：允许匿名 insert（落地页），不允许读
create policy waitlist_insert on public.waitlist
  for insert to anon, authenticated with check (true);

-- ============================================================
-- Storage：音频放私有 bucket，签名 URL 由 API 层签发
-- ============================================================
insert into storage.buckets (id, name, public) values ('episode-audio', 'episode-audio', false);
-- 不为 anon/authenticated 建 storage read policy；
-- 签名 URL 由 Route Handler 用 service role 在校验 get_full_episode 结果后签发。

RLS 验证脚本要求（supabase/tests/rls.test.sql 最低覆盖）
#	场景	期望
1	家庭 A 查询家庭 B 的 daily_sessions / child_questions	0 行
2	authenticated 直接 select * from episodes	权限拒绝
3	免费用户调用 get_full_episode（非 free 集）	access='story_only'，segments 只含 hook/story
4	trialing 用户调用同一 RPC	access='full'
5	authenticated 直接 insert subscriptions	权限拒绝
6	尝试发布 approved_by is null 的 episode	check 约束报错
7	anon insert waitlist / anon select waitlist	成功 / 拒绝
C. AGENTS.md（完整文件内容，供 Codex 执行）

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

本文档的验收方式

给 agent 的首个工程任务卡（跑通"宪法"本身）：

任务：初始化 monorepo + 应用 0001_init migration + RLS 测试

1. 按 CLAUDE.md 结构初始化 pnpm workspace + Turborepo + CI（typecheck/lint/test）
2. 落地 supabase/migrations/0001_init.sql，本地 supabase db reset 成功
3. 实现 packages/core：episode zod schema（对齐文档 1 契约）+ loop.ts
   + loop.consistency.test.ts（用生成列的 SQL 定义做对照测试）
4. 编写 supabase/tests/ 覆盖 B 节表格的 7 个 RLS 场景，全部通过
5. seed 脚本插入 2 集样片数据（用文档 1 产出的 final.json）

验收：pnpm typecheck && lint && test && test:rls 全绿；
      手动用两个测试账号验证互相读不到对方数据。



