begin;
select plan(8);

select has_table('public', 'daily_metrics', 'daily_metrics exists');
select has_table('public', 'activities', 'activities exists');
select has_column('public', 'daily_metrics', 'carbs_g', 'daily_metrics has nutrition column carbs_g');
select col_is_unique('public', 'daily_metrics', array['athlete_id','date'], 'daily_metrics (athlete_id,date) is unique');
select has_column('public', 'activities', 'tags', 'activities has tags array');

-- setup users as postgres (trigger provisions athletes rows)
select tests.create_supabase_user('alice');
select tests.get_supabase_uid('alice') as alice_id \gset

-- idempotent upsert on the natural key
insert into public.daily_metrics (athlete_id, date, resting_hr) values (:'alice_id', '2026-06-01', 50);
insert into public.daily_metrics (athlete_id, date, resting_hr) values (:'alice_id', '2026-06-01', 48)
  on conflict (athlete_id, date) do update set resting_hr = excluded.resting_hr;
select is((select resting_hr from public.daily_metrics where athlete_id = :'alice_id' and date = '2026-06-01'),
  48, 'upsert on (athlete_id,date) updates rather than duplicates');

-- RLS isolation (capture bob's id as postgres; authenticated cannot read auth.users)
select tests.create_supabase_user('bob');
select tests.get_supabase_uid('bob') as bob_id \gset
insert into public.daily_metrics (athlete_id, date, resting_hr) values (:'bob_id', '2026-06-01', 60);
select tests.authenticate_as('alice');
select is((select count(*) from public.daily_metrics), 1::bigint, 'alice sees only her daily_metrics');

-- RLS with-check: alice (authenticated) cannot write a row stamped as bob.
-- bob_id is FK-valid, so the ONLY failure is the RLS WITH CHECK policy -> 42501.
select throws_ok(
  format($$insert into public.activities (athlete_id, intervals_activity_id, date, sport) values (%L, 'x1', '2026-06-01', 'run')$$, :'bob_id'),
  '42501',
  null,
  'alice cannot insert an activity stamped as bob (RLS with check)'
);
select tests.clear_authentication();

select * from finish();
rollback;
