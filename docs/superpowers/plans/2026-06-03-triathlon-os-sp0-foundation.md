# Triathlon OS — SP0 (Foundation & Data Model) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Model policy (D14): use Sonnet 4.6 for the bulk of tasks; reserve Opus 4.8 for the minimum.**

**Goal:** Stand up the multi-tenant Supabase data model for Triathlon OS — every table, Row-Level Security, versioned views, an auth-provisioning trigger, seed data, generated TypeScript types, and a pgTAP test suite — entirely as version-controlled SQL migrations (never the dashboard).

**Architecture:** Supabase CLI migrations (raw SQL) are the single source of truth, applied to a **Supabase Cloud** project via `supabase db push` — **no local Docker** (D15). Correctness is proven by pgTAP tests run against the cloud dev project via `psql` (and the full suite in CI on the runner), which double as the SP0 verification checklist and the regression baseline for SP1–SP5. RLS (`athlete_id = auth.uid()`) enforces strict tenant isolation; the nightly data engine (SP1) will use the service role, which bypasses RLS. **See "Prerequisites & Execution Model" below for the exact cloud command substitutions.**

**Tech Stack:** Supabase CLI · PostgreSQL 15+ · pgTAP · Supabase Auth (invite-only) · GitHub Actions (CI). No application code in SP0 (the Next.js app is SP2); only the generated types file is produced.

**Source spec:** `docs/superpowers/specs/2026-06-03-triathlon-os-sp0-foundation-design.md` (schema §6, auth §7, migrations-as-code §11, verification §10). Decisions: `docs/superpowers/specs/2026-06-03-triathlon-os-decisions.md`.

---

## Prerequisites & Execution Model — Supabase Cloud, **no local Docker** (D15)

This project runs on **Supabase Cloud**. We do **not** run a local Docker stack. The Supabase CLI manages migrations and types against the **linked cloud project** (none of these commands need Docker).

**One-time setup (do once, before Task 1):**
- Install **Supabase CLI**: `brew install supabase/tap/supabase`. Verify `supabase --version`.
- Install **psql** (to run pgTAP against the cloud DB): `brew install libpq && brew link --force libpq`. Verify `psql --version`.
- `supabase login` (opens a browser for an access token).
- Create a Supabase Cloud **dev** project in the dashboard (or `supabase projects create`); note its **project ref** and the **database password** you set.
- From the project root, `supabase link --project-ref <ref>`.
- Export the cloud DB URL for tests (Project Settings → Database → Connection string → URI; use the **direct** 5432 URI):
  `export SUPABASE_DB_URL="postgresql://postgres:<db-password>@db.<ref>.supabase.co:5432/postgres"`
- Enable pgTAP on the cloud DB once: `psql "$SUPABASE_DB_URL" -c 'create extension if not exists pgtap;'`
- **Invite-only auth is set in the dashboard**, not via migrations: Cloud project → Authentication → Sign In / Providers → **disable new sign-ups**. (Auth config is project settings, not part of `db push`.)
- All commands run from the project root: `/Users/razi.rasheed/Developer/POCs/tri05`.

**Command substitutions — apply these THROUGHOUT the tasks below** (the task steps were written local-first):

| Task step says | Run instead (cloud) |
|---|---|
| `supabase start` | (skip — cloud, no local stack) |
| `supabase db reset` | `supabase db push` (applies pending migrations to the linked cloud project) |
| `supabase test db` | `for f in supabase/tests/*.sql; do echo "== $f =="; psql "$SUPABASE_DB_URL" -f "$f"; done` — pgTAP files self-rollback, so they leave no residue on the cloud DB |
| `supabase gen types typescript --local` | `supabase gen types typescript --linked` |

**Per-task TDD rhythm becomes:** write the test file → run it via `psql "$SUPABASE_DB_URL" -f supabase/tests/<file>.sql` (RED: "relation … does not exist") → `supabase migration new <name>` + write SQL → `supabase db push` → re-run the test file (GREEN) → commit.

