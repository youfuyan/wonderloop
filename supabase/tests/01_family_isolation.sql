begin;

select plan(2);

\ir ./helpers/rls_helpers.inc

select tests.seed_fixture();
set local role authenticated;
select tests.set_auth_context(tests.user_a());

select is(
  (select count(*)::integer from public.daily_sessions where family_id = tests.family_b()),
  0,
  'family A cannot read family B daily sessions'
);

select is(
  (select count(*)::integer from public.child_questions where family_id = tests.family_b()),
  0,
  'family A cannot read family B child questions'
);

reset role;
select * from finish();

rollback;
