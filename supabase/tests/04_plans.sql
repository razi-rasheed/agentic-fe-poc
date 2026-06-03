begin;
select plan(7);

select has_table('public', 'plans', 'plans exists');
select has_table('public', 'plan_sessions', 'plan_sessions exists');
select has_table('public', 'weekly_feedback', 'weekly_feedback exists');

-- status CHECK constraint rejects bad values (run as postgres)
select tests.create_supabase_user('alice');
select throws_ok(
  $$ insert into public.plans (athlete_id, week_start, status)
     values ( (select id from auth.users where email='alice@test.local'), '2026-06-01', 'bogus') $$,
  '23514',
  null,
  'plans.status rejects values outside proposed/approved/synced'
);

-- raw_json audit retained + lifecycle value accepted
insert into public.plans (athlete_id, week_start, status, raw_json)
  values (tests.get_supabase_uid('alice'), '2026-06-01', 'proposed', '{"sessions":[]}'::jsonb);
select is(
  (select raw_json->>'sessions' is not null from public.plans
     where athlete_id = tests.get_supabase_uid('alice') and week_start='2026-06-01'),
  true, 'plans.raw_json stores the original payload');

-- weekly_feedback one-per-week unique
insert into public.weekly_feedback (athlete_id, week_start, feedback_text)
  values (tests.get_supabase_uid('alice'), '2026-06-01', 'good week');
select throws_ok(
  $$ insert into public.weekly_feedback (athlete_id, week_start, feedback_text)
     values ( (select id from auth.users where email='alice@test.local'), '2026-06-01', 'dupe') $$,
  '23505',
  null,
  'weekly_feedback is unique per (athlete, week_start)');

-- RLS isolation on plans
select tests.create_supabase_user('bob');
insert into public.plans (athlete_id, week_start, status) values (tests.get_supabase_uid('bob'), '2026-06-01', 'proposed');
select tests.authenticate_as('alice');
select is((select count(*) from public.plans), 1::bigint, 'alice sees only her plans');
select tests.clear_authentication();

select * from finish();
rollback;