> **Notes:**
> - Each migration: `supabase migration new <name>` (auto-timestamps, preserving order), paste SQL, then `supabase db push`.
> - pgTAP files wrap in `begin; select plan(N); … select * from finish(); rollback;` — `N` is the exact assertion count.
> - **Task 1** below: keep `supabase init` (creates `supabase/config.toml` + dirs) and the config-file edits (they document intent + drive any future local use), but the *active* invite-only setting for the cloud project is the dashboard toggle above. Replace Task 1's `supabase start` with the `login` + `link` steps from setup.
> - **Task 10 (CI):** unchanged — it runs `supabase db start` + `supabase test db` on the **GitHub runner's** Docker (not your machine), then `db push` to cloud on merge.

---

## File Structure

```
supabase/
  config.toml                              # Task 1 (supabase init; invite-only auth)
  migrations/
    <ts>_sp0_test_helpers.sql              # Task 2  pgtap + tests schema + auth sim helpers
    <ts>_sp0_athletes.sql                  # Task 3  athletes + provisioning trigger + RLS
    <ts>_sp0_metrics.sql                   # Task 4  daily_metrics + activities + RLS
    <ts>_sp0_context.sql                   # Task 5  preference_profiles + goal_manifests + current_* views + RLS
    <ts>_sp0_plans.sql                     # Task 6  plans + plan_sessions + weekly_feedback + RLS
    <ts>_sp0_prompts_reviews.sql           # Task 7  prompt_templates + weekly_reviews + RLS
  tests/
    01_athletes.sql                        # Task 3
    02_metrics.sql                         # Task 4
    03_context.sql                         # Task 5
    04_plans.sql                           # Task 6
    05_prompts_reviews.sql                 # Task 7
  seed.sql                                 # Task 8
src/lib/database.types.ts                  # Task 9 (generated; the only app-facing artifact)
.github/workflows/db-ci.yml                # Task 10
```

Each migration owns one cohesive slice of the schema (its tables + their RLS + any views/triggers for those tables) so changes that belong together live together.

---

### Task 1: Bootstrap the Supabase project & local stack

**Files:**
- Create: `supabase/config.toml` (generated by `supabase init`)
- Modify: `.gitignore`

- [ ] **Step 1: Initialise the Supabase project**

Run:
```bash
supabase init
```
Expected: creates `supabase/config.toml` and `supabase/.gitignore`. If it asks about generating VS Code settings / Deno, answer `N`.

- [ ] **Step 2: Configure invite-only auth (no public signups)**

Edit `supabase/config.toml`: find the `[auth]` section and set signups off (athletes are invited via the admin API, per spec §7).
```toml
[auth]
enable_signup = false

[auth.email]
enable_signup = false
enable_confirmations = false
```
(If these keys already exist with other values, change them to the above.)

- [ ] **Step 3: Ensure local artifacts are git-ignored**

Append to the project-root `.gitignore` (create the file if missing):
```gitignore
# Supabase local
.branches
.temp
supabase/.temp
# Env
.env
.env.local
```

- [ ] **Step 4: Start the local stack and verify**

Run:
```bash
supabase start
```
Expected: pulls/starts Docker containers and prints a table including `API URL`, `DB URL`, `anon key`, `service_role key`. This confirms a working local Postgres.

Then:
```bash
supabase status
```
Expected: shows services `RUNNING`.

- [ ] **Step 5: Commit**

```bash
git add supabase/config.toml supabase/.gitignore .gitignore
git commit -m "chore(sp0): bootstrap Supabase project + invite-only auth config"
```

---

### Task 2: pgTAP test harness + auth-simulation helpers

