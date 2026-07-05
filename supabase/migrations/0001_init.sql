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

-- ---------- 显式权限：配合 RLS 策略暴露最小客户端表面 ----------
grant usage on schema public to anon, authenticated;

revoke all on public.families from anon, authenticated;
grant select, update on public.families to authenticated;

revoke all on public.child_profiles from anon, authenticated;
grant select, insert, update, delete on public.child_profiles to authenticated;

revoke all on public.episodes from anon, authenticated;
grant select on public.episode_catalog to authenticated;
grant execute on function public.get_full_episode(uuid) to authenticated;

revoke all on public.subscriptions from anon, authenticated;
grant select on public.subscriptions to authenticated;

revoke all on public.daily_sessions from anon, authenticated;
grant select, insert, update on public.daily_sessions to authenticated;

revoke all on public.child_questions from anon, authenticated;
grant select, insert, update, delete on public.child_questions to authenticated;

revoke all on public.weekly_digests from anon, authenticated;
grant select on public.weekly_digests to authenticated;

revoke all on public.waitlist from anon, authenticated;
grant insert on public.waitlist to anon, authenticated;

-- ============================================================
-- Storage：音频放私有 bucket，签名 URL 由 API 层签发
-- ============================================================
insert into storage.buckets (id, name, public) values ('episode-audio', 'episode-audio', false);
-- 不为 anon/authenticated 建 storage read policy；
-- 签名 URL 由 Route Handler 用 service role 在校验 get_full_episode 结果后签发。
