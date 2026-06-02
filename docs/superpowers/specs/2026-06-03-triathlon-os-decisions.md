# Triathlon OS — Decision Log

**Date started:** 2026-06-03
**Purpose:** the durable record of *why* — every architecture decision made during design, with rationale and the alternatives we rejected. Companion to the SP0 spec (`2026-06-03-triathlon-os-sp0-foundation-design.md`). Append a new entry as each future decision is made (including per-sub-project decisions for SP1–SP5).

---

## Current Status & Resumption

> Read this first if you're resuming cold.

- **Product:** Triathlon OS — AI-driven endurance-coaching + tracking platform. Vision/pain points: SP0 spec §1; original handoff captured there.
- **Decomposed into SP0–SP5** (SP0 spec §8). Each sub-project gets its own spec → plan → implementation cycle.
- **SP0 (Foundation & Data Model): DESIGNED & APPROVED**, committed. Full schema + RLS + auth + migrations-as-code in the SP0 spec.
- **Decisions D1–D5, D7–D12: ACCEPTED. D6: REVISED & accepted** (nutrition = manual + MFP CSV import). **D13 (spike): CONCLUDED.** **D14: subagent-driven implementation, Sonnet-heavy** (see below).
- **Spike outcome:** item 1 (MFP nutrition) concluded → D6 revision. Items 2 (Intervals activities/wellness API) & 3 (NotebookLM JSON output) **deferred — risks knowingly accepted**, to be validated in SP1 / SP4 respectively.
- **NEXT ACTION:** write the **SP0 implementation plan** (writing-plans skill), then execute via **subagent-driven development** per D14.
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
- **Rejected:** dashboard clicks (not reproducible); Drizzle/Prisma as migration authority (splits the source of truth for an RLS-heavy schema; Drizzle optional *later* for typed queries).

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
