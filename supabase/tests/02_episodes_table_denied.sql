begin;

select plan(1);

\ir ./helpers/rls_helpers.inc

select tests.seed_fixture();
set local role authenticated;
select tests.set_auth_context(tests.user_a());

select throws_ok(
  $$select * from public.episodes$$,
  '42501',
  null,
  'authenticated users cannot select episodes directly'
);

reset role;
select * from finish();

rollback;
