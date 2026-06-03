# Triathlon OS — Decision Log

**Date started:** 2026-06-03
**Purpose:** the durable record of *why* — every architecture decision made during design, with rationale and the alternatives we rejected. Companion to the SP0 spec (`2026-06-03-triathlon-os-sp0-foundation-design.md`). Append a new entry as each future decision is made (including per-sub-project decisions for SP1–SP5).

---

## Current Status & Resumption

> Read this first if you're resuming cold.

- **Product:** Triathlon OS — AI-driven endurance-coaching + tracking platform. Vision/pain points: SP0 spec §1; original handoff captured there.
- **Decomposed into SP0–SP5** (SP0 spec §8). Each sub-project gets its own spec → plan → implementation cycle.
- **SP0 (Foundation & Data Model): DESIGNED & APPROVED**, committed. Full schema + RLS + auth + migrations-as-code in the SP0 spec.
- **Decisions D1–D5, D7–D14: ACCEPTED** (D6 revised: nutrition = manual + MFP CSV import; D13 spike concluded; D14 subagent-driven Sonnet-heavy). **D15: Supabase Cloud, no local Docker. D16: adopt Supabase MCP + RLS hardening** (see below). **SP0 implementation plan written** (`docs/superpowers/plans/2026-06-03-triathlon-os-sp0-foundation.md`).
- **Spike outcome:** item 1 (MFP nutrition) concluded → D6 revision. Items 2 (Intervals API) & 3 (NotebookLM JSON) **deferred — risks knowingly accepted**, validated in SP1 / SP4.
- **SP0 BUILT & VERIFIED** (branch `sp0-foundation`, subagent-driven, Sonnet): 9 migrations + 7 pgTAP files, **41/41 green** on the cloud dev project; `get_advisors` clean of all SP0 objects. A final code review drove extra hardening (composite FK for plan_session tenant integrity; revoked EXECUTE on test SECURITY DEFINER fns; prompt_templates natural key; RLS coverage test).
- **Open items (non-blocking):** rotate DB password (leaked once in transcript); drop pre-existing `notes` table + `rls_auto_enable()` fn (not ours); enable leaked-password protection (dashboard); separate test-helper migrations from prod before a prod project exists.
- **SP0 merged to `main`.** **SP2 (Review UI) — design spec complete** (D17 reprioritized it ahead of SP1; D18 = build it externally in Figma Make). Spec: `docs/superpowers/specs/2026-06-03-triathlon-os-sp2-review-ui-design.md`, committed on branch `sp2-review-ui`.
- **NEXT ACTION:** user takes the SP2 spec to **Figma Make** to build the UI. Backend automation remains for later: **SP1** (Intervals nightly ingestion + Vault for the API key) and **SP3** (automated Drive bridge). No in-repo SP2 implementation.
- **Not yet started:** any code, Supabase project, the feasibility spike itself.
- **Key docs:** this file + `2026-06-03-triathlon-os-sp0-foundation-design.md` (same folder).

---

## Product decisions (given — from the handoff)

These are the user's *product-level* decisions that frame everything; the engineering decisions below serve them.

1. Strict contextual isolation (multi-tenant safety).
2. Wearable-agnostic ingestion (universal normalisation).
3. Holistic metric consolidation (4 pillars: physiological, load, output, nutrition).
4. Human-in-the-loop weekly review (subjective tags/notes before AI sees data).
5. Tripartite "living" context (dynamic data stream + preference profile + goal manifest).
6. Triggered course-correction (edit profile/goal → AI re-plans the upcoming week).

---

## Engineering / architecture decisions

### D1 — Full platform, decomposed into SP0–SP5 · *Accepted*
- **Decision:** build the full platform, decomposed into six independently-buildable sub-projects, each with its own spec→plan→implementation cycle.
- **Rationale:** genuinely multi-subsystem; one spec would be irresponsible. Decomposition gives clear interfaces and isolated build/test.
- **Rejected:** thin vertical slice (fast but partial); single subsystem only. User explicitly chose full platform knowing it needs decomposition.

### D2 — Stack: Next.js + Supabase + Vercel + Python/GitHub Actions · *Accepted*
- **Decision:** Next.js (TS) on Vercel (UI + API routes); Supabase (Postgres + Auth + RLS + Vault); Python on GitHub Actions for the nightly data engine.
- **Rationale:** single TS codebase for fast solo dev + easy deploy; Supabase RLS = native multi-tenant isolation, Auth removes plain-text credentials, Vault for secrets; GitHub Actions' 6h budget escapes the serverless 10–60s timeout for data extraction.
- **Rejected:** FastAPI+React (two languages, heavier); Python full-stack (weaker UI); self-managed Postgres (Supabase gives RLS/Auth/Vault out of the box).

