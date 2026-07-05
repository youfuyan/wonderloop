# Manual Verification

Use this after `supabase db reset` has applied migrations and seed data.

## Seed Account

- Parent email: `seed-parent@example.com`
- Seed content:
  - `animals-bird-powerline`
  - `language-two-languages`

## Account-Isolation Check

1. Create two local Supabase Auth users in Studio, or use the deterministic users created by the RLS tests.
2. Confirm each auth user has exactly one row in `public.families`.
3. Insert a `daily_sessions` row for family A and a separate row for family B.
4. In SQL Editor, set the JWT claims for family A's auth user and query `public.daily_sessions`.
5. Confirm family A sees only family A rows.
6. Repeat as family B and confirm family B sees only family B rows.

## Episode Catalog Check

1. Query `public.episode_catalog` as an authenticated user.
2. Confirm rows include only catalog fields: ID, topic, publish date, category, age band, titles, free flag, and duration.
3. Confirm the view does not expose `content` or audio storage paths.
4. Confirm direct `select * from public.episodes` fails for authenticated users.

## RPC Gating Check

1. As an authenticated user without a trial or active subscription, call `public.get_full_episode` for the non-free seed episode.
2. Confirm `access` is `story_only`.
3. Add a `trialing` subscription row for that user's family using a service role context.
4. Call the RPC again and confirm `access` is `full`.