Creates the `tests` schema with helper functions that create fake `auth.users` and switch the session to the `authenticated` role with a given `auth.uid()` — the mechanism every RLS test uses. Lives in a migration so the helpers persist across the per-file test transactions. The `tests` schema is never exposed by the API (PostgREST only serves `public`), so shipping it is harmless.

**Files:**
- Create: `supabase/migrations/<ts>_sp0_test_helpers.sql`

- [ ] **Step 1: Create the migration file**

Run:
```bash
supabase migration new sp0_test_helpers
```
Expected: creates `supabase/migrations/<timestamp>_sp0_test_helpers.sql`.

- [ ] **Step 2: Write the helper SQL**

Paste into the generated file:
```sql
-- pgTAP + test-only auth simulation helpers (tests schema is not exposed via the API)
create extension if not exists pgtap with schema extensions;

create schema if not exists tests;

-- Create a fake Supabase auth user and return its id.
create or replace function tests.create_supabase_user(identifier text)
returns uuid
language plpgsql
security definer
set search_path = auth, public
as $$
declare
  uid uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    identifier || '@test.local',
    json_build_object('identifier', identifier, 'display_name', identifier),
    now(), now()
  );
  return uid;
end;
$$;

-- Look up a previously-created test user's id.
create or replace function tests.get_supabase_uid(identifier text)
returns uuid
language sql
stable
security definer
set search_path = auth, public
as $$
  select id from auth.users where email = identifier || '@test.local' limit 1;
$$;

-- Switch the current session to act as the given user under the authenticated role.
create or replace function tests.authenticate_as(identifier text)
returns void
language plpgsql
as $$
declare
  uid uuid := tests.get_supabase_uid(identifier);
begin
  if uid is null then
    raise exception 'No test user with identifier %', identifier;
  end if;
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', uid::text, 'role', 'authenticated', 'email', identifier || '@test.local')::text,
    true
  );
end;
$$;

-- Drop back to the privileged session role (bypasses RLS) for test setup.
create or replace function tests.clear_authentication()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', null, true);
end;
$$;
```

- [ ] **Step 3: Apply and verify the helpers load**

Run:
```bash
supabase db reset
```
Expected: migrations apply with no errors (ends with "Finished supabase db reset.").

- [ ] **Step 4: Smoke-test the harness with a trivial pgTAP file**

Create `supabase/tests/00_harness.sql`:
```sql
begin;
select plan(2);

select has_extension('pgtap');
select isnt(tests.create_supabase_user('harness_check'), null, 'create_supabase_user returns a uuid');

select * from finish();
rollback;
```

Run:
```bash
supabase test db
```
Expected: `00_harness.sql .. ok` and a passing summary.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations supabase/tests/00_harness.sql
git commit -m "test(sp0): add pgTAP + auth-simulation test helpers"
```

---

### Task 3: `athletes` table + provisioning trigger + RLS

**Files:**
- Create: `supabase/migrations/<ts>_sp0_athletes.sql`
- Create: `supabase/tests/01_athletes.sql`

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/01_athletes.sql`:
```sql
begin;
select plan(7);

-- structure
select has_table('public', 'athletes', 'athletes table exists');
select col_is_pk('public', 'athletes', 'id', 'athletes.id is PK');
select hasnt_column('public', 'athletes', 'intervals_api_key', 'no plaintext Intervals secret column (spec §6.4)');
select has_column('public', 'athletes', 'timezone', 'athletes has timezone');

-- provisioning trigger: creating an auth user auto-creates an athletes row
select tests.create_supabase_user('alice');
select is(
  (select count(*) from public.athletes where id = tests.get_supabase_uid('alice')),
  1::bigint,
  'auth user insert provisions an athletes row'
);

-- RLS isolation
select tests.create_supabase_user('bob');
select tests.authenticate_as('alice');
select is((select count(*) from public.athletes), 1::bigint, 'alice sees only her own athlete row');
select tests.clear_authentication();

select tests.authenticate_as('bob');
select is((select count(*) from public.athletes), 1::bigint, 'bob sees only his own athlete row');
select tests.clear_authentication();

select * from finish();
rollback;
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `supabase test db`
Expected: `01_athletes.sql` FAILS (e.g. `has_table` returns false / relation "public.athletes" does not exist).

- [ ] **Step 3: Write the migration**

Run: `supabase migration new sp0_athletes`, then paste:
```sql
create table public.athletes (
  id                     uuid primary key references auth.users(id) on delete cascade,
  display_name           text not null,
  email                  text not null,
  intervals_athlete_id   text,                 -- non-secret identifier; API KEY lives in Supabase Vault (SP1)
  google_drive_folder_id text,
  google_calendar_id     text,
  timezone               text not null default 'UTC',
  created_at             timestamptz not null default now()
);

