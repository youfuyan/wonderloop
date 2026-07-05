create schema if not exists tests;

create or replace function tests.user_a()
returns uuid
language sql
immutable
as $$
  select '00000000-0000-0000-0000-0000000000a1'::uuid
$$;

create or replace function tests.user_b()
returns uuid
language sql
immutable
as $$
  select '00000000-0000-0000-0000-0000000000b2'::uuid
$$;

create or replace function tests.episode_nonfree()
returns uuid
language sql
immutable
as $$
  select '00000000-0000-0000-0000-0000000000e1'::uuid
$$;

create or replace function tests.episode_free()
returns uuid
language sql
immutable
as $$
  select '00000000-0000-0000-0000-0000000000e2'::uuid
$$;

create or replace function tests.family_a()
returns uuid
language sql
stable
security definer
set search_path = public, tests
as $$
  select id from public.families where auth_user_id = tests.user_a()
$$;

create or replace function tests.family_b()
returns uuid
language sql
stable
security definer
set search_path = public, tests
as $$
  select id from public.families where auth_user_id = tests.user_b()
$$;

create or replace function tests.set_auth_context(user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', user_id::text, 'role', 'authenticated')::text,
    true
  );
end;
$$;

create or replace function tests.create_auth_user(user_id uuid, user_email text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data
  ) values (
    user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    user_email,
    '',
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb
  ) on conflict (id) do nothing;
end;
$$;

create or replace function tests.reset_fixture()
returns void
language plpgsql
security definer
set search_path = public, tests
as $$
begin
  delete from public.waitlist where email like 'rls-%@example.com';
  delete from auth.users where id in (tests.user_a(), tests.user_b());
  delete from public.episodes where id in (tests.episode_nonfree(), tests.episode_free());
end;
$$;

create or replace function tests.seed_fixture()
returns void
language plpgsql
security definer
set search_path = public, tests
as $$
declare
  family_b_id uuid;
begin
  perform tests.reset_fixture();
  perform tests.create_auth_user(tests.user_a(), 'rls-a@example.com');
  perform tests.create_auth_user(tests.user_b(), 'rls-b@example.com');

  insert into public.episodes (
    id,
    topic_id,
    publish_date,
    status,
    category,
    age_band,
    sensitivity,
    title_en,
    title_zh,
    is_free,
    content,
    audio,
    approved_by,
    approved_at
  ) values
  (
    tests.episode_nonfree(),
    'rls-nonfree',
    current_date - 20,
    'published',
    'animals',
    '5-8',
    'none',
    'RLS Nonfree',
    'RLS 非免费',
    false,
    '{"segments":[{"type":"hook"},{"type":"story"},{"type":"think"}],"estimated_duration_sec":{"en":300,"zh":320}}'::jsonb,
    '{"en":{"path":"rls/nonfree.en.mp3"},"zh":{"path":"rls/nonfree.zh.mp3"}}'::jsonb,
    'rls',
    now()
  ),
  (
    tests.episode_free(),
    'rls-free',
    current_date - 19,
    'published',
    'animals',
    '5-8',
    'none',
    'RLS Free',
    'RLS 免费',
    true,
    '{"segments":[{"type":"hook"},{"type":"story"},{"type":"think"}],"estimated_duration_sec":{"en":300,"zh":320}}'::jsonb,
    '{"en":{"path":"rls/free.en.mp3"},"zh":{"path":"rls/free.zh.mp3"}}'::jsonb,
    'rls',
    now()
  );

  family_b_id := tests.family_b();

  insert into public.daily_sessions (
    family_id,
    episode_id,
    language_mode,
    listened,
    answered_think,
    taught_back,
    asked_new_question
  ) values (
    family_b_id,
    tests.episode_nonfree(),
    'en',
    true,
    true,
    true,
    true
  );

  insert into public.child_questions (
    family_id,
    episode_id,
    question_text
  ) values (
    family_b_id,
    tests.episode_nonfree(),
    'Why does this test exist?'
  );
end;
$$;

grant usage on schema tests to public;
grant execute on all functions in schema tests to public;
