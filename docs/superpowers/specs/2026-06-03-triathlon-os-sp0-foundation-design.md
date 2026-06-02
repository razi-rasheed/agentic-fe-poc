# Triathlon OS — Architecture & SP0 (Foundation & Data Model) Design

**Date:** 2026-06-03
**Status:** Approved design, ready for implementation planning
**Scope of this doc:** the validated whole-system architecture (shared context for every sub-project) + the **detailed, buildable spec for SP0 — Foundation & Data Model**. SP1–SP5 are sketched as a roadmap; each gets its own spec → plan → implementation cycle.

---

## 1. Context

**Triathlon OS** is an AI-driven coaching and tracking platform for endurance athletes. It unifies physiological tracking, training load, physical output, and nutrition into one weekly review, then hands a richly-contextualised package to an AI coach that produces a personalised, course-corrected training plan.

It exists to solve concrete friction in endurance training:

- **Fragmented ecosystem** — athletes cross-reference watches, nutrition apps, and spreadsheets to see one picture.
- **Cognitive bleed in AI coaching** — generic LLMs mix athletes' baselines and hallucinate.
- **Privacy in multi-tenancy** — sharing a tracker usually means sharing sensitive health data or credentials.
- **"Dumb data"** — raw metrics lack the subjective context a coach needs.
- **Daily logging fatigue** — daily journaling burns athletes out.
- **The rigid-plan trap** — static plans can't course-correct when life or goals shift.

**Why this design, and why SP0 first.** The product is genuinely multi-subsystem, so we decomposed it into six independently-buildable sub-projects (SP0–SP5, §8). SP0 is the dependency root: the multi-tenant data model and security boundary that every other sub-project reads from and writes to. Getting the wide-flat schema, the append-only versioning, and Row-Level Security right first is the highest-leverage work — everything else assumes it.

---

## 2. Architecture & Stack (validated)

| Component | Technology | Role |
|-----------|-----------|------|
| AI engine | **Google NotebookLM** (manual) | Source-grounded reasoning over research + athlete context → next-week plan + feedback |
| Data engine | **Python + GitHub Actions** (nightly 23:30) | Pull Intervals.icu, normalise, upsert to Supabase. 6h job budget avoids serverless timeouts |
| Database | **Supabase (PostgreSQL + RLS + Auth + Vault)** | Multi-tenant store; RLS = strict isolation; Vault = secrets |
| Frontend/API | **Next.js on Vercel** | Sunday Review UI + API routes (render prompt, ingest plan, sync files/calendar) |
| Data provider | **Intervals.icu** (official API) | Normalised source for training load, activities, and physiological wellness. **Nutrition is NOT from Intervals** — see below |
| Nutrition | **Manual entry + optional MFP Premium CSV import** (D6) | Entered in the Sunday Review UI; optional bulk import of the official MyFitnessPal Premium CSV export. No scraper. |
| AI bridge | **Google Drive** (4 current files + research PDFs) | NotebookLM's persistent sources |
| Calendar | **Google Calendar** (per-user OAuth) | Approved plan → one event per session |

**Stack-driven constraints that shape the product:**

1. **NotebookLM has no API and cannot write back.** The inference step is manual: the app prepares context (files + a paste-ready prompt); the athlete runs NotebookLM and pastes the JSON output back. "Automatic course-correction" means *the app surfaces the deltas and the athlete re-asks NotebookLM*, which re-reads the updated source files.
2. **NotebookLM grounds on *sources*, not the question box.** The chat input is length-limited; bulk context must live in sources. → **bulk in files, change-signal in the prompt** (§4).
3. **Ingestion split (D6, revised after the D13 spike).** Intervals.icu provides training load, activities, and physiological wellness via its official API. **Nutrition does NOT come from Intervals** — the spike found no reliable MFP→Intervals sync. Nutrition is entered manually in the Review UI, with an optional bulk import of the official **MyFitnessPal Premium CSV export**, landing straight in Supabase.
4. **Secrets never sit in readable columns** — directly honours the "no plain-text credentials" pain point (§6.4).

---

## 3. The Weekly Loop (canonical)

