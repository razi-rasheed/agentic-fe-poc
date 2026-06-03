-- Wide / flat daily row: Core Physiological + Training Load + Nutrition + subjective note.
create table public.daily_metrics (
  id            uuid primary key default gen_random_uuid(),
  athlete_id    uuid not null references public.athletes(id) on delete cascade,
  date          date not null,
  -- Core Physiological
  resting_hr    int,
  hrv           numeric,
  sleep_hours   numeric,
  sleep_score   int,
  readiness     int,
  body_weight   numeric,
  -- Training Load
  ctl           numeric,
  atl           numeric,
  tsb           numeric,
  daily_load    numeric,
  -- Nutrition (source = Review UI / MFP Premium CSV import, NOT the nightly Intervals job)
  calories      int,
  carbs_g       numeric,
  protein_g     numeric,
  fat_g         numeric,
  hydration_ml  int,
  -- Subjective
  notes         text,
  source        text not null default 'intervals.icu',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (athlete_id, date)
);

-- One row per workout (Physical Output pillar; 0..n per day).
create table public.activities (
  id                    uuid primary key default gen_random_uuid(),
  athlete_id            uuid not null references public.athletes(id) on delete cascade,
  intervals_activity_id text not null,
  date                  date not null,
  start_time            timestamptz,
  sport                 text,
  name                  text,
  duration_s            int,
  distance_m            numeric,
  avg_pace              numeric,
  avg_hr                int,
  max_hr                int,
  avg_power             int,
  elevation_gain_m      numeric,
  load                  numeric,
  intensity             numeric,
  tags                  text[] not null default '{}',
  athlete_note          text,
  source                text not null default 'intervals.icu',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (athlete_id, intervals_activity_id)
);

alter table public.daily_metrics enable row level security;
alter table public.activities    enable row level security;

create policy tenant_isolation on public.daily_metrics
  for all to authenticated
  using ((select auth.uid()) = athlete_id) with check ((select auth.uid()) = athlete_id);

create policy tenant_isolation on public.activities
  for all to authenticated
  using ((select auth.uid()) = athlete_id) with check ((select auth.uid()) = athlete_id);
