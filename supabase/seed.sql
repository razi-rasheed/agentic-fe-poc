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
-- Alice is the platform owner → is_admin = true (can curate the races catalog).
update public.athletes set intervals_athlete_id = 'i00001', timezone = 'Europe/Berlin', is_admin = true
  where id = '11111111-1111-1111-1111-111111111111';
update public.athletes set intervals_athlete_id = 'i00002', timezone = 'Europe/London', is_admin = false
  where id = '22222222-2222-2222-2222-222222222222';

-- Shared race catalog (owner-curated). Fixed ids for idempotency.
insert into public.races (id, name, description, url, swim_type, bike_terrain, run_terrain,
                          temp_high_c, temp_low_c, water_temp_c, location, city, country, date,
                          distance_type, race_organizer, race_type, race_category,
                          cutoff_swim, cutoff_bike, cutoff_run, cutoff_overall)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Ironman 70.3 Mallorca', 'Sunny island half-distance', 'https://example.com/im703-mallorca',
   'sea', 'rolling', 'flat', 28, 18, 21, 'Alcúdia', 'Alcúdia', 'Spain', date '2026-05-09',
   '70.3', 'Ironman', 'individual', 'age-group',
   interval '1 hour 10 minutes', interval '5 hours 30 minutes', interval '3 hours', interval '8 hours 30 minutes'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Challenge Roth', 'Iconic long-course race', 'https://example.com/roth',
   'river', 'hilly', 'flat', 30, 16, 19, 'Roth', 'Roth', 'Germany', date '2026-07-05',
   'ironman', 'Challenge', 'individual', 'age-group',
   interval '2 hours 20 minutes', interval '10 hours 30 minutes', interval '6 hours', interval '15 hours')
on conflict (id) do nothing;

-- Alice v1 Preference Profile (mixed-granularity availability; refresh on re-seed).
insert into public.preference_profiles
  (athlete_id, version, max_hours_per_week, available_hours, long_swim_day, long_bike_day, long_run_day, rest_day)
values ('11111111-1111-1111-1111-111111111111', 1, 10,
  '{"mon":{"am":1},"tue":{"am":1,"pm":1},"wed":{"hours":1.5},"thu":{"hours":2},"fri":{"am":1},"sat":{"hours":4}}'::jsonb,
  'tue', 'sat', 'thu', 'sun')
on conflict (athlete_id, version) do update set
  max_hours_per_week = excluded.max_hours_per_week,
  available_hours    = excluded.available_hours,
  long_swim_day      = excluded.long_swim_day,
  long_bike_day      = excluded.long_bike_day,
  long_run_day       = excluded.long_run_day,
  rest_day           = excluded.rest_day;

-- Alice v1 Goal Manifest → targets the Mallorca catalog race; target_time goal (refresh on re-seed).
insert into public.goal_manifests
  (athlete_id, version, race_id, goal_type, race_name, race_date, race_type,
   target_swim_time, target_t1_time, target_bike_time, target_t2_time, target_run_time, target_overall_time)
values ('11111111-1111-1111-1111-111111111111', 1,
  'aaaaaaaa-0000-0000-0000-000000000001', 'target_time', 'Ironman 70.3 Mallorca', date '2026-05-09', '70.3',
  interval '35 minutes', interval '3 minutes', interval '2 hours 40 minutes', interval '2 minutes',
  interval '1 hour 45 minutes', interval '5 hours 10 minutes')
on conflict (athlete_id, version) do update set
  race_id             = excluded.race_id,
  goal_type           = excluded.goal_type,
  target_swim_time    = excluded.target_swim_time,
  target_t1_time      = excluded.target_t1_time,
  target_bike_time    = excluded.target_bike_time,
  target_t2_time      = excluded.target_t2_time,
  target_run_time     = excluded.target_run_time,
  target_overall_time = excluded.target_overall_time;

-- Alice's race-results history (public) — feeds "targets from history".
insert into public.race_results
  (id, athlete_id, race_id, result_date, finish_swim, finish_t1, finish_bike, finish_t2, finish_run, finish_overall,
   placement, category_place, visibility, notes)
values ('bbbbbbbb-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
  'aaaaaaaa-0000-0000-0000-000000000001', date '2025-05-10',
  interval '38 minutes', interval '3 minutes', interval '2 hours 50 minutes', interval '2 minutes',
  interval '1 hour 52 minutes', interval '5 hours 25 minutes', 142, 'M35-39 #18', 'public', 'First 70.3 — solid bike')
on conflict (id) do nothing;

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
