begin;

select plan(1);

\ir ./helpers/rls_helpers.inc

select tests.seed_fixture();
set local role authenticated;
select tests.set_auth_context(tests.user_a());

select throws_ok(
  $$insert into public.subscriptions (family_id, platform, status, product_id)
    values (tests.family_a(), 'stripe', 'active', 'monthly_799')$$,
  '42501',
  null,
  'authenticated users cannot insert subscriptions'
);

reset role;
select * from finish();

rollback;
