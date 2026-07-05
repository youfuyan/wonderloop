begin;

select plan(1);

\ir ./helpers/rls_helpers.inc

select tests.seed_fixture();

insert into public.subscriptions (
  family_id,
  platform,
  status,
  product_id,
  trial_end,
  current_period_end
) values (
  tests.family_a(),
  'stripe',
  'trialing',
  'monthly_799',
  now() + interval '7 days',
  now() + interval '7 days'
);

set local role authenticated;
select tests.set_auth_context(tests.user_a());

select is(
  public.get_full_episode(tests.episode_nonfree())->>'access',
  'full',
  'trialing users get full access through the RPC'
);

reset role;
select * from finish();

rollback;
