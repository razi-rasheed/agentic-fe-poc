create table public.athletes (
  id                     uuid primary key references auth.users(id) on delete cascade,
  display_name           text not null,
  email                  text not null,
  intervals_athlete_id   text,                 -- non-secret identifier; API key lives in Supabase Vault (SP1)
  google_drive_folder_id text,
  google_calendar_id     text,
  timezone               text not null default 'UTC',
  created_at             timestamptz not null default now()
);

alter table public.athletes enable row level security;

create policy athlete_self on public.athletes
  for all
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Provision an athletes row whenever a new auth user is created (spec §7).
-- search_path = '' + fully-qualified names = SECURITY DEFINER search-path safety.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.athletes (id, display_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
