begin;
select plan(6);

select has_table('public', 'prompt_templates', 'prompt_templates exists');
select has_table('public', 'weekly_reviews', 'weekly_reviews exists');

-- A global template (athlete_id null) is readable by any athlete; a per-athlete override is private.
-- Assertions are row-specific (by unique name) so they are robust to pre-existing / seeded global
-- templates (e.g. the seed's 'default-coach' global). We verify RLS *semantics*, not total counts.
select tests.create_supabase_user('alice');
select tests.create_supabase_user('bob');
insert into public.prompt_templates (athlete_id, name, template) values (null, 'tt-global', 'GLOBAL {{param_delta}}');
insert into public.prompt_templates (athlete_id, name, template)
  values (tests.get_supabase_uid('bob'), 'tt-bob-override', 'BOB ONLY');

select tests.authenticate_as('alice');
select is((select count(*) from public.prompt_templates where name = 'tt-bob-override'), 0::bigint,
  'alice cannot see bob''s private override');
select is((select count(*) from public.prompt_templates where name = 'tt-global'), 1::bigint,
  'alice can see the global template');
select tests.clear_authentication();

select tests.authenticate_as('bob');
select is((select count(*) from public.prompt_templates where name = 'tt-bob-override'), 1::bigint,
  'bob sees his own override');
select tests.clear_authentication();

-- weekly_reviews status CHECK (run as postgres)
select throws_ok(
  $$ insert into public.weekly_reviews (athlete_id, week_start, status)
     values ( (select id from auth.users where email='alice@test.local'), '2026-06-01', 'bogus') $$,
  '23514', null, 'weekly_reviews.status rejects values outside open/locked');

select * from finish();
rollback;
