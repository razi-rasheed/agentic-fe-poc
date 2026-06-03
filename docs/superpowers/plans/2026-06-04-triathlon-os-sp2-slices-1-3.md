# Triathlon OS — SP2 UI Build Plan (Slices 1–3)

> Build of the SP2 Review UI per `2026-06-03-triathlon-os-sp2-review-ui-design.md` + `DESIGN.md`. **Execute continuously: gate only on `next build` + `tsc` success, then move to the next slice** (no per-slice human pause). Subagent-driven, Sonnet-heavy.
>
> **Current scope this round: Slices 1 & 2 ONLY.** Slice 3 (Weekly Review) is deferred — build it after 1 & 2 are done + reviewed.

## Setup facts
- **App location:** `web/` subdir (root holds `supabase/`, `docs/`). Package manager: **pnpm**.
- **Scaffold:** `shadcn init --preset b5pZXjoX4i` (Next.js + TS + App Router + Tailwind + `src/` + `@/*`); `@supabase/ssr` + `next-themes`.
- **Env (`web/.env.local`, gitignored):** `NEXT_PUBLIC_SUPABASE_URL=https://ukjsbxoizktwxkfihpjb.supabase.co`; `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=` the project's publishable key (`sb_publishable_…`, public/client-safe). Commit a `web/.env.example` with the URL + placeholder key.
- **Auth:** email+password, invite-only (sign-ups disabled). Accounts already created: `razi.abdulrasheed@hotmail.com` (**is_admin=true**), `razi.mathilakath@gmail.com` (athlete). Seed demo users `alice@tri.local`/`bob@tri.local` hold demo data.
- **DB:** the live cloud schema (SP0 + SP2 migrations). Regenerate `web/src/lib/database.types.ts` from it. RLS enforces isolation; the shared `races` catalog is readable by all, admin-writable.
- **Design system:** shadcn preset `b5pZXjoX4i` (see `DESIGN.md`); `next-themes` light/dark.
- **Given blocks:** sidebar → `npx shadcn@latest add sidebar-01`; login → `npx shadcn@latest add login-01`.
- **Reference images (direction only, not pixel-exact):** `docs/superpowers/specs/preference.png` (weekly target + Mon–Sun AM/PM hours grid w/ allocated/remaining), `goal.png` (Race Identity + split targets w/ **auto-calculated overall** + strategy notes, stepped form).

---

## Slice 1 — Foundation + Auth
**Scaffold** (above) + regenerate DB types.
**Routes**
- `/login` — email+password form (from `login-01`) → success → `/review`.
- `/(app)/*` — protected group inside the **app shell** (`sidebar-01`): nav Review · Context · Plan · History · Settings, + theme toggle + user menu/sign-out.
- `middleware.ts` — refresh session; unauthenticated → `/login`; authenticated on `/login` → `/review`.

**Data:** `auth.signInWithPassword`, `signOut`, session via `@supabase/ssr` server client; read own `athletes` row (`display_name`, `is_admin`) for the shell (admin gates the future Admin nav item).
**States:** login idle/submitting/error; shell skeleton.
**Done-when:** `pnpm build` + `tsc` green; login form + protected shell + theme toggle + sign-out implemented (login flow testable by the user).

## Slice 2 — Onboarding + Context
**Routes**
- `/onboarding` — 2-step wizard (Preference → Goal); shown when no current profile/goal, else → `/review`.
- `/context` — view + edit current Preference & Goal.

**Preference form** (shadcn `Form`+rhf+zod): `max_hours_per_week`; **availability grid** Mon–Sun, per day *Unspecified / Day-total / AM+PM* → `available_hours` jsonb (`{"hours":n}` | `{"am":n,"pm":n}`); a weekly allocated/remaining counter (per preference.png); `long_swim/bike/run_day`; `rest_day`; `constraints_notes`.
**Goal form:** `goal_type` (finish/target_time/placement); **target race** combobox from `races` *or* free-text (`race_name`/`race_date`/`race_url`); split targets swim/T1/bike/T2/run/overall (`h:mm:ss`) with **overall auto-summed** (editable); strategy `notes`; **"Targets from history"** panel = selected race `cutoff_*` + my `race_results`.
**Data:** read `current_preference_profile`/`current_goal_manifest` views, `races`, `race_results`; save = insert **new version** (`version=max+1`), `change_reason` on edit.
**Done-when:** build green; onboarding writes v1 of each; edit writes v2 + reason; race picker populated; history panel renders.

## Slice 3 — Weekly Review + manual data entry
**Route:** `/review` (home) — week selector + 4-pillar Mon–Sun view.
**Components:** week selector (prev/current/next); **day rail** (7 cards: readiness/sleep, resting HR/HRV, load + CTL/ATL/TSB, nutrition totals, activity count); **day detail `Sheet`** inline-editing `daily_metrics` (physiological/load/nutrition) + day note; **activities** add/edit (sport/duration/distance/HR/power/…) + tag chips + per-workout note; **MFP CSV import** (upload → parse meal CSV → aggregate to daily totals → confirm → upsert nutrition); **Lock & Generate** button (entry to Slice 4); a small **CTL/ATL/TSB chart**.
**Data:** read `daily_metrics` + `activities` for the week (date range, RLS-scoped); upsert `daily_metrics` on `(athlete_id,date)`; insert/update `activities` (`intervals_activity_id = manual-<uuid>`); `weekly_reviews` status.
**Done-when:** build green; can manually enter a full week + tag/note; CSV fills nutrition; 4 pillars render.

---

**Deferred (not this round):** **Slice 3 (Weekly Review + manual data entry)** — build after Slices 1 & 2. Then Slice 4 (Generate → paste plan → review/approve), Slice 5 (Google Calendar, races admin screen, history). Backend automation SP1/SP3 remain separate.