alter table public.athletes enable row level security;

create policy athlete_self on public.athletes
  for all
  using (id = auth.uid())
  with check (id = auth.uid());

-- Provision an athletes row whenever a new auth user is created (spec §7).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `supabase test db`
Expected: `01_athletes.sql .. ok` (7/7).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations supabase/tests/01_athletes.sql
git commit -m "feat(sp0): athletes table, provisioning trigger, RLS"
```

---

### Task 4: `daily_metrics` + `activities` (wide-flat metrics) + RLS

**Files:**
- Create: `supabase/migrations/<ts>_sp0_metrics.sql`
- Create: `supabase/tests/02_metrics.sql`

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/02_metrics.sql`:
```sql
begin;
select plan(8);

-- structure
select has_table('public', 'daily_metrics', 'daily_metrics exists');
select has_table('public', 'activities', 'activities exists');
select has_column('public', 'daily_metrics', 'carbs_g', 'daily_metrics has nutrition column carbs_g');
select col_is_unique('public', 'daily_metrics', array['athlete_id','date'], 'daily_metrics (athlete_id,date) is unique');
select has_column('public', 'activities', 'tags', 'activities has tags array');

-- idempotent upsert on the natural key
select tests.create_supabase_user('alice');
insert into public.daily_metrics (athlete_id, date, resting_hr) values (tests.get_supabase_uid('alice'), '2026-06-01', 50);
insert into public.daily_metrics (athlete_id, date, resting_hr) values (tests.get_supabase_uid('alice'), '2026-06-01', 48)
  on conflict (athlete_id, date) do update set resting_hr = excluded.resting_hr;
select is((select resting_hr from public.daily_metrics where athlete_id = tests.get_supabase_uid('alice') and date = '2026-06-01'),
  48, 'upsert on (athlete_id,date) updates rather than duplicates');

-- RLS isolation on daily_metrics
select tests.create_supabase_user('bob');
insert into public.daily_metrics (athlete_id, date, resting_hr) values (tests.get_supabase_uid('bob'), '2026-06-01', 60);
select tests.authenticate_as('alice');
select is((select count(*) from public.daily_metrics), 1::bigint, 'alice sees only her daily_metrics');
select tests.clear_authentication();

-- RLS: alice cannot insert a row stamped as bob
select tests.authenticate_as('alice');
select throws_ok(
  $$ insert into public.activities (athlete_id, intervals_activity_id, date, sport)
     values ( (select id from auth.users where email='bob@test.local'), 'x1', '2026-06-01', 'run') $$,
  '42501',
  null,
  'alice cannot insert an activity stamped as bob (RLS with check)'
);
select tests.clear_authentication();

select * from finish();
rollback;
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `supabase test db`
Expected: `02_metrics.sql` FAILS (tables do not exist yet).

- [ ] **Step 3: Write the migration**

Run: `supabase migration new sp0_metrics`, then paste:
```sql
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
  -- Nutrition (source = Review UI / MFP Premium CSV import, NOT the nightly Intervals job — D6)
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
  for all using (athlete_id = auth.uid()) with check (athlete_id = auth.uid());

