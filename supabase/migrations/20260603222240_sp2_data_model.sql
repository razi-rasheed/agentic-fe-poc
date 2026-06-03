-- SP2 data-model additions: admin flag, richer preference availability, race catalog,
-- goal→race linkage + goal_type, and per-athlete race-results history.

-- 1. athletes: admin flag (gates the race-catalog management screens + write policy).
alter table public.athletes add column is_admin boolean not null default false;

-- The current_* views are `select *`, so they depend on every column of their base table.
-- Drop them before altering columns, then recreate (recreation also makes them expose the new columns).
drop view if exists public.current_preference_profile;
drop view if exists public.current_goal_manifest;

-- 2. preference_profiles: mixed-granularity availability + per-discipline long days.
alter table public.preference_profiles
  add column available_hours jsonb,            -- per day: {"hours":n} | {"am":n,"pm":n}; omit day = unspecified
  add column long_swim_day   text,
  add column long_bike_day   text,
  add column long_run_day    text;
alter table public.preference_profiles
  drop column available_days,
  drop column preferred_long_ride_day,
  drop column preferred_long_run_day;

-- 3. races: shared, owner-curated catalog. RLS: read = any authenticated; write = admins only.
create table public.races (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  description    text,
  image_url      text,
  thumbnail_url  text,
  url            text,
  swim_type      text,   -- lake | sea | river | ocean | pool
  bike_terrain   text,   -- flat | rolling | hilly | mountainous
  run_terrain    text,   -- flat | rolling | hilly | trail
  temp_high_c    numeric,
  temp_low_c     numeric,
  water_temp_c   numeric,
  location       text,
  city           text,
  country        text,
  date           date,
  distance_type  text,   -- sprint | olympic | 70.3 | ironman | ...
  race_organizer text,
  race_type      text,
  race_category  text,
  cutoff_swim    interval,
  cutoff_bike    interval,
  cutoff_run     interval,
  cutoff_overall interval,
  created_at     timestamptz not null default now()
);
alter table public.races enable row level security;

create policy races_read on public.races
  for select to authenticated
  using (true);
create policy races_admin_write on public.races
  for all to authenticated
  using (exists (select 1 from public.athletes a where a.id = (select auth.uid()) and a.is_admin))
  with check (exists (select 1 from public.athletes a where a.id = (select auth.uid()) and a.is_admin));

-- 4. goal_manifests: target-race linkage + goal_type (+ free-text fallback via race_url; race_name/date already exist).
alter table public.goal_manifests
  add column race_id   uuid references public.races(id) on delete set null,
  add column race_url  text,
  add column goal_type text check (goal_type in ('finish','target_time','placement'));

-- Recreate the current_* views (now reflecting the new columns). security_invoker so caller RLS applies.
create view public.current_preference_profile with (security_invoker = true) as
  select distinct on (athlete_id) * from public.preference_profiles
  order by athlete_id, version desc;

create view public.current_goal_manifest with (security_invoker = true) as
  select distinct on (athlete_id) * from public.goal_manifests
  order by athlete_id, version desc;

-- 5. race_results: per-athlete finishing history; athlete-controlled visibility.
create table public.race_results (
  id             uuid primary key default gen_random_uuid(),
  athlete_id     uuid not null references public.athletes(id) on delete cascade,
  race_id        uuid references public.races(id) on delete set null,   -- catalog race, if any
  race_name      text,                                                  -- free-text when not catalogued
  race_url       text,
  result_date    date,
  finish_swim    interval,
  finish_t1      interval,
  finish_bike    interval,
  finish_t2      interval,
  finish_run     interval,
  finish_overall interval,
  placement      int,
  category_place text,
  visibility     text not null default 'private' check (visibility in ('private','public')),
  notes          text,
  created_at     timestamptz not null default now()
);
alter table public.race_results enable row level security;

-- read: own rows, plus anyone's public rows
create policy race_results_read on public.race_results
  for select to authenticated
  using (athlete_id = (select auth.uid()) or visibility = 'public');
-- write: own only
create policy race_results_write on public.race_results
  for all to authenticated
  using (athlete_id = (select auth.uid()))
  with check (athlete_id = (select auth.uid()));
