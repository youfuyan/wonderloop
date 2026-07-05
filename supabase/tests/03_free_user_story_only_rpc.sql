begin;

select plan(2);

\ir ./helpers/rls_helpers.inc

select tests.seed_fixture();
set local role authenticated;
select tests.set_auth_context(tests.user_a());

select is(
  public.get_full_episode(tests.episode_nonfree())->>'access',
  'story_only',
  'free users get story_only access for non-free episodes'
);

select is(
  (
    select string_agg(segment->>'type', ',' order by ordinal_position)
    from jsonb_array_elements(
      public.get_full_episode(tests.episode_nonfree())->'content'->'segments'
    ) with ordinality as segment_list(segment, ordinal_position)
  ),
  'hook,story',
  'story_only content only includes hook and story segments'
);

reset role;
select * from finish();

rollback;
