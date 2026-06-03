# Triathlon OS — SP2: Review UI Design Spec

**Date:** 2026-06-03
**Status:** Approved design. **Built as a hand/AI-coded Next.js app** (e.g. with Claude Code / Cursor) against the existing Supabase project. The DB schema this spec needs is already migrated onto the cloud dev project.
**Build target:** a **Next.js + TypeScript** app using **shadcn/ui** for the UI and **Supabase** (`supabase-js`) for auth + data (RLS = tenant isolation). **The visual design system lives in `DESIGN.md`** (shadcn preset **`b5pZXjoX4i`**; light/dark via `next-themes`). The spec is self-contained: it includes the data contract.

> **How to use this doc:** it is both a design spec and a build brief. §1–§4 = context; §5 = the Supabase data contract; §6 = screens; §7 = visual system (→ defers to `DESIGN.md`); §8 = behaviors; §9 = NotebookLM contract; §10 = acceptance. Build screen-by-screen with shadcn components themed by the preset.

---

## 1. Context

**Triathlon OS** is an AI-driven coaching + tracking app for endurance athletes. The athlete trains during the week; once a week (the "Sunday review") they look at the week's data across four pillars, add subjective context, and hand a richly-contextualised package to an AI coach (Google NotebookLM, used manually) that returns a course-corrected next-week plan. Multi-tenant, with strict per-athlete data isolation.

**SP2 (this spec) is the entire user-facing app** — the Review UI. It lets an athlete onboard, enter and review their week, capture subjective context, generate the NotebookLM hand-off, paste the AI's plan back, review/approve it, and push it to their calendar. It runs against the already-built database (SP0).

**What's deferred (so SP2 must stand alone without them):**
- **SP1** — nightly automated ingestion from Intervals.icu. Until it exists, **the athlete enters the week's data manually** (and imports nutrition via MyFitnessPal CSV).
- **SP3** — the *automated* Google Drive bridge that maintains NotebookLM's source files. Until it exists, the app **renders the source-doc text for the athlete to copy into NotebookLM by hand**.

## 2. The weekly loop (why these screens exist)

```
Onboard once: set Preference Profile + Goal Manifest.
Each week:
  1. Enter the week's data (manual): activities + daily physiological/load/nutrition.   [Review screen]
  2. Review the 7 days across 4 pillars; tag workouts; add subjective notes.            [Review screen]
  3. If life changed, edit Profile/Goal (creates a new version + a "what changed" note). [Context screen]
  4. Lock & Generate → copy 4 "current" source docs into NotebookLM + paste the delta
     prompt. NotebookLM (external) returns JSON {feedback, sessions}.                    [Generate screen]
  5. Paste the JSON back → app validates + stores it as a proposed plan + feedback.      [Paste screen]
  6. Review/edit the proposed 7-day plan; Approve.                                       [Review-plan screen]
  7. Push approved sessions to Google Calendar.                                          [Calendar]
  Course correction: next week, the coach compares the prescribed plan vs the actuals.
```

## 3. Scope

**In scope:** sign-in (invite-only), onboarding, weekly review with manual data entry + tagging/notes, MyFitnessPal CSV nutrition import, Profile/Goal editing with versioning (incl. mixed-granularity availability, per-discipline long days, `goal_type`, race linkage + "targets from history"), **browse/select the shared `races` catalog**, **personal `race_results` history with private/public visibility**, **admin race-catalog management (admins only)**, Generate (source docs + delta prompt), paste-plan + validation, plan review/approve, Google Calendar sync, history (feedback journal + past plans + version history), settings.

**Out of scope:** nightly Intervals automation (SP1); the *automated* Drive bridge (SP3 — done manually here); the actual NotebookLM tool (external); Intervals API-key handling; any data the app can't get without SP1 is entered manually.

## 4. Roles & tenancy

