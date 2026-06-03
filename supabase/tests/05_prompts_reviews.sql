begin;
select plan(6);

select has_table('public', 'prompt_templates', 'prompt_templates exists');
select has_table('public', 'weekly_reviews', 'weekly_reviews exists');

-- a global template (athlete_id null) is readable by any athlete; an override is private
select tests.create_supabase_user('alice');
select tests.create_supabase_user('bob');
insert into public.prompt_templates (athlete_id, name, template) values (null, 'default', 'GLOBAL {{param_delta}}');
insert into public.prompt_templates (athlete_id, name, template)
  values (tests.get_supabase_uid('bob'), 'bob-override', 'BOB ONLY');

select tests.authenticate_as('alice');
select is((select count(*) from public.prompt_templates), 1::bigint,
  'alice sees the global template but not bob''s override');
select is((select name from public.prompt_templates), 'default', 'alice sees the global default');
select tests.clear_authentication();

select tests.authenticate_as('bob');
select is((select count(*) from public.prompt_templates), 2::bigint,
  'bob sees the global template + his own override');
select tests.clear_authentication();

-- weekly_reviews status CHECK (run as postgres)
select throws_ok(
  $$ insert into public.weekly_reviews (athlete_id, week_start, status)
     values ( (select id from auth.users where email='alice@test.local'), '2026-06-01', 'bogus') $$,
  '23514', null, 'weekly_reviews.status rejects values outside open/locked');

select * from finish();
rollback;
