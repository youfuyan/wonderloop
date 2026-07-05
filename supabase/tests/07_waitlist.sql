begin;

select plan(2);

\ir ./helpers/rls_helpers.inc

select tests.seed_fixture();
set local role anon;

select lives_ok(
  $$insert into public.waitlist (email, language_pref, source)
    values ('rls-waitlist@example.com', 'bilingual', 'rls')$$,
  'anon users can insert waitlist entries'
);

select throws_ok(
  $$select * from public.waitlist$$,
  '42501',
  null,
  'anon users cannot select waitlist entries'
);

reset role;
select * from finish();

rollback;