- **One athlete per account.** Invite-only — no public sign-up.
- **Strict isolation:** every query is automatically scoped to the signed-in athlete by Postgres Row-Level Security (`athlete_id = auth.uid()`). The UI never needs to filter by athlete; Supabase enforces it. Never show or allow writing another athlete's data.

---

## 5. Supabase data contract

The app uses `supabase-js` with the project's **publishable/anon key**; the signed-in user's JWT drives RLS. Tables already exist (SP0). Relevant tables and the fields SP2 reads/writes:

- **`athletes`** — `id` (= auth user id), `display_name`, `email`, `intervals_athlete_id`, `google_calendar_id`, `timezone`, **`is_admin`** (bool; gates the race-catalog admin screens — the platform owner sets their own flag once via the dashboard). Auto-created on sign-up (DB trigger). SP2 reads it; Settings may edit `display_name`, `timezone`.
- **`daily_metrics`** — one row per `(athlete_id, date)`. Fields: physiological (`resting_hr`, `hrv`, `sleep_hours`, `sleep_score`, `readiness`, `body_weight`), training load (`ctl`, `atl`, `tsb`, `daily_load`), nutrition (`calories`, `carbs_g`, `protein_g`, `fat_g`, `hydration_ml`), `notes` (subjective day note). Upsert on `(athlete_id, date)`. **SP2 writes these manually.**
- **`activities`** — one row per workout. `intervals_activity_id` (use a generated id like `manual-<uuid>` for manual entries), `date`, `start_time`, `sport` (swim/bike/run/strength/other), `name`, `duration_s`, `distance_m`, `avg_pace`, `avg_hr`, `max_hr`, `avg_power`, `elevation_gain_m`, `load`, `intensity`, `tags` (text[]), `athlete_note`. Unique on `(athlete_id, intervals_activity_id)`. **SP2 writes these manually + adds tags/notes.**
- **`preference_profiles`** — append-only versioned. `version`, `valid_from`, `max_hours_per_week`, **`available_hours`** (jsonb, **mixed-granularity per day** — omit a day = unspecified; each present day is either `{"hours": 4}` (day total) or `{"am": 2, "pm": 1}` (AM/PM split), e.g. `{"sat":{"hours":4},"wed":{"am":2,"pm":1}}`), **`long_swim_day`** / **`long_bike_day`** / **`long_run_day`**, `rest_day`, `constraints_notes`, `change_reason`. Editing = insert a new version (`version` = current max + 1). View `current_preference_profile` = latest per athlete.
- **`goal_manifests`** — append-only versioned. `version`, `valid_from`, **target race**: `race_id` → `races` (catalog) **or** free-text `race_name` + `race_date` + `race_url` (when not in the catalog — same rule as `race_results`), **`goal_type`** ('finish' | 'target_time' | 'placement'), `target_swim_time`/`target_t1_time`/`target_bike_time`/`target_t2_time`/`target_run_time`/`target_overall_time` (Postgres `interval`), `notes`, `change_reason`. Same versioning + `current_goal_manifest` view. (One primary race for now; A/B/C priority deferred — see BACKLOG BL-04.)
- **`weekly_reviews`** — one per `(athlete_id, week_start)`. `status` ('open' | 'locked'), `locked_at`, `rendered_prompt` (the generated delta prompt, stored for audit). Created/locked by the Generate screen.
- **`plans`** — one per `(athlete_id, week_start, version)`. `status` ('proposed' | 'approved' | 'synced'), `source` ('notebooklm'), `raw_json` (the exact pasted JSON), `created_at`, `approved_at`, `synced_at`.
- **`plan_sessions`** — one per prescribed session. `plan_id`, `athlete_id`, `day_of_week` (1=Mon..7=Sun), `sport`, `session_type`, `duration_min`, `target_zone`, `target_metrics` (jsonb), `rationale`, `sort_order`, `google_event_id` (set on sync). Note: a session's `(plan_id, athlete_id)` must match its plan (DB enforces it).
- **`weekly_feedback`** — one per `(athlete_id, week_start)`. `feedback_text`, `source_plan_id`. The coach's commentary; shown in History.
- **`prompt_templates`** — `athlete_id` (null = global default), `name`, `version`, `template` (text with placeholders), `is_active`. SP2 reads the active template (athlete override if present, else global default) to render the prompt.
- **`races`** — **shared, owner-curated catalog** (not per-athlete). RLS: **read = any authenticated athlete; write = admins only** (`athletes.is_admin`). Fields — *identity:* `name`, `description`, `image_url`, `thumbnail_url`, `url`; *course:* `swim_type` (lake/sea/river/ocean/pool), `bike_terrain` (flat/rolling/hilly/mountainous), `run_terrain` (flat/rolling/hilly/trail); *conditions:* `temp_high_c`, `temp_low_c`, `water_temp_c`; *where/when:* `location`, `city`, `country`, `date`; *classification:* `distance_type` (sprint/olympic/70.3/ironman/…), `race_organizer`, `race_type`, `race_category`; *cutoffs (inform goals):* `cutoff_swim`, `cutoff_bike`, `cutoff_run`, `cutoff_overall` (intervals). Athletes browse/select; the owner curates via the admin screen.
- **`race_results`** — **per-athlete** finishing-time history. RLS: **read = own rows + any row with `visibility='public'`; write = own only**. Fields: `race_id` → `races` (if catalogued) **or** free-text `race_name` + `race_url`, `result_date`, `finish_swim`/`finish_t1`/`finish_bike`/`finish_t2`/`finish_run`/`finish_overall` (intervals), `placement`, `category_place`, **`visibility`** ('private' default | 'public'), `notes`. Multiple rows = history; used to set realistic goal targets.

