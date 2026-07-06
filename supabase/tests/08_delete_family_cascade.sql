begin;

select plan(5);

\ir ./helpers/rls_helpers.inc

select tests.seed_fixture();

create temp table delete_fixture as
select tests.user_a() as user_id, tests.family_a() as family_id;

insert into public.child_profiles (family_id, nickname, age_band)
select family_id, 'Delete Test', '5-8'
from delete_fixture;

insert into public.daily_sessions (
  family_id,
  episode_id,
  language_mode,
  listened,
  answered_think,
  taught_back,
  asked_new_question
)
select
  family_id,
  tests.episode_nonfree(),
  'bilingual',
  true,
  true,
  true,
  true
from delete_fixture;

insert into public.child_questions (family_id, episode_id, question_text)
select family_id, tests.episode_nonfree(), 'Will this disappear?'
from delete_fixture;

set local role authenticated;
select tests.set_auth_context(tests.user_a());

select throws_ok(
  $$select public.delete_family_cascade()$$,
  '42501',
  null,
  'authenticated users cannot directly invoke the family delete RPC'
);

reset role;

delete from auth.users where id = (select user_id from delete_fixture);

select is(
  (select count(*)::integer from auth.users where id = (select user_id from delete_fixture)),
  0,
  'auth user is deleted by the edge-function admin step'
);

select is(
  (select count(*)::integer from public.families where id = (select family_id from delete_fixture)),
  0,
  'family row is deleted'
);

select is(
  (select count(*)::integer from public.child_profiles where family_id = (select family_id from delete_fixture)),
  0,
  'child profiles cascade away'
);

select is(
  (
    select (
      count(*) filter (where source_table = 'daily_sessions')
      + count(*) filter (where source_table = 'child_questions')
    )::integer
    from (
      select 'daily_sessions' as source_table
      from public.daily_sessions
      where family_id = (select family_id from delete_fixture)
      union all
      select 'child_questions' as source_table
      from public.child_questions
      where family_id = (select family_id from delete_fixture)
    ) deleted_children
  ),
  0,
  'session and question rows cascade away'
);

select * from finish();

rollback;
