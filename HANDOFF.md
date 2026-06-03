# Triathlon OS — Handoff / Start Here

**Last updated:** 2026-06-03
**Phase:** SP0 (Foundation & Data Model) **DONE & MERGED to `main`** — 9 SQL migrations + 7 pgTAP test files (**41/41 green**) on the Supabase Cloud dev project; `get_advisors` clean of all SP0 objects. Now on branch **`sp1-data-engine`**. **Next: brainstorm → spec → plan → build SP1 (Data Engine)** — its own cycle. (`sp0-foundation` branch is redundant now, == main; safe to `git branch -d`.)

**Open items for the user (none block SP0):**
- 🔑 **Rotate the DB password** (it appeared once in a transcript) → update `.env.local`.
- 🧹 Pre-existing objects on the project that are NOT ours — review/drop: the `notes` starter table and the `rls_auto_enable()` function (advisor WARNs).
- 🔒 Enable **leaked-password protection** (dashboard → Auth) — advisor WARN.
- 🧪 Before a **prod** Supabase project exists, separate the test-helper migrations (`tests` schema) from the prod deploy (they're fine on dev / CI; the `tests` schema is not API-exposed).

> This is the orientation doc. It deliberately stays shallow and points to the detailed docs. If you're resuming cold, read in this order: **this file → Decision Log → SP0 spec.**

---

## What this is

**Triathlon OS** — an AI-driven coaching + tracking platform for endurance (triathlon) athletes. It unifies physiological, training-load, physical-output, and nutrition data into one weekly review, then hands a richly-contextualised package to an AI coach (Google NotebookLM) that returns a personalised, course-corrected training plan. Multi-tenant, privacy-isolated, wearable-agnostic.

Full vision + the 6 product decisions: SP0 spec §1.

## Document map

| Doc | What it holds |
|-----|---------------|
| **`HANDOFF.md`** (this) | Orientation, current status, read order, next action |
| **`docs/superpowers/specs/2026-06-03-triathlon-os-decisions.md`** | Decision Log — every architecture decision (D1–D13) with rationale + alternatives rejected. The "why." |
| **`docs/superpowers/specs/2026-06-03-triathlon-os-sp0-foundation-design.md`** | SP0 spec — full architecture context (stack, weekly loop, files-vs-prompt model) + the detailed, buildable Foundation/Data-Model design (schema, RLS, auth, migrations-as-code). |
| **`docs/superpowers/plans/2026-06-03-triathlon-os-sp0-foundation.md`** | SP0 **implementation plan** — 10 TDD tasks (migrations + pgTAP), ready for subagent-driven execution (D14). |

## Architecture at a glance

- **Stack:** Next.js (TS) on Vercel · **Supabase Cloud** (Postgres + Auth + RLS + Vault; **no local Docker** — D15) · Python + GitHub Actions (nightly data engine) · Google NotebookLM (manual AI engine) · Intervals.icu (training/activities/wellness — **nutrition is manual + MFP CSV**, D6) · Google Drive (NotebookLM sources) · Google Calendar (plan sync).
- **The weekly loop (one line):** Intervals → Supabase nightly → Sunday review (tag/note) → app writes 4 *current* files to Drive + a tiny *delta* prompt → athlete runs NotebookLM → pastes JSON `{feedback, sessions}` back → review/edit → Finalize → Supabase + `current-plan` file + Google Calendar. Last week's plan vs this week's actuals = course correction. (Detail: SP0 spec §3–§4.)
- **Context model:** bulk state lives in 4 overwrite-in-place Drive files (`current-goal/preference/plan/week-data`) + research PDFs as NotebookLM sources; only the *change delta* goes in the prompt. (D7.)

## Decomposition (each gets its own spec → plan → build)

| # | Sub-project | Status |
|---|-------------|--------|
| **SP0** | Foundation & Data Model (schema, RLS, auth, migrations-as-code) | ✅ **Built & verified** (branch `sp0-foundation`, 41/41 pgTAP green) |
| SP1 | Data Engine (Intervals.icu → normalise → Supabase, nightly) | Roadmap |
| SP2 | Sunday Review UI (4-pillar dashboard, tags/notes, edit goal/pref, generate prompt) | Roadmap |
| SP3 | Context Bridge (maintain 4 current files; render delta prompt; Google/Drive auth) | Roadmap |
| SP4 | NotebookLM Loop + Plan Ingestion (prompt template; paste JSON → validate → store) | Roadmap |
| SP5 | Plan Review + Google Calendar Sync (review/edit → Finalize → events) | Roadmap |

Order: `SP0 → {SP1, SP2} → SP3 → SP4 → SP5`. SP5 → next-week SP3 closes the feedback loop.

## ▶ Next action: integrate `sp0-foundation`, then SP1 (Data Engine)

SP0 is built and green. Remaining:
1. **Integrate the `sp0-foundation` branch** (merge to `main` or open a PR). Repo is local-only (no git remote yet) — add a GitHub remote to make the `db-ci.yml` workflow run.
2. **SP1 — Data Engine** (next sub-project): Python + GitHub Actions nightly pull from Intervals.icu (training load, activities, physiological wellness — **not** nutrition; D6) → normalise → upsert into the SP0 schema. SP1 validates the Intervals API field mapping (the deferred D13 risk) and stores the Intervals key in Supabase Vault. Brainstorm SP1 → spec → plan → subagent build (its own cycle).

What's on the cloud dev DB now: 10 tables + 2 views, RLS on all, seed (2 athletes + global prompt template), 9 migrations applied. Generated types at `src/lib/database.types.ts`. Local loop: `set -a; source .env.local; set +a; export PATH="/opt/homebrew/opt/libpq/bin:$PATH"` then `supabase db push --db-url "$SUPABASE_DB_URL"` / `psql "$SUPABASE_DB_URL" -f supabase/tests/*.sql`.

## Conventions

- **Schema is migrations-as-code only** — Supabase CLI SQL migrations are the source of truth; never mutate schema via the dashboard. (D12, SP0 spec §11.)
- **Specs** live in `docs/superpowers/specs/`, named `YYYY-MM-DD-<topic>.md`.
- **Decisions** are appended to the Decision Log as they're made (one entry: decision · rationale · alternatives · status).
