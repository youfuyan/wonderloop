begin;

select plan(4);

\ir ./helpers/rls_helpers.inc

select tests.seed_fixture();
set local role authenticated;
select tests.set_auth_context(tests.user_a());

select lives_ok(
  $$insert into public.child_profiles (family_id, nickname, age_band)
      values (tests.family_a(), 'Kid One', '5-6');
    insert into public.child_profiles (family_id, nickname, age_band)
      values (tests.family_a(), 'Kid Two', '6-8');
    insert into public.child_profiles (family_id, nickname, age_band)
      values (tests.family_a(), 'Kid Three', '5-8');
    insert into public.child_profiles (family_id, nickname, age_band)
      values (tests.family_a(), 'Kid Four', '5-8');$$,
  'authenticated family can insert up to four child profiles'
);

select lives_ok(
  $$update public.child_profiles
    set nickname = 'Kid One Updated'
    where family_id = tests.family_a()
      and nickname = 'Kid One'$$,
  'authenticated family can update child profiles at the four-child limit'
);

select throws_ok(
  $$insert into public.child_profiles (family_id, nickname, age_band)
      values (tests.family_a(), 'Kid Five', '5-8')$$,
  '23514',
  null,
  'fifth child profile insert is rejected by the database limit trigger'
);

select throws_ok(
  $$delete from public.child_profiles where family_id = tests.family_a();
    insert into public.child_profiles (family_id, nickname, age_band)
    values
      (tests.family_a(), 'Bulk One', '5-6'),
      (tests.family_a(), 'Bulk Two', '6-8'),
      (tests.family_a(), 'Bulk Three', '5-8'),
      (tests.family_a(), 'Bulk Four', '5-8'),
      (tests.family_a(), 'Bulk Five', '5-8')$$,
  '23514',
  null,
  'bulk insert cannot bypass the four-child limit'
);

reset role;
select * from finish();

rollback;
