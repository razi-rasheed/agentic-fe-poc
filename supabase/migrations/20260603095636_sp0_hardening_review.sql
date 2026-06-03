-- Hardening from the SP0 final code review.

-- C2: test-helper SECURITY DEFINER functions must not be PUBLIC/anon/authenticated-executable.
-- They are only ever called as `postgres` during test setup; postgres (owner) keeps access.
revoke execute on function tests.create_supabase_user(text) from public, anon, authenticated;
revoke execute on function tests.get_supabase_uid(text)    from public, anon, authenticated;

-- I1: a plan_session must belong to the SAME athlete as its plan (cross-tenant FK integrity; Decision 1).
alter table public.plans add constraint plans_id_athlete_id_key unique (id, athlete_id);
alter table public.plan_sessions drop constraint plan_sessions_plan_id_fkey;
alter table public.plan_sessions
  add constraint plan_sessions_plan_fkey
  foreign key (plan_id, athlete_id) references public.plans(id, athlete_id) on delete cascade;

-- M1: natural key on prompt_templates (prevents duplicate globals; enables ON CONFLICT upserts).
-- NULLS NOT DISTINCT so two global rows (athlete_id IS NULL) with the same (name, version) conflict.
alter table public.prompt_templates
  add constraint prompt_templates_natural_key unique nulls not distinct (athlete_id, name, version);
