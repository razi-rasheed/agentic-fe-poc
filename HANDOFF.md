# Triathlon OS — Handoff / Start Here

**Last updated:** 2026-06-03
**Phase:** SP0 **DONE & MERGED to `main`**. **SP2 (Review UI): design spec + `DESIGN.md` complete, and its DB schema migrated to the cloud dev project** (full pgTAP **54/54 green**, advisor-clean). Reprioritized ahead of SP1 (D17); built as a **hand/AI-coded Next.js + shadcn app** (D18, design system = shadcn preset `b5pZXjoX4i`). On branch **`sp2-review-ui`**. **SP2 UI build in progress (Next.js app in `web/`): Slices 1 (foundation + email/password auth + app shell + theming) and 2 (onboarding wizard + context: preference & goal) DONE — `pnpm -C web build` green.** **Next: Slice 3 (Weekly Review + manual data entry)** [was deferred this round], then Slice 4 (coaching loop), Slice 5 (calendar/admin/history). (`sp0-foundation` branch is redundant, == main; safe to `git branch -d`.)

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
| **`docs/superpowers/plans/2026-06-03-triathlon-os-sp0-foundation.md`** | SP0 **implementation plan** — 10 TDD tasks (migrations + pgTAP), executed. |
| **`docs/superpowers/specs/2026-06-03-triathlon-os-sp2-review-ui-design.md`** | **SP2 Review UI spec** — the whole user-facing app (screens, data contract, NotebookLM JSON, acceptance). Built as Next.js + shadcn + supabase-js. |
| **`docs/superpowers/specs/DESIGN.md`** | **UI design system** — shadcn/ui preset `b5pZXjoX4i`, next-themes light/dark, component/theming guidelines. Authoritative for SP2's look. |

## Architecture at a glance

- **Stack:** Next.js (TS) on Vercel · **Supabase Cloud** (Postgres + Auth + RLS + Vault; **no local Docker** — D15) · Python + GitHub Actions (nightly data engine) · Google NotebookLM (manual AI engine) · Intervals.icu (training/activities/wellness — **nutrition is manual + MFP CSV**, D6) · Google Drive (NotebookLM sources) · Google Calendar (plan sync).
- **The weekly loop (one line):** Intervals → Supabase nightly → Sunday review (tag/note) → app writes 4 *current* files to Drive + a tiny *delta* prompt → athlete runs NotebookLM → pastes JSON `{feedback, sessions}` back → review/edit → Finalize → Supabase + `current-plan` file + Google Calendar. Last week's plan vs this week's actuals = course correction. (Detail: SP0 spec §3–§4.)
- **Context model:** bulk state lives in 4 overwrite-in-place Drive files (`current-goal/preference/plan/week-data`) + research PDFs as NotebookLM sources; only the *change delta* goes in the prompt. (D7.)

## Decomposition (each gets its own spec → plan → build)

| # | Sub-project | Status |
|---|-------------|--------|
| **SP0** | Foundation & Data Model (schema, RLS, auth, migrations-as-code) | ✅ **Built & verified** (branch `sp0-foundation`, 41/41 pgTAP green) |
| **SP2** | **Review UI — the whole user-facing app** (onboard, manual entry, 4-pillar review, tags/notes, MFP CSV, Profile/Goal versioning, races catalog + race-results, Generate, paste-plan, review/approve, **Google Calendar**, history, admin) | ✅ **Spec + DESIGN.md + schema done; build the Next.js+shadcn UI** |
| SP1 | Data Engine (Intervals.icu → normalise → Supabase, nightly) — backend automation | Roadmap |
| SP3 | Context Bridge (automate maintaining the 4 NotebookLM source files; Google/Drive) — backend automation | Roadmap |
| ~~SP4 / SP5~~ | NotebookLM-loop UI + Calendar sync — **folded into SP2** | (in SP2 spec) |

Revised order (D17): `SP0 → SP2 (UI, incl. the SP4/SP5 user-facing loop) → SP1 / SP3 (backend automation)`. The NotebookLM hand-off in SP2 is manual (copy source docs + delta prompt) until SP3 automates it; data is entered manually until SP1 automates it.

## ▶ Next action: SP2 UI — Slice 3 (Weekly Review), then 4 & 5

The Next.js app lives in **`web/`** (App Router, **no `src/`** — code at `web/app|components|lib|hooks`; pnpm; shadcn preset `b5pZXjoX4i`; `@supabase/ssr`). **Slices 1 & 2 are built and build-green.**
- **Run it:** `pnpm -C web dev` → http://localhost:3000. Log in with `razi.abdulrasheed@hotmail.com` (admin) or `razi.mathilakath@gmail.com` (set their passwords in the Supabase dashboard). A fresh account → `/onboarding` (set Preference + Goal; the race combobox shows the 2 seed races) → `/review` placeholder; edit later via `/context`.
- **Env:** `web/.env.local` (gitignored) holds `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (publishable = public). Build plan: `docs/superpowers/plans/2026-06-04-triathlon-os-sp2-slices-1-3.md`.
1. **Slice 3 — Weekly Review + manual data entry** (`/review`): 4-pillar day rail, inline `daily_metrics` entry, activities + tags/notes, MFP CSV import, Lock & Generate. (Deferred from this round.)
2. Then **Slice 4** (Generate → paste plan → review/approve) and **Slice 5** (Google Calendar, races catalog browse + admin, race-results, history).
3. **Backend automation (separate cycles):** **SP1** — Python + GitHub Actions nightly Intervals.icu pull → normalise → upsert (validates the deferred Intervals API mapping D13; Intervals key in Vault). **SP3** — automate NotebookLM source-file maintenance (Drive).

What's on the cloud dev DB now: 10 tables + 2 views, RLS on all, seed (2 athletes + global prompt template), 9 migrations applied. Generated types at `src/lib/database.types.ts`. Local loop: `set -a; source .env.local; set +a; export PATH="/opt/homebrew/opt/libpq/bin:$PATH"` then `supabase db push --db-url "$SUPABASE_DB_URL"` / `psql "$SUPABASE_DB_URL" -f supabase/tests/*.sql`.

## Conventions

- **Schema is migrations-as-code only** — Supabase CLI SQL migrations are the source of truth; never mutate schema via the dashboard. (D12, SP0 spec §11.)
- **Specs** live in `docs/superpowers/specs/`, named `YYYY-MM-DD-<topic>.md`.
- **Decisions** are appended to the Decision Log as they're made (one entry: decision · rationale · alternatives · status).