create policy tenant_isolation on public.activities
  for all using (athlete_id = auth.uid()) with check (athlete_id = auth.uid());
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `supabase test db`
Expected: `02_metrics.sql .. ok` (8/8), and `01_athletes.sql` still ok.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations supabase/tests/02_metrics.sql
git commit -m "feat(sp0): daily_metrics + activities (wide-flat) with RLS"
```

---

### Task 5: `preference_profiles` + `goal_manifests` (append-only versioned) + `current_*` views + RLS

**Files:**
- Create: `supabase/migrations/<ts>_sp0_context.sql`
- Create: `supabase/tests/03_context.sql`

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/03_context.sql`:
```sql
begin;
select plan(7);

select has_table('public', 'preference_profiles', 'preference_profiles exists');
select has_table('public', 'goal_manifests', 'goal_manifests exists');
select has_column('public', 'preference_profiles', 'change_reason', 'preference_profiles has change_reason (D8)');
select has_column('public', 'goal_manifests', 'change_reason', 'goal_manifests has change_reason (D8)');

-- versioning + current view returns latest only
select tests.create_supabase_user('alice');
insert into public.goal_manifests (athlete_id, version, race_name, target_run_time)
  values (tests.get_supabase_uid('alice'), 1, 'Race A', interval '1 hour 45 minutes');
insert into public.goal_manifests (athlete_id, version, race_name, target_run_time, change_reason)
  values (tests.get_supabase_uid('alice'), 2, 'Race A', interval '1 hour 40 minutes', 'wants to finish faster');

select tests.authenticate_as('alice');
select is((select count(*) from public.current_goal_manifest), 1::bigint, 'current view returns one row per athlete');
select is((select version from public.current_goal_manifest), 2, 'current view returns the latest version');
select tests.clear_authentication();

-- RLS: the current view respects tenant isolation (security_invoker)
select tests.create_supabase_user('bob');
insert into public.goal_manifests (athlete_id, version, race_name) values (tests.get_supabase_uid('bob'), 1, 'Bob Race');
select tests.authenticate_as('bob');
select is((select count(*) from public.current_goal_manifest), 1::bigint, 'bob sees only his current_goal_manifest');
select tests.clear_authentication();

select * from finish();
rollback;
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `supabase test db`
Expected: `03_context.sql` FAILS (tables/views absent).

- [ ] **Step 3: Write the migration**

Run: `supabase migration new sp0_context`, then paste:
```sql
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
  for all using (athlete_id = auth.uid()) with check (athlete_id = auth.uid());
create policy tenant_isolation on public.goal_manifests
  for all using (athlete_id = auth.uid()) with check (athlete_id = auth.uid());

-- "Current" = latest version per athlete; security_invoker so the caller's RLS applies.
create view public.current_preference_profile with (security_invoker = true) as
  select distinct on (athlete_id) * from public.preference_profiles
  order by athlete_id, version desc;

create view public.current_goal_manifest with (security_invoker = true) as
  select distinct on (athlete_id) * from public.goal_manifests
  order by athlete_id, version desc;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `supabase test db`