**Setup (once per athlete):** upload research PDFs as NotebookLM sources; app seeds the four current files in the athlete's Drive folder — `current-goal`, `current-preference` (from onboarding), `current-plan` (empty), `current-week-data` (empty).

```
WEEKLY CYCLE
1. Mon–Sat   Intervals.icu → Supabase                                              [SP1]
             (actuals: activities + daily physiological / load / nutrition)
2. Sunday    Athlete reviews the week, adds workout tags + subjective notes        [SP2]
3. If life   Edit Goal/Preference in UI →
   changed     • Supabase: new append-only VERSION (+ change_reason)               [SP0]
               • App computes DELTA (new vs prior version)
4. "Generate App overwrites input-side files NotebookLM must read:                 [SP3]
    prompt"      • current-week-data  (this week's actuals)
                 • current-goal / current-preference  (only if changed this cycle)
             App renders PROMPT = master template + DELTA (prev→current, +reason)   [SP3/4]
               + "evaluate current-week-data vs current-plan, honor current-goal/
                  preference, output JSON {feedback, sessions}"   ← delta-only, tiny
5. Paste     Athlete pastes prompt → NotebookLM (reads research PDFs + 4 files)
             → outputs JSON { feedback, sessions } in chat                          [manual]
6. Ingest    Athlete pastes JSON into the app → validate → render as a nice
             reviewable/editable UI (sessions + feedback). Held as draft.           [SP4]
7. Finalize  "Finalize" button →
               • atomic Supabase write: plans + plan_sessions + weekly_feedback     [SP4]
               • overwrite OUTPUT file current-plan (= next week's baseline)        [SP3]
               • push sessions → Google Calendar; status → synced                   [SP5]
```

**Timing (the subtle part):**
- **Input-side files** (`current-week-data`, and `current-goal`/`current-preference` when changed) are written at **step 4 (Generate)** so NotebookLM reads truthful sources when it generates the plan.
- The **output-side file** `current-plan` is written at **step 7 (Finalize)** — it can't exist before NotebookLM produces it.
- At step 4, `current-plan` still holds *last week's approved plan* = the "what was prescribed" baseline NotebookLM compares this week's actuals against. NotebookLM always sees: **prescribed (current-plan) vs done (current-week-data)**, under **current goal/preference**, with the **delta** called out.

---

## 4. The Context Model: files vs prompt

NotebookLM's persistent **sources** per athlete:

| Source | Format | Holds | Overwritten |
|--------|--------|-------|-------------|
| Research PDFs | PDF | Sports-science grounding | never (manual, once) |
| `current-goal` | Doc/Markdown | Full current Goal Manifest | on change |
| `current-preference` | Doc/Markdown | Full current Preference Profile | on change |
| `current-plan` | Google Sheet | Last approved plan (prescribed baseline) | at Finalize |
| `current-week-data` | Google Sheet | This week's actuals (all 4 pillars + tags/notes) | weekly, at Generate |

The **prompt** carries only the *change signal*, kept tiny (changes are seldom):

```
PARAMETER CHANGES THIS WEEK
Goal Manifest:
  • target_run_time:  1:45:00 → 1:40:00      (reason: wants to finish faster)
Preference Profile:
  • tuesday availability:  AM → none         (reason: new job)
(otherwise unchanged)
```

