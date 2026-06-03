create table public.preference_profiles (
  id                      uuid primary key default gen_random_uuid(),
  athlete_id              uuid not null references public.athletes(id) on delete cascade,
  version                 int not null,
  valid_from              timestamptz not null default now(),
  max_hours_per_week      numeric,
  available_days          jsonb,
  preferred_long_ride_day text,
  preferred_long_run_day  text,
  rest_day                text,
  constraints_notes       text,
  change_reason           text,
  created_at              timestamptz not null default now(),
  unique (athlete_id, version)
);

create table public.goal_manifests (
  id                  uuid primary key default gen_random_uuid(),
  athlete_id          uuid not null references public.athletes(id) on delete cascade,
  version             int not null,
  valid_from          timestamptz not null default now(),
  race_name           text,
  race_date           date,
  race_type           text,
  target_swim_time    interval,
  target_bike_time    interval,
  target_run_time     interval,
  target_t1_time      interval,
  target_t2_time      interval,
  target_overall_time interval,
  notes               text,
  change_reason       text,
  created_at          timestamptz not null default now(),
  unique (athlete_id, version)
);

alter table public.preference_profiles enable row level security;
alter table public.goal_manifests       enable row level security;

create policy tenant_isolation on public.preference_profiles
  for all to authenticated
  using ((select auth.uid()) = athlete_id) with check ((select auth.uid()) = athlete_id);
create policy tenant_isolation on public.goal_manifests
  for all to authenticated
  using ((select auth.uid()) = athlete_id) with check ((select auth.uid()) = athlete_id);

-- "Current" = latest version per athlete; security_invoker so the caller's RLS applies.
create view public.current_preference_profile with (security_invoker = true) as
  select distinct on (athlete_id) * from public.preference_profiles
  order by athlete_id, version desc;

create view public.current_goal_manifest with (security_invoker = true) as
  select distinct on (athlete_id) * from public.goal_manifests
  order by athlete_id, version desc;