Expected: `03_context.sql .. ok` (7/7); earlier files still ok.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations supabase/tests/03_context.sql
git commit -m "feat(sp0): versioned preference/goal tables + current_* views + RLS"
```

---

### Task 6: `plans` + `plan_sessions` + `weekly_feedback` (historized) + RLS

**Files:**
- Create: `supabase/migrations/<ts>_sp0_plans.sql`
- Create: `supabase/tests/04_plans.sql`

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/04_plans.sql`:
```sql
begin;
select plan(7);

select has_table('public', 'plans', 'plans exists');
select has_table('public', 'plan_sessions', 'plan_sessions exists');
select has_table('public', 'weekly_feedback', 'weekly_feedback exists');

-- status CHECK constraint rejects bad values
select tests.create_supabase_user('alice');
select throws_ok(
  $$ insert into public.plans (athlete_id, week_start, status)
     values ( (select id from auth.users where email='alice@test.local'), '2026-06-01', 'bogus') $$,
  '23514',
  null,
  'plans.status rejects values outside proposed/approved/synced'
);

-- raw_json audit retained + lifecycle value accepted
insert into public.plans (athlete_id, week_start, status, raw_json)
  values (tests.get_supabase_uid('alice'), '2026-06-01', 'proposed', '{"sessions":[]}'::jsonb);
select is(
  (select raw_json->>'sessions' is not null from public.plans
     where athlete_id = tests.get_supabase_uid('alice') and week_start='2026-06-01'),
  true, 'plans.raw_json stores the original payload');

-- weekly_feedback one-per-week unique
insert into public.weekly_feedback (athlete_id, week_start, feedback_text)
  values (tests.get_supabase_uid('alice'), '2026-06-01', 'good week');
select throws_ok(
  $$ insert into public.weekly_feedback (athlete_id, week_start, feedback_text)
     values ( (select id from auth.users where email='alice@test.local'), '2026-06-01', 'dupe') $$,
  '23505',
  null,
  'weekly_feedback is unique per (athlete, week_start)');

-- RLS isolation on plans
select tests.create_supabase_user('bob');
insert into public.plans (athlete_id, week_start, status) values (tests.get_supabase_uid('bob'), '2026-06-01', 'proposed');
select tests.authenticate_as('alice');
select is((select count(*) from public.plans), 1::bigint, 'alice sees only her plans');
select tests.clear_authentication();

select * from finish();
rollback;
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `supabase test db`
Expected: `04_plans.sql` FAILS (tables absent).

- [ ] **Step 3: Write the migration**

Run: `supabase migration new sp0_plans`, then paste:
```sql
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
  for all using (athlete_id = auth.uid()) with check (athlete_id = auth.uid());
create policy tenant_isolation on public.plan_sessions
  for all using (athlete_id = auth.uid()) with check (athlete_id = auth.uid());
