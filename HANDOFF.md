# Triathlon OS — Handoff / Start Here

**Last updated:** 2026-06-03
**Phase:** Design complete for SP0; **next action = Integration Feasibility Spike (D13)**.
**Nothing is built yet** — no code, no Supabase project, no spike run.

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

## Architecture at a glance

- **Stack:** Next.js (TS) on Vercel · Supabase (Postgres + Auth + RLS + Vault) · Python + GitHub Actions (nightly data engine) · Google NotebookLM (manual AI engine) · Intervals.icu (single ingestion source, incl. nutrition) · Google Drive (NotebookLM sources) · Google Calendar (plan sync).
- **The weekly loop (one line):** Intervals → Supabase nightly → Sunday review (tag/note) → app writes 4 *current* files to Drive + a tiny *delta* prompt → athlete runs NotebookLM → pastes JSON `{feedback, sessions}` back → review/edit → Finalize → Supabase + `current-plan` file + Google Calendar. Last week's plan vs this week's actuals = course correction. (Detail: SP0 spec §3–§4.)
- **Context model:** bulk state lives in 4 overwrite-in-place Drive files (`current-goal/preference/plan/week-data`) + research PDFs as NotebookLM sources; only the *change delta* goes in the prompt. (D7.)

## Decomposition (each gets its own spec → plan → build)

| # | Sub-project | Status |
|---|-------------|--------|
| **SP0** | Foundation & Data Model (schema, RLS, auth, migrations-as-code) | **Designed & approved** |
| SP1 | Data Engine (Intervals.icu → normalise → Supabase, nightly) | Roadmap |
| SP2 | Sunday Review UI (4-pillar dashboard, tags/notes, edit goal/pref, generate prompt) | Roadmap |
| SP3 | Context Bridge (maintain 4 current files; render delta prompt; Google/Drive auth) | Roadmap |
| SP4 | NotebookLM Loop + Plan Ingestion (prompt template; paste JSON → validate → store) | Roadmap |
| SP5 | Plan Review + Google Calendar Sync (review/edit → Finalize → events) | Roadmap |

Order: `SP0 → {SP1, SP2} → SP3 → SP4 → SP5`. SP5 → next-week SP3 closes the feedback loop.

## ▶ Next action: Integration Feasibility Spike (D13)

De-risk what we **don't own** before locking SP0 and building. Probe, in order:
1. 🔴 **NotebookLM** reliably emits schema-valid JSON `{feedback, sessions}`? (manual test) — fallback: lenient parser / reformatter / revisit engine.
2. 🔴 **Intervals.icu** exposes CTL/ATL/TSB, HRV, sleep, readiness, activities — and does **MyFitnessPal nutrition sync into Intervals wellness**? — fallback: manual nutrition entry.
3. 🟡 **Google** service-account → user-Drive sharing (for NotebookLM) + Calendar OAuth scopes.

Findings feed back into SP0 columns; the schema is cheap to change (migrations-as-code), the integrations aren't.
- *Assistant can do now:* research public docs (Intervals API, NotebookLM behaviour, Google sharing).
- *User must verify:* their Intervals key, their MFP→Intervals nutrition, the NotebookLM JSON test.

## Conventions

- **Schema is migrations-as-code only** — Supabase CLI SQL migrations are the source of truth; never mutate schema via the dashboard. (D12, SP0 spec §11.)
- **Specs** live in `docs/superpowers/specs/`, named `YYYY-MM-DD-<topic>.md`.
- **Decisions** are appended to the Decision Log as they're made (one entry: decision · rationale · alternatives · status).
