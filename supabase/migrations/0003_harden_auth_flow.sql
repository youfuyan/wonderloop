-- ============================================================
-- WonderLoop 0003_harden_auth_flow
-- 目的：加固 P1-03 登录跳转、onboarding 状态与账户删除边界
-- 影响的表：families、child_profiles（RLS policy + insert trigger）
-- 回滚：drop trigger/function；删除 onboarding_completed_at；恢复 0002 child_profiles_insert policy；重新 grant delete_family_cascade
-- 注意：未新增任何儿童数据字段；child_profiles 仍仅允许 nickname + age_band
-- ============================================================

alter table public.families
  add column onboarding_completed_at timestamptz;

revoke all on function public.delete_family_cascade() from anon;
revoke all on function public.delete_family_cascade() from authenticated;
revoke all on function public.delete_family_cascade() from public;

create or replace function public.enforce_child_profile_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtext(new.family_id::text));

  if (
    select count(*)
    from public.child_profiles
    where family_id = new.family_id
  ) >= 4 then
    raise exception 'child profile limit reached' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_child_profiles_limit on public.child_profiles;
create trigger trg_child_profiles_limit
  before insert on public.child_profiles
  for each row execute function public.enforce_child_profile_limit();

drop policy if exists child_profiles_insert on public.child_profiles;
create policy child_profiles_insert on public.child_profiles
  for insert with check (family_id = public.current_family_id());