Including the **previous→current** values is technically redundant (`previous = current − delta`) but practically valuable: it removes an LLM reconstruction step and **explains why `current-plan` looks the way it does** (it was built under the *previous* constraints). Combined with `plan_sessions.rationale` (the LLM's per-session "why," already stored in `current-plan`), the coach has full context to *nudge* rather than *rebuild*. The optional `change_reason` surfaces the human "why," which also enriches the longitudinal record.

**Why bulk-in-files:** a full week of actuals (~3–4k chars) plus standing state risks NotebookLM's input cap. Keeping bulk in sources and only the (rare, tiny) delta in the prompt makes the prompt reliably small. **Fallback if a payload ever overflows:** the affected content already lives in a file, so no change is needed — this is validated empirically in SP4.

### File-write & commit schedule

| Loop step | Trigger | Supabase write | Drive file write |
|-----------|---------|----------------|------------------|
| 3 — edit Goal/Pref | form save | new append-only **version** (+ change_reason) | — |
| 4 — Generate prompt | "Generate" btn | `weekly_reviews`: rendered_prompt, status=locked | overwrite `current-goal`/`current-preference` **if changed**; overwrite `current-week-data` |
| 6 — paste JSON | paste + validate | — (held as draft in UI) | — |
| **7 — Finalize** | **"Finalize" btn** | **atomic:** `plans` + `plan_sessions` + `weekly_feedback` | overwrite **`current-plan`** |
| 7 — calendar (SP5) | same finalize | `plan_sessions.google_event_id`, status→synced | — (Google Calendar) |

**Robustness:** Supabase is the system of record; Drive files are **derived projections**. Finalize commits to Supabase first (one transaction), then writes files — a failed file write is a retryable re-projection, never data loss. `plans.raw_json` preserves the exact JSON NotebookLM produced even if the athlete edits sessions before finalizing.

---

## 5. SP0 Scope

**In scope (this spec):**
- Supabase schema: all tables in §6, with types, constraints, and indexes.
- **Row-Level Security** on every table (strict per-athlete isolation).
- `current_preference_profile` / `current_goal_manifest` views (latest version per athlete).
- Supabase **Auth** configured invite-only; `athletes` row provisioning.
- **Secrets placement**: Intervals credentials in Supabase Vault; Google creds in GH/Vercel secrets (no readable columns).
- **Everything as code** (§11): all DDL/RLS/views/triggers live in `supabase/migrations/` SQL files; seed in `supabase/seed.sql`; TypeScript types generated from the schema. The Supabase dashboard is never used to mutate schema.

**Out of scope (later sub-projects):** the Python data engine (SP1), any UI (SP2), the Drive bridge / prompt rendering (SP3), NotebookLM loop / plan ingestion (SP4), calendar sync (SP5). SP0 delivers the schema and security those build on, plus seed data so they can develop independently.

---

## 6. Data Model

Illustrative DDL (Postgres / Supabase). Final column tuning happens in the implementation plan; constraints, RLS, and versioning semantics below are the contract.

### 6.1 Tenancy & metrics

```sql
-- One row per athlete; id = Supabase auth user id.
create table athletes (
  id                       uuid primary key references auth.users(id) on delete cascade,
  display_name             text not null,
  email                    text not null,
  intervals_athlete_id     text,                 -- non-secret identifier
  google_drive_folder_id   text,                 -- folder holding the 4 current files + research PDFs
  google_calendar_id       text,
  timezone                 text not null default 'UTC',  -- week boundaries / nightly job
  created_at               timestamptz not null default now()
  -- NOTE: Intervals API key + Google creds are NOT columns here. See §6.4.
);

-- Wide / flat: one row per athlete per day. Three pillars + subjective day note.
create table daily_metrics (
  id            uuid primary key default gen_random_uuid(),
  athlete_id    uuid not null references athletes(id) on delete cascade,
  date          date not null,
  -- Core Physiological
  resting_hr    int,
  hrv           numeric,
  sleep_hours   numeric,
  sleep_score   int,
  readiness     int,                 -- normalised universal readiness
  body_weight   numeric,
  -- Training Load
  ctl           numeric,             -- fitness
  atl           numeric,             -- fatigue
  tsb           numeric,             -- form
  daily_load    numeric,             -- TSS-equivalent
  -- Nutrition (source = Review UI manual entry / MFP Premium CSV import, NOT the nightly Intervals job — D6)
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
  unique (athlete_id, date)          -- enables idempotent nightly upsert
);

-- One row per workout (Physical Output pillar; 0..n per day).
create table activities (
  id                     uuid primary key default gen_random_uuid(),
  athlete_id             uuid not null references athletes(id) on delete cascade,
  intervals_activity_id  text not null,
  date                   date not null,
  start_time             timestamptz,
  sport                  text,            -- swim | bike | run | strength | other
  name                   text,
  duration_s             int,
  distance_m             numeric,
  avg_pace               numeric,
  avg_hr                 int,
  max_hr                 int,
  avg_power              int,
  elevation_gain_m       numeric,
  load                   numeric,         -- TSS
  intensity              numeric,         -- IF
  tags                   text[] default '{}',   -- appended during Sunday review
  athlete_note           text,                  -- subjective per-workout
  source                 text not null default 'intervals.icu',
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (athlete_id, intervals_activity_id)     -- idempotent upsert
);
```

### 6.2 Context engine (append-only versioned)

```sql
create table preference_profiles (
  id                      uuid primary key default gen_random_uuid(),
  athlete_id              uuid not null references athletes(id) on delete cascade,
  version                 int not null,
  valid_from              timestamptz not null default now(),
  max_hours_per_week      numeric,
  available_days          jsonb,          -- e.g. {"mon":["am"],"tue":[],...}
  preferred_long_ride_day text,
  preferred_long_run_day  text,
  rest_day                text,
  constraints_notes       text,
  change_reason           text,           -- human "why" for this version (e.g. "new job")
  created_at              timestamptz not null default now(),
  unique (athlete_id, version)
);

create table goal_manifests (
  id                    uuid primary key default gen_random_uuid(),
  athlete_id            uuid not null references athletes(id) on delete cascade,
  version               int not null,
  valid_from            timestamptz not null default now(),
  race_name             text,
  race_date             date,
  race_type             text,             -- sprint | olympic | 70.3 | ironman | ...
  target_swim_time      interval,
  target_bike_time      interval,
  target_run_time       interval,
  target_t1_time        interval,
  target_t2_time        interval,
  target_overall_time   interval,
  notes                 text,
  change_reason         text,
  created_at            timestamptz not null default now(),
  unique (athlete_id, version)
);

-- "Current" = latest version per athlete. security_invoker so RLS applies to callers.
create view current_preference_profile with (security_invoker = true) as
  select distinct on (athlete_id) * from preference_profiles
  order by athlete_id, version desc;

create view current_goal_manifest with (security_invoker = true) as
  select distinct on (athlete_id) * from goal_manifests
  order by athlete_id, version desc;
```

### 6.3 Plan (historized) & feedback

```sql
-- One row per athlete per week per version; never overwritten.
create table plans (
  id           uuid primary key default gen_random_uuid(),
  athlete_id   uuid not null references athletes(id) on delete cascade,
  week_start   date not null,                 -- Monday the plan covers
  version      int not null default 1,
  status       text not null default 'proposed'
                 check (status in ('proposed','approved','synced')),
  source       text not null default 'notebooklm',
  raw_json     jsonb,                          -- exact NotebookLM output (audit)
  created_at   timestamptz not null default now(),
  approved_at  timestamptz,
  synced_at    timestamptz,
  unique (athlete_id, week_start, version)
);

create table plan_sessions (
  id              uuid primary key default gen_random_uuid(),
  plan_id         uuid not null references plans(id) on delete cascade,
  athlete_id      uuid not null references athletes(id) on delete cascade,  -- denormalised for RLS
  day_of_week     int,                         -- 1=Mon .. 7=Sun
  sport           text,
  session_type    text,                        -- e.g. Z2 endurance | threshold | VO2 | recovery | brick | long
  duration_min    int,
  target_zone     text,
  target_metrics  jsonb,                        -- {"power":..,"pace":..,"hr":..}
  rationale       text,                         -- LLM "why" per session
  sort_order      int,
  google_event_id text,                         -- set on calendar sync (SP5)
  created_at      timestamptz not null default now()
);

-- One row per athlete per week: the coaching commentary NotebookLM produced.
create table weekly_feedback (
  id             uuid primary key default gen_random_uuid(),
  athlete_id     uuid not null references athletes(id) on delete cascade,
  week_start     date not null,
  feedback_text  text not null,
  source_plan_id uuid references plans(id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (athlete_id, week_start)
);
```

### 6.4 Prompt templates, weekly review, secrets

```sql
-- Versioned NotebookLM prompt template. Global default (athlete_id NULL) + per-athlete override.
create table prompt_templates (
  id          uuid primary key default gen_random_uuid(),
  athlete_id  uuid references athletes(id) on delete cascade,   -- NULL = global default
  name        text not null,
  version     int not null default 1,
  template    text not null,        -- placeholders: {{week_range}},{{param_delta}},{{output_schema}}, ...
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- One row per athlete per week: the lock unit; stores the rendered prompt for audit.
create table weekly_reviews (
  id              uuid primary key default gen_random_uuid(),
  athlete_id      uuid not null references athletes(id) on delete cascade,
  week_start      date not null,
  status          text not null default 'open' check (status in ('open','locked')),
  locked_at       timestamptz,
  rendered_prompt text,
  created_at      timestamptz not null default now(),
  unique (athlete_id, week_start)
);
```

**Secrets (no readable columns):**
- **Intervals.icu API key** (per athlete) → **Supabase Vault**; the service-role data engine (SP1) reads/decrypts it. `athletes.intervals_athlete_id` stays as a non-secret identifier.
- **Google service-account / OAuth creds** → GitHub Actions + Vercel secrets, never the DB.

### 6.5 Row-Level Security (every table)

```sql
alter table <each_table> enable row level security;

-- athletes:
create policy athlete_self on athletes
  using (id = auth.uid()) with check (id = auth.uid());

-- all athlete-scoped tables (daily_metrics, activities, preference_profiles,
-- goal_manifests, plans, plan_sessions, weekly_feedback, weekly_reviews):
create policy tenant_isolation on <table>
  using (athlete_id = auth.uid()) with check (athlete_id = auth.uid());

-- prompt_templates (global readable, own writable):
create policy pt_read  on prompt_templates for select
  using (athlete_id is null or athlete_id = auth.uid());
create policy pt_write on prompt_templates for all
  using (athlete_id = auth.uid()) with check (athlete_id = auth.uid());
```

The nightly **data engine uses the service role**, which bypasses RLS; it must explicitly stamp the correct `athlete_id` on every upsert.

---

## 7. Auth & Tenancy

- **Supabase Auth**, email-based, **invite-only** (~2–3 athletes): public sign-ups disabled; athletes are invited via the Supabase admin/allowlist.
- On first authenticated login, an `athletes` row is provisioned (`id = auth.uid()`) via a trigger on `auth.users` or app-side on first request.
- **Strict isolation** is enforced at the database layer by RLS — neither athlete can read the other's metrics, notes, plans, or context. This satisfies Product Decision 1 and the multi-tenant privacy requirement without the app having to filter manually.

---

## 8. Roadmap (SP1–SP5)

| # | Sub-project | Depends on |
|---|-------------|-----------|
| **SP0** | **Foundation & Data Model** (this spec) | — |
| SP1 | **Data Engine** — Python + GitHub Actions nightly pull from Intervals.icu (training load, activities, physiological wellness — **not nutrition**), normalise, upsert | SP0 |
| SP2 | **Sunday Review UI** — auth'd 7-day dashboard across 4 pillars; tags + notes; **manual nutrition entry + optional MFP Premium CSV import**; edit Goal/Preference; Generate prompt | SP0 (SP1 for real data) |
| SP3 | **Context Bridge** — maintain the 4 current files (overwrite-in-place); render the delta prompt; Google service-account/Drive auth | SP0, SP2 |
| SP4 | **NotebookLM Loop + Plan Ingestion** — prompt template; paste JSON → validate → store plan + feedback; validate input-cap | SP3 |
| SP5 | **Plan Review + Google Calendar Sync** — review/edit proposed plan → Finalize → per-session calendar events | SP4 |

Order: `SP0 → {SP1, SP2} → SP3 → SP4 → SP5`. SP5 → (next week) SP3 closes the course-correction feedback loop.

---

## 9. Risks & Open Questions

1. **NotebookLM input cap (validated in SP4).** Bulk-in-files keeps the prompt tiny; if a payload ever overflows, the content already lives in a file. Empirically confirm the paste path holds.
2. **MFP nutrition — RESOLVED (D13 spike, 2026-06-03).** No reliable MFP→Intervals sync exists. D6 revised: nutrition is manual entry + optional MFP Premium CSV import in the Review UI (SP2), straight into Supabase. Intervals is not used for nutrition.
3. **Intervals.icu API field mapping.** SP1 must map Intervals' fields (fitness/fatigue/form, wellness, nutrition) onto the §6.1 columns and confirm the auth method (API key).
4. **Service-account vs per-user OAuth for Google.** Drive files (SP3) likely use a service account writing into per-athlete folders shared with the athlete's Google identity; Calendar (SP5) uses per-user OAuth. Finalised in SP3/SP5.

---

## 10. Verification (SP0)

SP0 is "done" when, against a real Supabase project:

1. **Migrations apply cleanly** from scratch; all tables, views, indexes, and RLS policies exist.
2. **Tenant isolation (RLS):** with two seeded test athletes A and B, authenticate as A and confirm A sees only A's rows across every athlete-scoped table; inserting/updating a row with B's `athlete_id` is rejected.
3. **Versioning + views:** insert multiple `preference_profiles` / `goal_manifests` versions; confirm `current_*` views return exactly the latest per athlete and respect RLS.
4. **Idempotent upserts:** re-inserting the same `(athlete_id, date)` / `(athlete_id, intervals_activity_id)` updates rather than duplicates.
5. **Plan lifecycle + audit:** a plan row transitions `proposed → approved → synced`; `raw_json` retains the original payload after `plan_sessions` edits.
6. **Global vs per-athlete prompt template:** a global template (`athlete_id NULL`) is readable by any athlete; an athlete's override is invisible to others.
7. **Secrets:** confirm no Intervals/Google secret is stored in a queryable column; the Intervals key resolves from Vault for the service role only.

Tests can be expressed as pgTAP via `supabase test db` (preferred — runs in CI) or SQL assertions, plus the seed script; they become the regression baseline SP1–SP5 build on.

---

## 11. Implementation Considerations — Migrations as Code

**Hard requirement:** the schema is **never created or altered through the Supabase dashboard.** Every change — initial creation and all future changes — is a version-controlled file applied programmatically. The dashboard is for inspection only.

### Tooling decision
**Supabase CLI migrations (raw SQL) are the single source of truth** for schema, RLS, views, triggers, and extensions. Rationale: this design is Postgres-native and RLS-heavy; policies, `security_invoker` views, Vault, `interval`/`jsonb`/array types, CHECK constraints, and the auth-provisioning trigger are all things an ORM (Prisma/Drizzle) makes you express in raw SQL anyway — so SQL-first removes a layer rather than adding one. The Next.js app consumes the schema through **`supabase-js` + generated TypeScript types**, so the app stays type-safe without owning the schema.

> *Alternative considered:* Drizzle ORM as the schema source-of-truth (TS → generated migrations) gives a typed query builder, but RLS/views/Vault still drop to custom SQL, splitting the source of truth. Recommended only if a typed query builder is later wanted; it can be layered on top of the SQL-defined schema without becoming the migration authority.

### Repository layout
```
supabase/
  config.toml                 # supabase init
  migrations/                 # timestamped, append-only SQL — the source of truth
    2026XXXX_sp0_tables.sql
    2026XXXX_sp0_rls.sql
    2026XXXX_sp0_views.sql
    2026XXXX_sp0_auth_trigger.sql
  seed.sql                    # 2–3 test athletes + global prompt template
  tests/                      # pgTAP tests (the §10 checklist)
src/lib/database.types.ts     # generated, committed
```

### Workflows (all CLI, no UI)
- **Local dev:** `supabase start` (Dockerised Postgres + Studio) → `supabase migration new <name>` → write SQL → `supabase db reset` (replays all migrations + `seed.sql` from scratch — fast iteration and the §10 verification).
- **Types:** `supabase gen types typescript --local > src/lib/database.types.ts`, committed.
- **Tests:** `supabase test db` runs the pgTAP suite (RLS isolation, views, upsert idempotency, etc.).
- **Deploy:** `supabase db push` applies *pending* migrations to the linked remote project, run from a **GitHub Action** on merge to `main` (authenticated via `SUPABASE_ACCESS_TOKEN` + DB password from repo secrets). This reuses the GitHub Actions infrastructure already in the stack. Never `db push` by hand from a laptop against production.

### Rules
- **Migrations are append-only and immutable once applied** — fix-forward with a new migration; never edit a migration that has run on a shared environment.
- **No secret values in committed SQL.** Vault *structure/usage* lives in a migration; secret *values* are injected at deploy time by a CI step calling `vault.create_secret(<value>, <name>)` with `<value>` sourced from GitHub secrets — so committed files contain DDL only.
- **Every future schema change = a new migration file** reviewed in a PR; the same `db reset` / `db push` / `gen types` cycle applies.

