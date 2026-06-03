begin;
select plan(13);

-- columns / tables
select has_column('public', 'athletes', 'is_admin', 'athletes has is_admin');
select has_column('public', 'preference_profiles', 'available_hours', 'preference_profiles has available_hours');
select hasnt_column('public', 'preference_profiles', 'available_days', 'preference_profiles dropped available_days');
select has_column('public', 'preference_profiles', 'long_swim_day', 'preference_profiles has long_swim_day');
select has_column('public', 'goal_manifests', 'race_id', 'goal_manifests has race_id');
select has_column('public', 'goal_manifests', 'goal_type', 'goal_manifests has goal_type');
select has_table('public', 'races', 'races catalog exists');
select has_table('public', 'race_results', 'race_results exists');

-- races: any authenticated reads; non-admin cannot write; admin can
select tests.create_supabase_user('rd_admin');
select tests.create_supabase_user('rd_user');
update public.athletes set is_admin = true where id = tests.get_supabase_uid('rd_admin');
insert into public.races (id, name) values ('33333333-3333-3333-3333-333333333333', 'Seed Race');

select tests.authenticate_as('rd_user');
select is((select count(*) from public.races where name = 'Seed Race'), 1::bigint,
  'any authenticated athlete can read the races catalog');
select throws_ok(
  $$ insert into public.races (name) values ('hacker race') $$,
  '42501', null, 'non-admin cannot write to races');
select tests.clear_authentication();

select tests.authenticate_as('rd_admin');
select lives_ok(
  $$ insert into public.races (name) values ('admin race') $$,
  'admin can write to races');
select tests.clear_authentication();

-- race_results visibility: A's public row visible to B, A's private row is not; B cannot write as A
select tests.get_supabase_uid('rd_admin') as a \gset
select tests.get_supabase_uid('rd_user')  as b \gset
insert into public.race_results (athlete_id, race_name, visibility) values (:'a', 'A public', 'public');
insert into public.race_results (athlete_id, race_name, visibility) values (:'a', 'A private', 'private');

select tests.authenticate_as('rd_user');
select is((select count(*) from public.race_results where athlete_id = :'a'), 1::bigint,
  'B sees only A''s public race_result, not the private one');
select throws_ok(
  format($$ insert into public.race_results (athlete_id, race_name) values (%L, 'x') $$, :'a'),
  '42501', null, 'B cannot write a race_result stamped as A');
select tests.clear_authentication();

select * from finish();
rollback;
