-- RLS isolation coverage for the tables not directly exercised by 01–05:
-- preference_profiles, weekly_reviews, weekly_feedback, plan_sessions.
-- Each: two athletes own one row; the authenticated athlete must see only their own.
begin;
select plan(4);

select tests.create_supabase_user('rls_alice');
select tests.create_supabase_user('rls_bob');
select tests.get_supabase_uid('rls_alice') as a \gset
select tests.get_supabase_uid('rls_bob')   as b \gset

-- preference_profiles
insert into public.preference_profiles (athlete_id, version) values (:'a', 1);
insert into public.preference_profiles (athlete_id, version) values (:'b', 1);

-- weekly_reviews
insert into public.weekly_reviews (athlete_id, week_start) values (:'a', '2026-06-01');
insert into public.weekly_reviews (athlete_id, week_start) values (:'b', '2026-06-01');

-- weekly_feedback
insert into public.weekly_feedback (athlete_id, week_start, feedback_text) values (:'a', '2026-06-01', 'a fb');
insert into public.weekly_feedback (athlete_id, week_start, feedback_text) values (:'b', '2026-06-01', 'b fb');

-- plans + plan_sessions (session athlete_id must match the plan's athlete_id — composite FK)
insert into public.plans (athlete_id, week_start) values (:'a', '2026-06-01') returning id as pa \gset
insert into public.plans (athlete_id, week_start) values (:'b', '2026-06-01') returning id as pb \gset
insert into public.plan_sessions (plan_id, athlete_id, day_of_week) values (:'pa', :'a', 1);
insert into public.plan_sessions (plan_id, athlete_id, day_of_week) values (:'pb', :'b', 1);

select tests.authenticate_as('rls_alice');
select is((select count(*) from public.preference_profiles), 1::bigint, 'preference_profiles RLS isolates to the authenticated athlete');
select is((select count(*) from public.weekly_reviews),      1::bigint, 'weekly_reviews RLS isolates to the authenticated athlete');
select is((select count(*) from public.weekly_feedback),     1::bigint, 'weekly_feedback RLS isolates to the authenticated athlete');
select is((select count(*) from public.plan_sessions),       1::bigint, 'plan_sessions RLS isolates to the authenticated athlete');
select tests.clear_authentication();

select * from finish();
rollback;