### D3 — AI engine: Google NotebookLM, manual handoff · *Accepted (output reliability → D13)*
- **Decision:** NotebookLM is the reasoning engine; inference is **manual** — the app prepares context (sources + paste-ready prompt); the athlete runs NotebookLM and pastes the output back.
- **Rationale:** **source-grounding** — NotebookLM adheres to uploaded research/profile/goal and resists hallucinating coaching advice from general training data. This is the core safety property.
- **Trade-offs accepted:** no API, no programmatic trigger, no write-back; chat-input length cap; consumer product, no SLA.
- **Rejected:** Claude API in-app (richer, but higher hallucination risk without a grounding harness); open conversational output (non-structured).

### D4 — Plan output: structured JSON, pasted back (not SQL) · *Accepted*
- **Decision:** NotebookLM emits `{feedback, sessions}` as JSON in a documented schema; athlete pastes into the app; app **validates against schema** then writes via the Supabase client.
- **Rationale:** reviewable, storable, renderable; validation enforces types + RLS.
- **Rejected:** **raw SQL from the LLM** (injection vector, destructive-statement risk, bypasses validation/RLS); open chat text (not storable/structured); "Sheet output" (NotebookLM can't write back).

### D5 — Calendar: Google Calendar (per-user OAuth), not Cal.com · *Accepted*
- **Decision:** on Finalize, push approved sessions to the athlete's Google Calendar — one event per session.
- **Rationale:** these are the athlete's **own** training blocks; Google Calendar is the right tool for self-scheduling and reuses Google auth already in the stack (per-user OAuth).
- **Rejected:** Cal.com (built for *others booking you*, Calendly-style — wrong fit, extra account/auth); deferring calendar sync (kept as SP5).

### D6 — Nutrition: manual entry + optional MFP Premium CSV import (Intervals is NOT the nutrition source) · *Revised & accepted 2026-06-03 (spike item 1 concluded)*
- **Decision:** nutrition (calories/carbs/protein/fat) is **entered manually in the Sunday Review UI**, with an **optional bulk import of the MyFitnessPal Premium CSV export** (parse meal-level rows → daily totals). Intervals.icu is no longer used for nutrition.
- **Why changed (D13 spike finding):** there is **no reliable MFP→Intervals sync** — only fragile cookie-scrapers (`python-myfitnesspal`) or partial paths (Garmin = activity days only; Google Fit = kcal blank; "MFP won't even talk to Zapier"). Routing through Intervals reintroduced the exact fragile scraper this decision set out to avoid.
- **Why this path:** manual entry is 100% reliable and fits the weekly-review cadence (the athlete is in the app every Sunday anyway). **MFP Premium CSV export** is official + ToS-compliant (date-range zip of CSVs emailed within ~1h, link valid 7 days), giving a reliable bulk option with no scraping.
- **Implication:** Intervals.icu now provides **training load + activities + physiological wellness only**; nutrition enters via UI/CSV straight into Supabase. `daily_metrics` nutrition columns are unchanged — only their *source* changes (UI/CSV, not the nightly Intervals job). Nutrition entry + CSV import live in **SP2** (Review UI).
- **Supersedes:** the original "route nutrition via Intervals.icu single source."
- **Rejected:** nightly MFP cookie-scraper (fragile, ToS); Garmin/Google Fit/Apple Health relays (incomplete).

### D7 — Context model: 4 current files (sources) + delta-only prompt · *Accepted (input-cap → SP4)*
- **Decision:** per athlete, maintain exactly 4 **current** files in Drive — `current-goal`, `current-preference`, `current-plan`, `current-week-data` — plus research PDFs, all **overwritten in place**. The weekly prompt carries only the change-delta + instruction.
- **Rationale:** NotebookLM grounds on *sources* and its question box is length-capped → bulk context belongs in sources, change-signal in the prompt. Current-only overwrite avoids stale-citation and source-cap clutter. Supabase keeps version history.
- **Rejected:** fully fileless / everything-in-prompt (input cap; and research PDFs must stay sources regardless); dated snapshots + `/history/` folder (NotebookLM may cite stale versions; source-cap clutter); app-only bundled-into-weekly-push (NotebookLM wouldn't see standing sources).

### D8 — Delta format: previous→current values + `change_reason` · *Accepted*
- **Decision:** when goal/preference change, the prompt shows explicit **previous→current** pairs + an optional human `change_reason`.
- **Rationale:** technically redundant (`previous = current − delta`) but removes an LLM reconstruction step and **explains why the existing `current-plan` looks as it does** (built under previous constraints) → nudge, not rebuild. `change_reason` captures the human "why" and enriches the longitudinal record. Cost ~zero (changes seldom, fields tiny).

### D9 — Append-only versioning + historized plans (the feedback loop) · *Accepted*
- **Decision:** `preference_profiles` and `goal_manifests` are append-only versioned (`current_*` views = latest); `plans` are historized week-scoped (never overwritten). The plan is both output and next-cycle input.
- **Rationale:** versioning powers "what changed since last lock" delta computation; historized plans give the prescribed-vs-actual baseline that closes the course-correction loop (SP5 → next-week SP3).
- **Rejected:** edit-in-place + audit log (loses clean delta computation).

### D10 — Wide-flat `daily_metrics` + separate `activities` · *Accepted*
- **Decision:** one wide denormalised `daily_metrics` row per athlete/day (physiological + load + nutrition); `activities` split out (0..n per day).
- **Rationale:** the handoff explicitly wants wide/flat tables for easy AI formatting; workouts are 1:n so must be their own table.

### D11 — Strict multi-tenant isolation via RLS · *Accepted*
- **Decision:** RLS on every table (`athlete_id = auth.uid()`); the data engine uses the service role and stamps `athlete_id`.
- **Rationale:** enforces product Decision 1 + privacy at the database layer — no manual filtering, no shared credentials.

### D12 — Migrations-as-code, SQL-first (Supabase CLI); not dashboard, not ORM-as-authority · *Accepted*
- **Decision:** schema source of truth = Supabase CLI SQL migrations; app uses `supabase-js` + generated types; the dashboard never mutates schema; every future change is a new migration file.
- **Rationale:** RLS/views/Vault/triggers are Postgres-native — ORMs force raw SQL for them anyway, so SQL-first removes a layer. Programmatic, version-controlled, CI-applied.
- **Rejected:** dashboard clicks (not reproducible); **Drizzle/Prisma entirely** (decided 2026-06-03 — would split the source of truth for an RLS-heavy schema, and RLS/views/triggers/Vault stay raw SQL regardless). App data layer = **`supabase-js` + generated types**, with RLS enforced automatically via PostgREST/JWT (no manual auth-context handling).

### D13 — Integration Feasibility Spike before locking SP0 · *Concluded 2026-06-03*
- **Decision:** run a time-boxed, read-only spike on the **not-owned** integrations before finalising the SP0 schema and building.
- **Rationale:** the schema is cheap and fully owned (migrations-as-code); the integrations are expensive-to-discover and out of our control. De-risk the assumptions before building on them; let findings refine SP0 columns.
- **Scope / go-no-go questions:**
  - 🔴 **NotebookLM** reliably emits schema-valid JSON for `{feedback, sessions}`? (manual test with sample sources) — *fallback:* fenced-code-block + lenient parser / reformatter step / revisit engine.
  - ✅ **CONCLUDED — MyFitnessPal nutrition:** no reliable MFP→Intervals sync exists → resolved by revising D6 (manual entry + optional MFP Premium CSV import; Intervals not used for nutrition).
  - 🔴 **Intervals.icu (still open):** confirm the API exposes CTL/ATL/TSB, HRV, sleep, readiness, and activities (pace/HR/power/etc.) with known field names/units.
  - 🟡 **Google**: service-account → user-Drive sharing (so NotebookLM under the user's identity can read) + Calendar OAuth scopes.
- **Split:** assistant can research public docs (Intervals API, NotebookLM behaviour, Google sharing); user must verify account-specific facts (their Intervals key, their MFP→Intervals nutrition, the NotebookLM JSON test).
- **Outcome (2026-06-03):** item 1 concluded (→ D6 revised). Items 2 & 3 **deferred by user decision — risks knowingly accepted**: Intervals API field availability validated during SP1, NotebookLM JSON-output reliability validated during SP4. Fallbacks already documented (D7 input-cap, D4 lenient parsing).

### D14 — Subagent-driven implementation; model policy Sonnet-heavy, Opus-minimal · *Accepted*
- **Decision:** implement each sub-project (starting SP0) via **subagent-driven development** (`superpowers:subagent-driven-development`) once its implementation plan is written. **Model policy: use Sonnet 4.6 for the bulk of the work; reserve Opus 4.8 for the minimum** (e.g. only where deeper reasoning is genuinely needed — tricky design/review steps).
- **Rationale:** cost/efficiency — Sonnet 4.6 handles most implementation tasks well; Opus is reserved for high-leverage reasoning. Subagent-driven keeps tasks isolated and reviewable.
- **Sequence:** writing-plans (SP0 plan) → subagent-driven execution → review checkpoints.

### D15 — Host on Supabase Cloud; no local Docker · *Accepted 2026-06-03*
- **Decision:** run against **Supabase Cloud**, not a local Docker stack. Deployment targets: **Vercel** (web + API), **Supabase Cloud** (Postgres/Auth/RLS), **Python on GitHub Actions** (data engine). The Supabase CLI manages migrations (`link` + `db push`) and type generation (`gen types --linked`) against the cloud project — none of which need Docker.
- **Rationale:** user wants zero local-infra management now.
- **Testing:** pgTAP runs against a cloud **dev** project via `psql` (tests wrap in begin/rollback, leaving no residue); GitHub Actions runs the full pgTAP suite on an ephemeral Supabase stack (the *runner's* Docker, not the developer's) as the merge gate.
- **Implications:** the SP0 plan's local-stack commands (`supabase start` / `db reset` / `test db`) are replaced by cloud equivalents (see the plan's "Execution Model" section). **Auth config (invite-only) is set in the cloud project's dashboard**, not via migrations. Recommend a dedicated **dev** project for iterating SP0; add a **prod** project later. Migrations-as-code (D12) is unchanged.
- **Rejected:** local Supabase via Docker (user declined local infra).
- **Note:** reuse the user's **pre-existing Supabase Cloud project** as the dev project (created before brainstorming). Verify it has no custom `public` schema objects before the first `db push` to avoid drift.

### D16 — Adopt Supabase MCP (verify/introspect); repo SQL stays source of truth · *Accepted 2026-06-03*
- **Decision:** use the Supabase MCP for **`get_advisors`** (security/perf lint in verification), **introspection** (`list_tables`/`list_migrations`/`list_extensions`), **type generation**, **`search_docs`**, and ad-hoc `execute_sql` checks. **Migrations stay repo SQL files** applied via `supabase db push --db-url "$SUPABASE_DB_URL"`; pgTAP runs via `psql`. **Do NOT use MCP `apply_migration` to iterate** (per the Supabase skill it writes a history entry per call and breaks `db diff`/`db pull`).
- **Rationale:** the MCP adds a real automated security audit (`get_advisors`) and reduces reliance on psql/secret-in-shell, without displacing migrations-as-code (D12).
- **RLS hardening folded into the SP0 plan (from the Supabase skill):** every policy uses `TO authenticated` + ownership predicate `(select auth.uid()) = athlete_id` (role-scoped + planner-cached); `handle_new_user` uses `set search_path = ''` + fully-qualified names (SECURITY DEFINER search-path safety); views already `security_invoker = true`. `user_metadata` is never used for authorization; secret/`service_role`-class keys never reach client code (app uses the publishable key — SP2).

### D17 — Reprioritize SP2 (Review UI) before SP1 (Data Engine) · *Accepted 2026-06-03*
- **Decision:** build the user-facing Review UI (SP2) next, before the nightly ingestion automation (SP1).
- **Rationale:** the user wants to **onboard and start using** the app for real value now; automation is convenience that can wait. SP2 depends only on SP0 (done). Until SP1 exists, the week's data is **entered manually** in the UI (consistent with D6's manual nutrition).
- **Effect on decomposition:** SP2 absorbed the *user-facing* parts of the loop — it now spans the whole UI (review + the NotebookLM hand-off screens + Google Calendar). The remaining backend automation stays as later sub-projects: **SP1** (Intervals nightly ingestion) and **SP3** (automated Drive bridge). New order: `SP0 → SP2 (UI) → SP1 / SP3 (backend automation)`.

### D18 — SP2 specified for external build (Figma Make), not implemented in-repo · *Accepted 2026-06-03*
- **Decision:** SP2 is delivered as a **self-contained design spec** (`docs/superpowers/specs/2026-06-03-triathlon-os-sp2-review-ui-design.md`) for an **AI UI builder (Figma Make → React + Supabase)**. Brainstorming for SP2 **terminates at the spec** — no in-repo implementation, no `writing-plans` this round.
- **Scope (full):** invite-only sign-in, onboarding, manual 4-pillar data entry (no SP1), weekly review + tags/notes, MyFitnessPal CSV nutrition import, Profile/Goal versioning + change-delta, Generate (4 copyable source docs + delta prompt — manual, since SP3 deferred), paste-plan + JSON validation, plan review/approve, Google Calendar sync, history, settings.
- **Visual:** calm & minimal (Linear/Notion/Things), light default, responsive.
- **NotebookLM hand-off:** source docs + delta prompt (faithful to D7; manual until SP3 automates it).
- **Self-contained:** the spec includes the Supabase data contract + the plan-JSON schema so the external builder needs nothing else.
