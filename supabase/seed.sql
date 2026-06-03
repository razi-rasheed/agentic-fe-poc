-- Two invited test athletes. Inserting into auth.users fires handle_new_user(),
-- which provisions the matching public.athletes rows.
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111',
   'authenticated', 'authenticated', 'alice@tri.local',
   '{"display_name":"Alice"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222',
   'authenticated', 'authenticated', 'bob@tri.local',
   '{"display_name":"Bob"}', now(), now())
on conflict (id) do nothing;

-- Integration identifiers (secrets are NOT stored here — Vault/GH secrets).
update public.athletes set intervals_athlete_id = 'i00001', timezone = 'Europe/Berlin'
  where id = '11111111-1111-1111-1111-111111111111';
update public.athletes set intervals_athlete_id = 'i00002', timezone = 'Europe/London'
  where id = '22222222-2222-2222-2222-222222222222';

-- v1 context for Alice
insert into public.preference_profiles (athlete_id, version, max_hours_per_week, available_days, preferred_long_ride_day, rest_day)
values ('11111111-1111-1111-1111-111111111111', 1, 10,
  '{"mon":["am"],"tue":["am","pm"],"wed":["am"],"thu":["am"],"fri":["am"],"sat":["am"],"sun":[]}',
  'sat', 'sun')
on conflict (athlete_id, version) do nothing;

insert into public.goal_manifests (athlete_id, version, race_name, race_date, race_type, target_swim_time, target_bike_time, target_run_time, target_overall_time)
values ('11111111-1111-1111-1111-111111111111', 1, 'Ironman 70.3 Test', date '2026-09-01', '70.3',
  interval '35 minutes', interval '2 hours 40 minutes', interval '1 hour 45 minutes', interval '5 hours 10 minutes')
on conflict (athlete_id, version) do nothing;

-- Global NotebookLM prompt template (athlete_id null = default for everyone). Idempotent via NOT EXISTS
-- (prompt_templates has no natural unique key, so `on conflict do nothing` would NOT dedupe).
insert into public.prompt_templates (athlete_id, name, version, template, is_active)
select null, 'default-coach', 1,
$tmpl$You are an evidence-based triathlon coach grounded ONLY in the attached research sources.
Treat current-goal and current-preference as authoritative. Evaluate current-week-data against current-plan.

PARAMETER CHANGES THIS WEEK:
{{param_delta}}

Return ONLY valid JSON: {"feedback": string, "sessions": [{"day_of_week": int, "sport": string, "session_type": string, "duration_min": int, "target_zone": string, "rationale": string}]}.
$tmpl$, true
where not exists (
  select 1 from public.prompt_templates where athlete_id is null and name = 'default-coach' and version = 1
);