`week_start` convention: the **Monday** of the week (ISO). All dates in the athlete's `timezone`.

---

## 6. Screens

Common shell: a minimal authenticated layout with light left-nav (or top-nav on mobile): **Review** (home), **Context**, **Plan**, **History**, **Settings**. A persistent week-context (which week you're reviewing) where relevant. Toaster for success/error.

### 6.1 Sign in
- Centered card, product wordmark, single email field, "Send magic link" button. Supabase magic-link auth. Invite-only: unknown emails get a neutral "If you have an invite, check your email" message (don't reveal existence).
- States: idle, sending, link-sent confirmation, error.

### 6.2 Onboarding (first run, if no Profile/Goal yet)
- Two sequential steps with a progress indicator:
  - **Step 1 — Preference Profile:** max hours/week. **Availability grid (Mon–Sun)** where each day has a granularity control — **Unspecified · Day total · AM + PM** — revealing the relevant hour input(s) → `available_hours` jsonb (mixed granularity; omitted days = flexible). Long-**swim**/long-**bike**/long-**run** day pickers; rest day; free-text constraints.
  - **Step 2 — Goal Manifest:** **target race** — search/select from the `races` catalog, *or* "not listed?" → free-text name + date + url; **goal type** (finish / target time / placement); target times for swim/T1/bike/T2/run/overall (`h:mm:ss`); notes. A **"Targets from history"** panel shows the selected race's **cutoffs** + the athlete's **`race_results`** history beside the target inputs to anchor realistic numbers.
- "Finish" writes version 1 of each, lands on Review. Both steps skippable-later but encouraged.
- States: empty (defaults), saving, error.

### 6.3 Weekly Review (home) — the core screen
Header: **week selector** (default = current week; navigate to prior weeks, read-only display of metrics, editable for the current/locked-pending week), week date range, and the primary **"Lock & Generate"** button (disabled with a hint until the week has at least some data).

Body — the **4 pillars** for Mon–Sun, calm and scannable:
- **Day rail (Mon–Sun):** a compact row/column of 7 day cards. Each day card surfaces: readiness/sleep score, resting HR/HRV, training load (and CTL/ATL/TSB trend), nutrition totals (cals + macros), and a count of activities. A day with no data shows an "Add data" affordance.
- **Daily physiological/load/nutrition entry:** clicking a day opens inline editing (a side panel or expandable row) with the `daily_metrics` fields grouped as Physiological / Training Load / Nutrition. Save = upsert on `(athlete_id, date)`.
- **Activities (Physical Output):** under each day, a list of workouts. **Add activity** (sport, name, start time, duration, distance, avg/max HR, avg power, elevation, load, intensity). Each activity has **tag chips** (free-text `tags[]`, with a few suggested: `Z2`, `threshold`, `VO2`, `recovery`, `long`, `brick`) and a per-workout **note**.
- **Subjective day note:** a text field per day ("how did you feel?").
- **Nutrition import:** an **"Import MyFitnessPal CSV"** action → file upload → parse meal-level rows → aggregate to daily totals → pre-fill `calories/carbs_g/protein_g/fat_g` for the matching dates (let the athlete confirm before saving). (MFP Premium export is a zip of CSVs; accept the meal/nutrition CSV.)
- States: empty week (clear call to add data or import), partial, loading, save errors, "week locked" (read-only with a banner + link to Generate).

### 6.4 Context (Profile & Goal)
- Two cards: **current Preference Profile** and **current Goal Manifest** (from the `current_*` views), each with an **Edit** action.
- Editing opens the same forms as onboarding, pre-filled. Saving prompts for an optional **`change_reason`** ("why did this change?") and writes a **new version** (don't mutate the old one).
- Show a **"Changed since last lock"** summary (diff of current vs the version at the last `weekly_reviews.locked_at`) — this is what the delta prompt will carry.
- States: viewing, editing, saving, version-history link (to History).

### 6.5 Generate (Lock & hand-off)
Reached from "Lock & Generate". Two clearly separated parts with copy buttons:
1. **Source docs for NotebookLM** (faithful to design D7 — bulk context lives in NotebookLM *sources*): four copyable text blocks the athlete keeps as NotebookLM sources, updating the changed ones each week:
   - `current-goal` — the current Goal Manifest, rendered readable.
   - `current-preference` — the current Preference Profile, rendered readable.
   - `current-plan` — last week's approved plan (the prescribed baseline); empty on week 1.
   - `current-week-data` — this week's actuals across all 4 pillars + tags/notes, rendered compactly (markdown table).
   Each block has a **Copy** button and a one-line "paste/update this as a NotebookLM source" hint. A short top note explains the one-time setup (also add research PDFs as sources).
2. **The prompt to paste** — the **delta prompt**, rendered from the active `prompt_templates.template` with placeholders filled: the parameter changes since last lock (previous→current + `change_reason`), the week range, and the required output JSON schema. One **Copy** button.
- On reaching this screen, create/lock the `weekly_reviews` row (`status='locked'`, `locked_at=now`, store `rendered_prompt`).
- States: generating, ready (docs + prompt shown), already-locked (re-show the stored prompt).

### 6.6 Paste plan
- A large textarea: "Paste the JSON NotebookLM returned." A **Validate & Save** button.
- Validate against the schema (§9). On success: insert a `plans` row (`status='proposed'`, `raw_json` = the exact paste, `week_start` = the week, `version` = max+1), the `plan_sessions`, and the `weekly_feedback` row. Navigate to Review plan.
- On failure: show **specific, friendly validation errors** (which field, what's wrong) without losing the pasted text. Common cases: not JSON, missing `sessions`, a session missing a required field, bad enum.
- States: empty, validating, error (with details), success.

### 6.7 Review plan
- Shows the **feedback** (coach commentary) prominently at top, then the **proposed 7-day plan** as an editable list or week-calendar: per session — day, sport, session_type, duration_min, target_zone, rationale. Inline-editable; add/remove sessions.
- Primary action **Approve** (`status='approved'`, `approved_at=now`), then offer **Push to Google Calendar** (or auto-push on approve — see 6.8). `raw_json` is preserved even after edits (audit of the original).
- States: proposed (editable), approving, approved, synced.

### 6.8 Calendar sync
- Requires a connected Google account (Settings). On approve (or via an explicit "Add to Google Calendar" button), create **one event per session** on the athlete's calendar at sensible default times (or let them set a daily default time), tagged by sport/type, with the rationale in the event description. Store each event id in `plan_sessions.google_event_id`; set `plans.status='synced'`, `synced_at`.
- States: not connected (CTA to connect), syncing, synced (with links), partial failure (retry).

### 6.9 History
- **Feedback journal:** reverse-chronological list of `weekly_feedback` (week + commentary) — the coaching narrative over time.
- **Past plans:** read-only view of prior `plans` + their sessions.
- **Version history:** Profile/Goal versions with `change_reason` and `valid_from`.

### 6.10 Settings
- Connect/disconnect **Google Calendar**; default session time-of-day; display name, timezone; sign out. (Intervals API key is **not** handled here — that's SP1.)

### 6.11 Races (browse & select)
- A searchable, filterable list of the shared **`races`** catalog (read-only for athletes): name, date, location, `distance_type`, thumbnail. Filter by distance / date / location. A race detail view shows course (swim/bike/run terrain), conditions (temps, water temp), cutoffs, organizer/category, and a link out (`url`), with a **"Set as my goal race"** action that feeds the Goal form. Athletes cannot edit catalog races.
- States: empty catalog ("no races yet — ask the organizer to add some"), loading, list, detail.

### 6.12 Race results (my history)
- The athlete's **`race_results`**: a list of past races with their finishing breakdown (swim/T1/bike/T2/run/overall). **Add result** — link a catalog race *or* free-text `race_name` + `race_url` + `result_date`; enter the segment finish times; `placement`/`category_place`; a **visibility toggle (private default / public)**; notes. Edit/delete own results. A small private/public indicator per row.
- This history feeds the Goal form's "Targets from history" panel.
- States: empty (add your first result), list, add/edit.

### 6.13 Admin — manage races (only when `is_admin`)
- Visible **only to admins** (`athletes.is_admin`). CRUD on the shared **`races`** catalog: add/edit a race with all fields — identity (name/description/images/url), course (swim_type, bike/run terrain), conditions (temps, water temp), where/when (location/city/country/date), classification (distance_type, organizer, race_type, category), and cutoffs. Hidden entirely for non-admin athletes (and the DB write policy enforces admin-only regardless of UI).
- States: list, add/edit, save errors, permission-denied guard.

---

## 7. Visual design system

**The design system is defined in `DESIGN.md` — that file is authoritative.** In short: **shadcn/ui** (Radix + Tailwind) on **Next.js**, themed by the shadcn preset **`b5pZXjoX4i`** (colors/fonts/radius/icons), with **light/dark via `next-themes`**. Build with shadcn components and the preset's semantic tokens (`bg-background`, `text-foreground`, `bg-primary`, …) — never hardcode colors.

Composition guidance for this app (layout/UX on top of the preset):
- **Calm and uncluttered** — generous spacing, clear hierarchy, numbers-first; a once-a-week reflective review, not a hype dashboard.
- **Data viz:** shadcn `Chart` (Recharts) for the fitness/fatigue/form (CTL/ATL/TSB) trend + per-pillar sparklines; quiet, numbers-first.
- **Layout:** desktop-first (the Sunday review happens at a desk), fully responsive; the day rail collapses gracefully on mobile.
- **Components:** shadcn `Card`, `Form` (rhf+zod), `Dialog`/`Sheet` for entry, `Badge` for tags, `Sonner` toasts, `Skeleton` loading.
- **Tone of copy:** warm, concise, coach-like; encouraging empty states ("Add your first session" / "Import your week from MyFitnessPal").

## 8. Cross-cutting behaviors

- **States everywhere:** every screen handles empty / loading / error / success. Saves are optimistic where safe, with toasts.
- **Validation:** strongest on the Paste screen (§9). Forms validate inline (durations as `h:mm:ss`, dates, numbers ≥ 0).
- **Accessibility:** keyboard-navigable, labeled inputs, sufficient contrast, focus states.
- **No secrets in the client:** only the publishable/anon Supabase key; RLS does isolation. Google tokens handled by the builder's auth integration, not stored in plain client state.
- **Timezones:** all dates in the athlete's `timezone`; `week_start` = Monday.

## 9. NotebookLM contract

**Output the app must parse (paste screen).** NotebookLM is prompted (via `prompt_templates`) to return ONLY this JSON:
```json
{
  "feedback": "string — commentary on the past week",
  "sessions": [
    {
      "day_of_week": 1,                 // 1=Mon .. 7=Sun
      "sport": "run",                   // swim | bike | run | strength | other
      "session_type": "Z2 endurance",
      "duration_min": 60,
      "target_zone": "Z2",
      "rationale": "string — why this session"
    }
  ]
}
```
Validation: must be valid JSON; `feedback` non-empty string; `sessions` a non-empty array; each session has `day_of_week` (int 1–7), `sport` (string), `session_type` (string), `duration_min` (int > 0), `target_zone` (string), `rationale` (string). Be lenient on extra keys (ignore) and on a fenced ```json code block (strip fences before parsing). Store the raw paste in `plans.raw_json` regardless.

**Input the app produces (generate screen):** the 4 source docs (§6.5) + a delta prompt rendered from the active template, injecting previous→current parameter changes (with `change_reason`) and the schema above.

## 10. Acceptance criteria

1. Invite-only sign-in works; a signed-in athlete sees only their own data on every screen (RLS).
2. First-run onboarding writes version 1 of Preference Profile + Goal Manifest.
3. The athlete can manually add/edit a full week of data (activities + daily metrics + nutrition), tag workouts, and add day notes; nutrition can be bulk-filled from a MyFitnessPal CSV.
4. Editing Profile/Goal creates a new version (old preserved) with an optional `change_reason`, and the "changed since last lock" delta is shown.
5. "Lock & Generate" locks the week and produces the 4 copyable source docs + a copyable delta prompt; the prompt is stored in `weekly_reviews.rendered_prompt`.
6. Pasting valid plan JSON stores a proposed plan + sessions + feedback; invalid JSON shows specific errors and loses nothing.
7. The proposed plan is reviewable/editable; Approve sets `approved`; calendar push creates one event per session and records `google_event_id`, setting `synced`.
8. History shows the feedback journal, past plans, and Profile/Goal version history.
9. Visual result reads as calm & minimal, light-default, responsive.
10. Availability supports mixed granularity (unspecified / day-total / AM-PM, mix-and-match across days); per-discipline long days + rest day save correctly.
11. A goal can target a catalog race **or** a free-text race (name/date/url); `goal_type` is captured; the goal form surfaces the race's cutoffs + the athlete's `race_results` history.
12. Athletes can browse/select the shared `races` catalog (read-only) and manage their own `race_results` with a working private/public visibility toggle (public results visible to other athletes; private ones not).
13. The admin race-management screen appears only for `is_admin` athletes; a non-admin cannot write to `races` even if they bypass the UI (DB policy enforces it).

## 11. Notes for whoever builds this

- Built as a **hand/AI-coded Next.js + TypeScript app** using **shadcn/ui** (scaffold with `npx shadcn@latest init --preset b5pZXjoX4i --base base --template next`; see `DESIGN.md`) and **`supabase-js`** against the existing Supabase project (publishable key; RLS = isolation). The DB schema is already migrated on the cloud dev project.
- This spec deliberately includes the **data contract** (§5) and the **NotebookLM JSON** (§9) so it's self-contained; the **visual system** is in `DESIGN.md`.
- When **SP1** lands, manual data entry becomes a fallback (data auto-arrives); when **SP3** lands, the Generate screen's manual "copy these source docs" step is replaced by automated Drive sync. Design the Generate and entry screens so those can be swapped without reworking the rest.