create policy tenant_isolation on public.weekly_feedback
  for all using (athlete_id = auth.uid()) with check (athlete_id = auth.uid());
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `supabase test db`
Expected: `04_plans.sql .. ok` (7/7); earlier files still ok.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations supabase/tests/04_plans.sql
git commit -m "feat(sp0): plans + plan_sessions + weekly_feedback with RLS"
```

---

### Task 7: `prompt_templates` (global + override) + `weekly_reviews` + RLS

**Files:**
- Create: `supabase/migrations/<ts>_sp0_prompts_reviews.sql`
- Create: `supabase/tests/05_prompts_reviews.sql`

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/05_prompts_reviews.sql`:
```sql
begin;
select plan(6);

select has_table('public', 'prompt_templates', 'prompt_templates exists');
select has_table('public', 'weekly_reviews', 'weekly_reviews exists');

-- a global template (athlete_id null) is readable by any athlete; an override is private
select tests.create_supabase_user('alice');
select tests.create_supabase_user('bob');
insert into public.prompt_templates (athlete_id, name, template) values (null, 'default', 'GLOBAL {{param_delta}}');
insert into public.prompt_templates (athlete_id, name, template)
  values (tests.get_supabase_uid('bob'), 'bob-override', 'BOB ONLY');

select tests.authenticate_as('alice');
select is((select count(*) from public.prompt_templates), 1::bigint,
  'alice sees the global template but not bob''s override');
select is((select name from public.prompt_templates), 'default', 'alice sees the global default');
select tests.clear_authentication();

select tests.authenticate_as('bob');
select is((select count(*) from public.prompt_templates), 2::bigint,
  'bob sees the global template + his own override');
select tests.clear_authentication();

-- weekly_reviews status CHECK
select throws_ok(
  $$ insert into public.weekly_reviews (athlete_id, week_start, status)
     values ( (select id from auth.users where email='alice@test.local'), '2026-06-01', 'bogus') $$,
  '23514', null, 'weekly_reviews.status rejects values outside open/locked');

select * from finish();
rollback;
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `supabase test db`
Expected: `05_prompts_reviews.sql` FAILS (tables absent).

- [ ] **Step 3: Write the migration**

Run: `supabase migration new sp0_prompts_reviews`, then paste:
```sql
create table public.prompt_templates (
  id          uuid primary key default gen_random_uuid(),
  athlete_id  uuid references public.athletes(id) on delete cascade,  -- NULL = global default
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

-- prompt_templates: global rows (athlete_id null) readable by all; writes only to own rows
create policy pt_read on public.prompt_templates
  for select using (athlete_id is null or athlete_id = auth.uid());
create policy pt_write on public.prompt_templates
  for all using (athlete_id = auth.uid()) with check (athlete_id = auth.uid());

create policy tenant_isolation on public.weekly_reviews
  for all using (athlete_id = auth.uid()) with check (athlete_id = auth.uid());
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `supabase test db`
Expected: `05_prompts_reviews.sql .. ok` (6/6); all earlier files still ok.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations supabase/tests/05_prompts_reviews.sql
git commit -m "feat(sp0): prompt_templates (global+override) + weekly_reviews with RLS"
```

---

### Task 8: Seed data (`seed.sql`)

Seeds two test athletes (via `auth.users` → trigger provisions `athletes`), then their integration ids, a v1 preference + goal, and one global prompt template. Runs automatically on `supabase db reset`.

**Files:**
- Create: `supabase/seed.sql`

- [ ] **Step 1: Write the seed**

Create `supabase/seed.sql`:
```sql
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

-- Integration identifiers (secrets are NOT stored here — Vault/GH secrets, per spec §6.4).
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

-- Global NotebookLM prompt template (athlete_id null = default for everyone)
insert into public.prompt_templates (athlete_id, name, version, template, is_active)
values (null, 'default-coach', 1,
$tmpl$You are an evidence-based triathlon coach grounded ONLY in the attached research sources.
Treat current-goal and current-preference as authoritative. Evaluate current-week-data against current-plan.

PARAMETER CHANGES THIS WEEK:
{{param_delta}}

Return ONLY valid JSON: {"feedback": string, "sessions": [{"day_of_week": int, "sport": string, "session_type": string, "duration_min": int, "target_zone": string, "rationale": string}]}.
$tmpl$, true)
on conflict do nothing;
```

- [ ] **Step 2: Reset to apply migrations + seed, and verify**

Run:
```bash
supabase db reset
```
Expected: ends with "Seeding data from supabase/seed.sql..." and no errors.

- [ ] **Step 3: Verify seed loaded (manual query)**

The local DB connection string is fixed by Supabase: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`. Run:
```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -c "select count(*) as athletes from public.athletes;" \
  -c "select count(*) as global_templates from public.prompt_templates where athlete_id is null;"
```
Expected: `athletes` = `2`; `global_templates` = `1`.

- [ ] **Step 4: Commit**

```bash
git add supabase/seed.sql
git commit -m "feat(sp0): seed two test athletes + v1 context + global prompt template"
```

---

### Task 9: Generate TypeScript types

The only app-facing artifact from SP0; SP2 (Next.js app) will consume it.

**Files:**
- Create: `src/lib/database.types.ts`

- [ ] **Step 1: Generate types from the local schema**

Run:
```bash
mkdir -p src/lib
supabase gen types typescript --local > src/lib/database.types.ts
```
Expected: writes a TypeScript file beginning with `export type Json =` and containing a `Database` type with `public` tables `athletes`, `daily_metrics`, `activities`, `preference_profiles`, `goal_manifests`, `plans`, `plan_sessions`, `weekly_feedback`, `prompt_templates`, `weekly_reviews`.

- [ ] **Step 2: Sanity-check the file**

Run:
```bash
grep -c "weekly_feedback\|plan_sessions\|current_goal_manifest" src/lib/database.types.ts
```
Expected: a count `>= 3` (the tables and the view appear).

- [ ] **Step 3: Commit**

```bash
git add src/lib/database.types.ts
git commit -m "chore(sp0): generate TypeScript database types"
```

---

### Task 10: CI workflow + final verification pass

Wires migrations-as-code into CI (D12): every PR resets a fresh DB and runs the full pgTAP suite. A guarded `db push` step deploys migrations on merge once a remote project + secrets exist.

**Files:**
- Create: `.github/workflows/db-ci.yml`

- [ ] **Step 1: Write the CI workflow**

Create `.github/workflows/db-ci.yml`:
```yaml
name: db-ci
on:
  pull_request:
    paths: ['supabase/**']
  push:
    branches: [main]
    paths: ['supabase/**']

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
        with:
          version: latest
      - name: Start local database
        run: supabase db start
      - name: Run pgTAP tests
        run: supabase test db

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
        with:
          version: latest
      - name: Push migrations to linked project (no-op until secrets are set)
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
          SUPABASE_PROJECT_REF: ${{ secrets.SUPABASE_PROJECT_REF }}
        run: |
          if [ -z "$SUPABASE_PROJECT_REF" ]; then
            echo "No SUPABASE_PROJECT_REF secret set — skipping deploy (expected until a remote project exists)."
            exit 0
          fi
          supabase link --project-ref "$SUPABASE_PROJECT_REF"
          supabase db push
```

- [ ] **Step 2: Final full verification — fresh build from scratch**

Run:
```bash
supabase db reset && supabase test db
```
Expected: migrations apply cleanly from zero, seed loads, and **all** test files report ok:
```
00_harness.sql ........ ok
01_athletes.sql ....... ok
02_metrics.sql ........ ok
03_context.sql ........ ok
04_plans.sql .......... ok
05_prompts_reviews.sql  ok
```

- [ ] **Step 3: Map results to the SP0 verification checklist (spec §10)**

Confirm each §10 item is covered by a green assertion:
1. Migrations apply cleanly — `supabase db reset` succeeds.
2. Tenant isolation (RLS) — `01/02/04` isolation assertions.
3. Versioning + views — `03` current-view assertions.
4. Idempotent upserts — `02` upsert assertion.
5. Plan lifecycle + audit — `04` status CHECK + `raw_json` assertions.
6. Global vs per-athlete prompt template — `05` assertions.
7. Secrets — `01` `hasnt_column('athletes','intervals_api_key')` (Vault-backed secret values are introduced in SP1).

If any item lacks a green assertion, add it to the relevant test file and re-run before continuing.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/db-ci.yml
git commit -m "ci(sp0): pgTAP on PR + guarded migration deploy; SP0 verification green"
```

---

## Notes for the executor

- **Run `supabase start` once** at the beginning of the session; `supabase test db` and `supabase db reset` reuse it.
- **Never edit a migration after it has run on a shared environment** — fix forward with a new `supabase migration new …` (D12).
- **Secrets:** SP0 deliberately stores none. The Intervals API key (Vault) and Google credentials (GH/Vercel secrets) are introduced in SP1/SP3. The only SP0 guarantee is the negative assertion that no secret columns exist.
- **`auth.users` insert columns are version-dependent.** Both `tests.create_supabase_user` (Task 2) and `seed.sql` (Task 8) insert into `auth.users` with the same column set (`instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at`). If your local Supabase CLI's auth schema requires additional NOT NULL columns (e.g. `email_confirmed_at`), add them to **both** places identically — they must stay in sync.
- **Out of scope (later sub-projects):** the Next.js app, the Python data engine, the Drive bridge, NotebookLM ingestion, calendar sync.
