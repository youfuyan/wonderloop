-- ============================================================
-- WonderLoop 0002_auth_family_delete
-- 目的：P1-03 账户删除 RPC，并修正 child_profiles RLS 以允许 4 个档案时继续编辑
-- 影响的表：families、child_profiles（RLS policy only）
-- 回滚：drop function public.delete_family_cascade(); 恢复 0001 child_profiles_all policy
-- 注意：未新增任何儿童数据字段；child_profiles 仍仅允许 nickname + age_band
-- ============================================================

drop policy if exists child_profiles_all on public.child_profiles;

create policy child_profiles_select on public.child_profiles
  for select using (family_id = public.current_family_id());

create policy child_profiles_insert on public.child_profiles
  for insert with check (
    family_id = public.current_family_id()
    and (select count(*) from public.child_profiles c
         where c.family_id = public.current_family_id()) < 4
  );

create policy child_profiles_update on public.child_profiles
  for update using (family_id = public.current_family_id())
  with check (family_id = public.current_family_id());

create policy child_profiles_delete on public.child_profiles
  for delete using (family_id = public.current_family_id());

create or replace function public.delete_family_cascade()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid := auth.uid();
  target_family_id uuid;
begin
  if target_user_id is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select id
    into target_family_id
  from public.families
  where auth_user_id = target_user_id;

  if target_family_id is null then
    raise exception 'family not found' using errcode = 'P0002';
  end if;

  delete from public.families where id = target_family_id;

  return target_user_id;
end;
$$;

revoke all on function public.delete_family_cascade() from public;
grant execute on function public.delete_family_cascade() to authenticated;
