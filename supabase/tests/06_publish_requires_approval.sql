begin;

select plan(1);

\ir ./helpers/rls_helpers.inc

select tests.seed_fixture();

select throws_ok(
  $$insert into public.episodes (
      topic_id,
      publish_date,
      status,
      category,
      age_band,
      sensitivity,
      title_en,
      title_zh,
      content
    ) values (
      'rls-unapproved',
      current_date,
      'published',
      'animals',
      '5-8',
      'none',
      'Unapproved',
      '未批准',
      '{}'::jsonb
    )$$,
  '23514',
  null,
  'published episodes require approved_by and approved_at'
);

select * from finish();

rollback;
