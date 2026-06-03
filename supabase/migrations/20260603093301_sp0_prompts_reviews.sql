create table public.prompt_templates (
  id          uuid primary key default gen_random_uuid(),
  athlete_id  uuid references public.athletes(id) on delete cascade,   -- NULL = global default
  name        text not null,
  version     int not null default 1,
  template    text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.weekly_reviews (
  id              uuid primary key default gen_random_uuid(),
  athlete_id      uuid not null references public.athletes(id) on delete cascade,
  week_start      date not null,
  status          text not null default 'open' check (status in ('open','locked')),
  locked_at       timestamptz,
  rendered_prompt text,
  created_at      timestamptz not null default now(),
  unique (athlete_id, week_start)
);

alter table public.prompt_templates enable row level security;
alter table public.weekly_reviews    enable row level security;

-- prompt_templates: global rows (athlete_id null) readable by all authenticated; writes only to own rows
create policy pt_read on public.prompt_templates
  for select to authenticated
  using (athlete_id is null or (select auth.uid()) = athlete_id);
create policy pt_write on public.prompt_templates
  for all to authenticated
  using ((select auth.uid()) = athlete_id) with check ((select auth.uid()) = athlete_id);

create policy tenant_isolation on public.weekly_reviews
  for all to authenticated
  using ((select auth.uid()) = athlete_id) with check ((select auth.uid()) = athlete_id);
