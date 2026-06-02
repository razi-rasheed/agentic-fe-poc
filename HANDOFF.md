# Triathlon OS — Handoff / Start Here

**Last updated:** 2026-06-03
**Phase:** SP0 designed & approved; feasibility spike **concluded** (D13). **Next action = write the SP0 implementation plan (writing-plans), then subagent-driven implementation (Sonnet-heavy, D14).**
**Nothing is built yet** — no code, no Supabase project.

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

## ▶ Next action: write the SP0 implementation plan → subagent-driven build

Feasibility spike (D13) is **concluded**:
- ✅ **Nutrition (item 1):** no reliable MFP→Intervals sync → D6 revised to manual entry + optional MFP Premium CSV import (Intervals not used for nutrition).
- ⏸️ **Intervals API (item 2)** and **NotebookLM JSON (item 3):** deferred — risks **knowingly accepted**, validated in SP1 / SP4. Fallbacks documented (D4 lenient parsing, D7 bulk-in-files).

Now:
1. **Write the SP0 implementation plan** via the writing-plans skill (schema + RLS + auth + migrations-as-code, per the SP0 spec).
2. **Execute via subagent-driven development (D14)** — **Sonnet 4.6 for the bulk of the work, Opus 4.8 reserved for the minimum.**

## Conventions

- **Schema is migrations-as-code only** — Supabase CLI SQL migrations are the source of truth; never mutate schema via the dashboard. (D12, SP0 spec §11.)
- **Specs** live in `docs/superpowers/specs/`, named `YYYY-MM-DD-<topic>.md`.
- **Decisions** are appended to the Decision Log as they're made (one entry: decision · rationale · alternatives · status).
