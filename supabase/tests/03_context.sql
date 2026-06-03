begin;
select plan(7);

select has_table('public', 'preference_profiles', 'preference_profiles exists');
select has_table('public', 'goal_manifests', 'goal_manifests exists');
select has_column('public', 'preference_profiles', 'change_reason', 'preference_profiles has change_reason');
select has_column('public', 'goal_manifests', 'change_reason', 'goal_manifests has change_reason');

-- versioning + current view returns latest only
select tests.create_supabase_user('alice');
insert into public.goal_manifests (athlete_id, version, race_name, target_run_time)
  values (tests.get_supabase_uid('alice'), 1, 'Race A', interval '1 hour 45 minutes');
insert into public.goal_manifests (athlete_id, version, race_name, target_run_time, change_reason)
  values (tests.get_supabase_uid('alice'), 2, 'Race A', interval '1 hour 40 minutes', 'wants to finish faster');

select tests.authenticate_as('alice');
select is((select count(*) from public.current_goal_manifest), 1::bigint, 'current view returns one row per athlete');
select is((select version from public.current_goal_manifest), 2, 'current view returns the latest version');
select tests.clear_authentication();

-- RLS: the current view respects tenant isolation (security_invoker)
select tests.create_supabase_user('bob');
insert into public.goal_manifests (athlete_id, version, race_name) values (tests.get_supabase_uid('bob'), 1, 'Bob Race');
select tests.authenticate_as('bob');
select is((select count(*) from public.current_goal_manifest), 1::bigint, 'bob sees only his current_goal_manifest');
select tests.clear_authentication();

select * from finish();
rollback;
