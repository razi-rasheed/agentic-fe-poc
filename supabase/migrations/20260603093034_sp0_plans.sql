create table public.plans (
  id          uuid primary key default gen_random_uuid(),
  athlete_id  uuid not null references public.athletes(id) on delete cascade,
  week_start  date not null,
  version     int not null default 1,
  status      text not null default 'proposed'
                check (status in ('proposed','approved','synced')),
  source      text not null default 'notebooklm',
  raw_json    jsonb,
  created_at  timestamptz not null default now(),
  approved_at timestamptz,
  synced_at   timestamptz,
  unique (athlete_id, week_start, version)
);

create table public.plan_sessions (
  id              uuid primary key default gen_random_uuid(),
  plan_id         uuid not null references public.plans(id) on delete cascade,
  athlete_id      uuid not null references public.athletes(id) on delete cascade,
  day_of_week     int,
  sport           text,
  session_type    text,
  duration_min    int,
  target_zone     text,
  target_metrics  jsonb,
  rationale       text,
  sort_order      int,
  google_event_id text,
  created_at      timestamptz not null default now()
);

create table public.weekly_feedback (
  id             uuid primary key default gen_random_uuid(),
  athlete_id     uuid not null references public.athletes(id) on delete cascade,
  week_start     date not null,
  feedback_text  text not null,
  source_plan_id uuid references public.plans(id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (athlete_id, week_start)
);

alter table public.plans           enable row level security;
alter table public.plan_sessions   enable row level security;
alter table public.weekly_feedback enable row level security;

create policy tenant_isolation on public.plans
  for all to authenticated
  using ((select auth.uid()) = athlete_id) with check ((select auth.uid()) = athlete_id);
create policy tenant_isolation on public.plan_sessions
  for all to authenticated
  using ((select auth.uid()) = athlete_id) with check ((select auth.uid()) = athlete_id);
create policy tenant_isolation on public.weekly_feedback
  for all to authenticated
  using ((select auth.uid()) = athlete_id) with check ((select auth.uid()) = athlete_id);
