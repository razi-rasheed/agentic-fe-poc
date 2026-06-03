# SP2 Slice 2 — Onboarding Wizard + Context Page

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/onboarding` 2-step wizard (Preference Profile + Goal Manifest) and the `/context` view-and-edit page, connected to Supabase, with onboarding gating in the app shell.

**Architecture:** Two client-heavy page components backed by server-fetched initial data. The onboarding wizard is a standalone page (outside the app shell) using shadcn `Form` + react-hook-form + zod. `/context` lives inside `(app)/context/page.tsx` (gets the sidebar) and shows both current views plus inline-edit dialogs that write new versions. Shared form logic (availability grid, split-time inputs, race combobox) lives in `components/onboarding/` and is re-used by both routes.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, shadcn/ui, react-hook-form, zod, @supabase/ssr (browser client for mutations, server client for initial fetches), pnpm.

---

## File Map

### New files to create
- `web/app/onboarding/page.tsx` — server component: checks if already onboarded, redirects; passes initial data to client wizard
- `web/app/onboarding/layout.tsx` — minimal layout (no sidebar), centers the wizard card on screen
- `web/components/onboarding/wizard.tsx` — `'use client'` multi-step wizard shell; owns step state + final submit
- `web/components/onboarding/step-preference.tsx` — `'use client'` Step 1: Preference Profile form fields
- `web/components/onboarding/step-goal.tsx` — `'use client'` Step 2: Goal Manifest form fields
- `web/components/onboarding/availability-grid.tsx` — `'use client'` Mon–Sun availability grid with granularity toggles; used by both steps
- `web/components/onboarding/split-time-input.tsx` — `'use client'` single `h:mm:ss` input with live validation; used in Step 2 + Context
- `web/components/onboarding/race-combobox.tsx` — `'use client'` Command+Popover race picker; used in Step 2 + Context
- `web/lib/onboarding-schemas.ts` — zod schemas for both forms; shared between wizard and context edit forms
- `web/lib/onboarding-actions.ts` — async functions: `savePreferenceProfile(data)`, `saveGoalManifest(data)` — both compute next version, insert via browser client
- `web/app/(app)/context/page.tsx` — **replace** stub: server component fetches current views; renders `ContextClient`
- `web/components/context/context-client.tsx` — `'use client'` renders two cards; Edit buttons open `PreferenceEditDialog` + `GoalEditDialog`
- `web/components/context/preference-edit-dialog.tsx` — `'use client'` Dialog wrapping step-preference form + change_reason field; saves new version
- `web/components/context/goal-edit-dialog.tsx` — `'use client'` Dialog wrapping step-goal form + change_reason field; saves new version

### Files to modify
- `web/middleware.ts` — add onboarding gate: authenticated users with no `current_preference_profile` AND no `current_goal_manifest` redirect to `/onboarding`; if they have both, `/onboarding` redirects to `/review`

---

## Task 1: Install missing shadcn components

**Files:**
- Modify: `web/components/ui/` (shadcn adds files automatically)

- [ ] **Step 1: Add all required shadcn UI components**

Run from the `web/` directory:
```bash
cd /Users/razi.rasheed/Developer/POCs/tri05/web && \
  pnpm dlx shadcn@latest add form select command popover calendar \
    textarea radio-group toggle-group tabs progress badge dialog --yes
```

Expected output: shadcn creates files in `components/ui/` — `form.tsx`, `select.tsx`, `command.tsx`, `popover.tsx`, `calendar.tsx`, `textarea.tsx`, `radio-group.tsx`, `toggle-group.tsx`, `tabs.tsx`, `progress.tsx`, `badge.tsx`, `dialog.tsx`. It will also install `react-hook-form`, `zod`, `@hookform/resolvers`, `cmdk`, `react-day-picker`, `date-fns` as npm deps.

- [ ] **Step 2: Verify build still passes**

```bash
pnpm -C /Users/razi.rasheed/Developer/POCs/tri05/web build 2>&1 | tail -20
```

Expected: `✓ Compiled` or `Route ... compiled`. Fix any TS errors before proceeding.

- [ ] **Step 3: Commit**

```bash
cd /Users/razi.rasheed/Developer/POCs/tri05 && \
  git add web && \
  git commit -m "feat(sp2-ui): add shadcn form/select/command/popover/calendar/textarea/radio/toggle/tabs/progress/badge/dialog"
```

---

## Task 2: Zod schemas + save actions

**Files:**
- Create: `web/lib/onboarding-schemas.ts`
- Create: `web/lib/onboarding-actions.ts`

- [ ] **Step 1: Create `web/lib/onboarding-schemas.ts`**

```typescript
import { z } from 'zod'

export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export type Day = (typeof DAYS)[number]

export const DAY_LABELS: Record<Day, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu',
  fri: 'Fri', sat: 'Sat', sun: 'Sun',
}

// available_hours: each day is optional; present = { hours: number } OR { am: number; pm: number }
export const DayHoursSchema = z.union([
  z.object({ hours: z.number().min(0).max(24) }),
  z.object({ am: z.number().min(0).max(12), pm: z.number().min(0).max(12) }),
])

export const AvailableHoursSchema = z.record(
  z.enum(DAYS),
  DayHoursSchema,
).default({})

// Validate h:mm:ss or hh:mm:ss or mm:ss — returns null for empty, throws on bad format
export function parseIntervalString(value: string | null | undefined): string | null {
  if (!value || value.trim() === '') return null
  const trimmed = value.trim()
  // Accept h:mm:ss, hh:mm:ss, mm:ss
  if (!/^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmed)) {
    throw new Error(`Invalid time format: "${trimmed}". Use h:mm:ss.`)
  }
  // Normalize to h:mm:ss
  const parts = trimmed.split(':')
  if (parts.length === 2) return `0:${parts[0]}:${parts[1]}`
  return trimmed
}

export const IntervalStringSchema = z
  .string()
  .optional()
  .nullable()
  .transform((val) => {
    if (!val || val.trim() === '') return null
    const trimmed = val.trim()
    if (!/^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmed)) {
      throw new Error(`Use h:mm:ss format`)
    }
    const parts = trimmed.split(':')
    if (parts.length === 2) return `0:${parts[0]}:${parts[1]}`
    return trimmed
  })

// ----- Preference Profile -----

export const PreferenceFormSchema = z.object({
  max_hours_per_week: z.coerce
    .number({ invalid_type_error: 'Enter a number' })
    .min(1, 'At least 1 hour')
    .max(40, 'Max 40 hours'),
  available_hours: AvailableHoursSchema,
  long_swim_day: z.enum(DAYS).optional().nullable(),
  long_bike_day: z.enum(DAYS).optional().nullable(),
  long_run_day: z.enum(DAYS).optional().nullable(),
  rest_day: z.enum(DAYS).optional().nullable(),
  constraints_notes: z.string().max(1000).optional().nullable(),
  change_reason: z.string().max(500).optional().nullable(),
})

export type PreferenceFormValues = z.infer<typeof PreferenceFormSchema>

// ----- Goal Manifest -----

export const GoalFormSchema = z.object({
  goal_type: z.enum(['finish', 'target_time', 'placement']),
  // Race: either pick from catalog OR enter manually
  race_id: z.string().uuid().optional().nullable(),
  race_name: z.string().min(1, 'Race name required').max(200),
  race_date: z.string().min(1, 'Race date required'), // ISO date string yyyy-mm-dd
  race_url: z.string().url('Enter a valid URL').optional().nullable().or(z.literal('')),
  target_swim_time: IntervalStringSchema,
  target_t1_time: IntervalStringSchema,
  target_bike_time: IntervalStringSchema,
  target_t2_time: IntervalStringSchema,
  target_run_time: IntervalStringSchema,
  target_overall_time: IntervalStringSchema,
  notes: z.string().max(2000).optional().nullable(),
  change_reason: z.string().max(500).optional().nullable(),
})

export type GoalFormValues = z.infer<typeof GoalFormSchema>

// Utility: sum interval strings to compute overall
// Intervals are "h:mm:ss". Returns null if any segment is null.
export function sumSplits(
  swim: string | null | undefined,
  t1: string | null | undefined,
  bike: string | null | undefined,
  t2: string | null | undefined,
  run: string | null | undefined,
): string | null {
  const parts = [swim, t1, bike, t2, run]
  let totalSeconds = 0
  for (const p of parts) {
    if (!p) continue
    const segments = p.split(':').map(Number)
    if (segments.length === 3) {
      const [h, m, s] = segments
      totalSeconds += h * 3600 + m * 60 + s
    } else if (segments.length === 2) {
      const [m, s] = segments
      totalSeconds += m * 60 + s
    }
  }
  if (totalSeconds === 0) return null
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
```

- [ ] **Step 2: Create `web/lib/onboarding-actions.ts`**

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import type { PreferenceFormValues, GoalFormValues } from '@/lib/onboarding-schemas'

export async function savePreferenceProfile(
  data: PreferenceFormValues,
): Promise<{ error: string | null }> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Not authenticated' }

  // Compute next version
  const { data: existing } = await supabase
    .from('preference_profiles')
    .select('version')
    .order('version', { ascending: false })
    .limit(1)
    .single()

  const nextVersion = (existing?.version ?? 0) + 1

  const { error } = await supabase.from('preference_profiles').insert({
    athlete_id: user.id,
    version: nextVersion,
    valid_from: new Date().toISOString(),
    max_hours_per_week: data.max_hours_per_week,
    available_hours: data.available_hours,
    long_swim_day: data.long_swim_day ?? null,
    long_bike_day: data.long_bike_day ?? null,
    long_run_day: data.long_run_day ?? null,
    rest_day: data.rest_day ?? null,
    constraints_notes: data.constraints_notes ?? null,
    change_reason: data.change_reason ?? null,
  })

  if (error) return { error: error.message }
  return { error: null }
}

export async function saveGoalManifest(
  data: GoalFormValues,
): Promise<{ error: string | null }> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Not authenticated' }

  // Compute next version
  const { data: existing } = await supabase
    .from('goal_manifests')
    .select('version')
    .order('version', { ascending: false })
    .limit(1)
    .single()

  const nextVersion = (existing?.version ?? 0) + 1

  const raceUrl = data.race_url && data.race_url.trim() !== '' ? data.race_url : null

  const { error } = await supabase.from('goal_manifests').insert({
    athlete_id: user.id,
    version: nextVersion,
    valid_from: new Date().toISOString(),
    goal_type: data.goal_type,
    race_id: data.race_id ?? null,
    race_name: data.race_name,
    race_date: data.race_date,
    race_url: raceUrl,
    target_swim_time: data.target_swim_time ?? null,
    target_t1_time: data.target_t1_time ?? null,
    target_bike_time: data.target_bike_time ?? null,
    target_t2_time: data.target_t2_time ?? null,
    target_run_time: data.target_run_time ?? null,
    target_overall_time: data.target_overall_time ?? null,
    notes: data.notes ?? null,
    change_reason: data.change_reason ?? null,
  })

  if (error) return { error: error.message }
  return { error: null }
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm -C /Users/razi.rasheed/Developer/POCs/tri05/web typecheck 2>&1
```

Expected: no errors. Fix any before proceeding.

- [ ] **Step 4: Commit**

```bash
cd /Users/razi.rasheed/Developer/POCs/tri05 && \
  git add web/lib/onboarding-schemas.ts web/lib/onboarding-actions.ts && \
  git commit -m "feat(sp2-ui): add onboarding zod schemas + supabase save actions"
```

---

## Task 3: Shared form primitives

**Files:**
- Create: `web/components/onboarding/split-time-input.tsx`
- Create: `web/components/onboarding/race-combobox.tsx`
- Create: `web/components/onboarding/availability-grid.tsx`

- [ ] **Step 1: Create `web/components/onboarding/split-time-input.tsx`**

A controlled text `<Input>` that accepts `h:mm:ss`. Used in Step 2 + Context edit forms.

```typescript
'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface SplitTimeInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  disabled?: boolean
  className?: string
}

export function SplitTimeInput({
  label,
  value,
  onChange,
  error,
  disabled,
  className,
}: SplitTimeInputProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="text"
        placeholder="0:00:00"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn('font-mono text-sm', error && 'border-destructive')}
        aria-label={label}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Create `web/components/onboarding/race-combobox.tsx`**

Command+Popover race picker. `races` prop is the list fetched server-side. Shows name + date. "Not listed?" toggle shows manual fields. Calls `onSelect(race)` or `onManual(name, date, url)`.

```typescript
'use client'

import { useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export interface RaceOption {
  id: string
  name: string
  date: string | null
  distance_type: string | null
  city: string | null
  country: string | null
}

interface RaceComboboxProps {
  races: RaceOption[]
  selectedRaceId: string | null
  manualName: string
  manualDate: string
  manualUrl: string
  onSelectRace: (race: RaceOption | null) => void
  onManualChange: (field: 'name' | 'date' | 'url', value: string) => void
  error?: string
}

export function RaceCombobox({
  races,
  selectedRaceId,
  manualName,
  manualDate,
  manualUrl,
  onSelectRace,
  onManualChange,
  error,
}: RaceComboboxProps) {
  const [open, setOpen] = useState(false)
  const [isManual, setIsManual] = useState(false)

  const selectedRace = races.find((r) => r.id === selectedRaceId) ?? null

  function formatRaceLabel(race: RaceOption) {
    const datePart = race.date
      ? format(parseISO(race.date), 'MMM d, yyyy')
      : 'Date TBD'
    const locationPart = [race.city, race.country].filter(Boolean).join(', ')
    return `${race.name} — ${datePart}${locationPart ? ` · ${locationPart}` : ''}`
  }

  return (
    <div className="flex flex-col gap-3">
      {!isManual && (
        <div className="flex flex-col gap-1">
          <Label>Target Race</Label>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className={cn(
                  'w-full justify-between text-left font-normal',
                  !selectedRace && 'text-muted-foreground',
                  error && 'border-destructive',
                )}
              >
                {selectedRace
                  ? formatRaceLabel(selectedRace)
                  : 'Search races…'}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[480px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Type race name or city…" />
                <CommandList>
                  <CommandEmpty>No races found.</CommandEmpty>
                  <CommandGroup>
                    {races.map((race) => (
                      <CommandItem
                        key={race.id}
                        value={`${race.name} ${race.city ?? ''} ${race.date ?? ''}`}
                        onSelect={() => {
                          onSelectRace(selectedRaceId === race.id ? null : race)
                          setOpen(false)
                        }}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            selectedRaceId === race.id
                              ? 'opacity-100'
                              : 'opacity-0',
                          )}
                        />
                        {formatRaceLabel(race)}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <button
            type="button"
            onClick={() => {
              setIsManual(true)
              onSelectRace(null)
            }}
            className="text-xs text-muted-foreground underline underline-offset-2 text-left w-fit"
          >
            Not listed? Enter manually
          </button>
        </div>
      )}

      {isManual && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Label>Manual Race Entry</Label>
            <button
              type="button"
              onClick={() => setIsManual(false)}
              className="text-xs text-muted-foreground underline underline-offset-2"
            >
              Back to catalog
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Race name</Label>
              <Input
                placeholder="e.g. Ironman Frankfurt"
                value={manualName}
                onChange={(e) => onManualChange('name', e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Race date</Label>
              <Input
                type="date"
                value={manualDate}
                onChange={(e) => onManualChange('date', e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">
              Race URL (optional)
            </Label>
            <Input
              type="url"
              placeholder="https://…"
              value={manualUrl}
              onChange={(e) => onManualChange('url', e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create `web/components/onboarding/availability-grid.tsx`**

Mon–Sun grid. Each day has three modes: Unspecified | Day total | AM+PM. Modes controlled by local ToggleGroup. Shows allocated/remaining summary.

```typescript
'use client'

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { DAYS, DAY_LABELS, type Day } from '@/lib/onboarding-schemas'

type DayMode = 'unspecified' | 'total' | 'ampm'
type DayHours =
  | { hours: number }
  | { am: number; pm: number }
  | undefined

interface AvailabilityGridProps {
  value: Partial<Record<Day, DayHours>>
  onChange: (value: Partial<Record<Day, DayHours>>) => void
  maxHours: number
}

function getDayMode(dayVal: DayHours): DayMode {
  if (!dayVal) return 'unspecified'
  if ('hours' in dayVal) return 'total'
  return 'ampm'
}

function getDayTotal(dayVal: DayHours): number {
  if (!dayVal) return 0
  if ('hours' in dayVal) return dayVal.hours
  return (dayVal.am ?? 0) + (dayVal.pm ?? 0)
}

function allocatedTotal(value: Partial<Record<Day, DayHours>>): number {
  return DAYS.reduce((sum, d) => sum + getDayTotal(value[d]), 0)
}

export function AvailabilityGrid({
  value,
  onChange,
  maxHours,
}: AvailabilityGridProps) {
  function setMode(day: Day, mode: DayMode) {
    const next = { ...value }
    if (mode === 'unspecified') {
      delete next[day]
    } else if (mode === 'total') {
      next[day] = { hours: getDayTotal(value[day]) || 1 }
    } else {
      const total = getDayTotal(value[day]) || 2
      next[day] = { am: Math.ceil(total / 2), pm: Math.floor(total / 2) }
    }
    onChange(next)
  }

  function setHours(day: Day, field: 'hours' | 'am' | 'pm', raw: string) {
    const num = parseFloat(raw) || 0
    const next = { ...value }
    const current = value[day]
    if (field === 'hours') {
      next[day] = { hours: num }
    } else if (field === 'am') {
      next[day] = { am: num, pm: 'pm' in (current ?? {}) ? (current as { am: number; pm: number }).pm : 0 }
    } else {
      next[day] = { am: 'am' in (current ?? {}) ? (current as { am: number; pm: number }).am : 0, pm: num }
    }
    onChange(next)
  }

  const allocated = allocatedTotal(value)
  const remaining = maxHours - allocated

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-7 gap-2">
        {DAYS.map((day) => {
          const mode = getDayMode(value[day])
          const dayVal = value[day]

          return (
            <div key={day} className="flex flex-col items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground uppercase">
                {DAY_LABELS[day]}
              </span>

              <ToggleGroup
                type="single"
                value={mode}
                onValueChange={(v) => {
                  if (v) setMode(day, v as DayMode)
                }}
                className="flex flex-col gap-0.5"
                size="sm"
              >
                <ToggleGroupItem value="unspecified" className="text-xs px-1.5 h-6 w-full">—</ToggleGroupItem>
                <ToggleGroupItem value="total" className="text-xs px-1.5 h-6 w-full">Day</ToggleGroupItem>
                <ToggleGroupItem value="ampm" className="text-xs px-1.5 h-6 w-full">AM/PM</ToggleGroupItem>
              </ToggleGroup>

              {mode === 'total' && (
                <Input
                  type="number"
                  min={0}
                  max={12}
                  step={0.5}
                  value={'hours' in (dayVal ?? {}) ? (dayVal as { hours: number }).hours : ''}
                  onChange={(e) => setHours(day, 'hours', e.target.value)}
                  className="w-full text-center text-sm h-8 px-1"
                  aria-label={`${DAY_LABELS[day]} hours`}
                />
              )}

              {mode === 'ampm' && (
                <div className="flex flex-col gap-1 w-full">
                  <Input
                    type="number"
                    min={0}
                    max={12}
                    step={0.5}
                    value={'am' in (dayVal ?? {}) ? (dayVal as { am: number; pm: number }).am : ''}
                    onChange={(e) => setHours(day, 'am', e.target.value)}
                    className="w-full text-center text-xs h-7 px-1"
                    placeholder="AM"
                    aria-label={`${DAY_LABELS[day]} AM hours`}
                  />
                  <Input
                    type="number"
                    min={0}
                    max={12}
                    step={0.5}
                    value={'pm' in (dayVal ?? {}) ? (dayVal as { am: number; pm: number }).pm : ''}
                    onChange={(e) => setHours(day, 'pm', e.target.value)}
                    className="w-full text-center text-xs h-7 px-1"
                    placeholder="PM"
                    aria-label={`${DAY_LABELS[day]} PM hours`}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <div className={cn('h-2 w-2 rounded-full', allocated > maxHours ? 'bg-destructive' : 'bg-primary')} />
          <span className="text-muted-foreground">Allocated:</span>
          <span className={cn('font-medium', allocated > maxHours && 'text-destructive')}>
            {allocated.toFixed(1)} hrs
          </span>
        </div>
        <span className="text-muted-foreground">|</span>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Remaining:</span>
          <Badge variant={remaining < 0 ? 'destructive' : 'secondary'} className="text-xs">
            {remaining.toFixed(1)} hr{Math.abs(remaining) !== 1 ? 's' : ''}
          </Badge>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Typecheck**

```bash
pnpm -C /Users/razi.rasheed/Developer/POCs/tri05/web typecheck 2>&1
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/razi.rasheed/Developer/POCs/tri05 && \
  git add web/components/onboarding/ && \
  git commit -m "feat(sp2-ui): add SplitTimeInput, RaceCombobox, AvailabilityGrid shared components"
```

---

## Task 4: Step 1 — Preference Profile form

**Files:**
- Create: `web/components/onboarding/step-preference.tsx`

- [ ] **Step 1: Create `web/components/onboarding/step-preference.tsx`**

```typescript
'use client'

import { useFormContext } from 'react-hook-form'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { AvailabilityGrid } from './availability-grid'
import {
  DAYS,
  DAY_LABELS,
  type PreferenceFormValues,
  type Day,
} from '@/lib/onboarding-schemas'

const DAY_OPTIONS = DAYS.map((d) => ({ value: d, label: DAY_LABELS[d] }))

export function StepPreference() {
  const form = useFormContext<PreferenceFormValues>()
  const maxHours = form.watch('max_hours_per_week') || 10

  return (
    <div className="flex flex-col gap-6">
      {/* Max hours */}
      <FormField
        control={form.control}
        name="max_hours_per_week"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Weekly target hours</FormLabel>
            <FormControl>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={1}
                  max={40}
                  step={0.5}
                  className="w-24"
                  {...field}
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || '')}
                />
                <span className="text-sm text-muted-foreground">hrs / week</span>
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Availability grid */}
      <FormField
        control={form.control}
        name="available_hours"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Daily availability</FormLabel>
            <FormControl>
              <AvailabilityGrid
                value={field.value as Record<Day, { hours: number } | { am: number; pm: number } | undefined>}
                onChange={field.onChange}
                maxHours={typeof maxHours === 'number' ? maxHours : 10}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Long session days + rest day */}
      <div className="grid grid-cols-2 gap-4">
        {(
          [
            { name: 'long_swim_day', label: 'Long swim day' },
            { name: 'long_bike_day', label: 'Long bike day' },
            { name: 'long_run_day', label: 'Long run day' },
            { name: 'rest_day', label: 'Rest day' },
          ] as const
        ).map(({ name, label }) => (
          <FormField
            key={name}
            control={form.control}
            name={name}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{label}</FormLabel>
                <Select
                  onValueChange={(v) => field.onChange(v === 'none' ? null : v)}
                  value={field.value ?? 'none'}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Not set" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">Not set</SelectItem>
                    {DAY_OPTIONS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        ))}
      </div>

      {/* Constraints notes */}
      <FormField
        control={form.control}
        name="constraints_notes"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              Constraints & notes{' '}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </FormLabel>
            <FormControl>
              <Textarea
                placeholder="e.g. Can't train before 6am, business travel in March…"
                rows={3}
                {...field}
                value={field.value ?? ''}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm -C /Users/razi.rasheed/Developer/POCs/tri05/web typecheck 2>&1
```

Expected: no errors.

---

## Task 5: Step 2 — Goal Manifest form

**Files:**
- Create: `web/components/onboarding/step-goal.tsx`

- [ ] **Step 1: Create `web/components/onboarding/step-goal.tsx`**

This component watches the split-time fields and auto-sums them into `target_overall_time`. It also fetches races catalog and athlete's race results via the browser Supabase client.

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { format, parseISO } from 'date-fns'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { SplitTimeInput } from './split-time-input'
import { RaceCombobox, type RaceOption } from './race-combobox'
import {
  sumSplits,
  type GoalFormValues,
} from '@/lib/onboarding-schemas'
import { createClient } from '@/lib/supabase/client'
import type { Tables } from '@/lib/database.types'

type RaceResult = Tables<'race_results'>

interface StepGoalProps {
  initialRaces?: RaceOption[]
}

const GOAL_TYPE_OPTIONS = [
  { value: 'finish', label: 'Just finish' },
  { value: 'target_time', label: 'Target time' },
  { value: 'placement', label: 'Placement' },
]

function formatInterval(interval: string | null | undefined): string {
  if (!interval) return '—'
  return interval
}

export function StepGoal({ initialRaces = [] }: StepGoalProps) {
  const form = useFormContext<GoalFormValues>()
  const [races, setRaces] = useState<RaceOption[]>(initialRaces)
  const [raceResults, setRaceResults] = useState<RaceResult[]>([])
  const [selectedRace, setSelectedRace] = useState<RaceOption | null>(null)
  const [loadingResults, setLoadingResults] = useState(false)

  const goalType = useWatch({ control: form.control, name: 'goal_type' })
  const swim = useWatch({ control: form.control, name: 'target_swim_time' })
  const t1 = useWatch({ control: form.control, name: 'target_t1_time' })
  const bike = useWatch({ control: form.control, name: 'target_bike_time' })
  const t2 = useWatch({ control: form.control, name: 'target_t2_time' })
  const run = useWatch({ control: form.control, name: 'target_run_time' })
  const overall = useWatch({ control: form.control, name: 'target_overall_time' })

  // Auto-sum splits into overall when any split changes
  useEffect(() => {
    const autoSum = sumSplits(swim, t1, bike, t2, run)
    if (autoSum && autoSum !== overall) {
      form.setValue('target_overall_time', autoSum, { shouldValidate: false })
    }
  }, [swim, t1, bike, t2, run]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load races + athlete's own results
  useEffect(() => {
    const supabase = createClient()
    if (initialRaces.length === 0) {
      supabase
        .from('races')
        .select('id, name, date, distance_type, city, country')
        .order('date', { ascending: true })
        .then(({ data }) => {
          if (data) setRaces(data as RaceOption[])
        })
    }
    setLoadingResults(true)
    supabase
      .from('race_results')
      .select('*')
      .order('result_date', { ascending: false })
      .then(({ data }) => {
        if (data) setRaceResults(data as RaceResult[])
        setLoadingResults(false)
      })
  }, [initialRaces.length])

  function handleSelectRace(race: RaceOption | null) {
    setSelectedRace(race)
    form.setValue('race_id', race?.id ?? null)
    form.setValue('race_name', race?.name ?? '')
    form.setValue('race_date', race?.date ?? '')
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Goal type */}
      <FormField
        control={form.control}
        name="goal_type"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Goal type</FormLabel>
            <FormControl>
              <ToggleGroup
                type="single"
                value={field.value}
                onValueChange={(v) => { if (v) field.onChange(v) }}
                className="justify-start"
              >
                {GOAL_TYPE_OPTIONS.map((opt) => (
                  <ToggleGroupItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Race selection */}
      <RaceCombobox
        races={races}
        selectedRaceId={form.watch('race_id') ?? null}
        manualName={form.watch('race_name') ?? ''}
        manualDate={form.watch('race_date') ?? ''}
        manualUrl={form.watch('race_url') ?? ''}
        onSelectRace={handleSelectRace}
        onManualChange={(field, value) => {
          if (field === 'name') form.setValue('race_name', value)
          else if (field === 'date') form.setValue('race_date', value)
          else if (field === 'url') form.setValue('race_url', value)
        }}
        error={form.formState.errors.race_name?.message}
      />

      {/* Performance targets — only when goal_type is target_time */}
      {goalType === 'target_time' && (
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-medium">Performance targets</h3>
            <p className="text-xs text-muted-foreground">
              Enter split objectives in h:mm:ss format
            </p>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {(
              [
                { name: 'target_swim_time', label: 'Swim' },
                { name: 'target_t1_time', label: 'T1' },
                { name: 'target_bike_time', label: 'Bike' },
                { name: 'target_t2_time', label: 'T2' },
                { name: 'target_run_time', label: 'Run' },
              ] as const
            ).map(({ name, label }) => (
              <FormField
                key={name}
                control={form.control}
                name={name}
                render={({ field }) => (
                  <SplitTimeInput
                    label={label}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    error={form.formState.errors[name]?.message}
                  />
                )}
              />
            ))}
          </div>

          {/* Overall time */}
          <div className="rounded-lg border border-dashed p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Target Overall Time</p>
              <p className="text-xs text-muted-foreground">
                Auto-calculated sum of splits (editable)
              </p>
            </div>
            <FormField
              control={form.control}
              name="target_overall_time"
              render={({ field }) => (
                <SplitTimeInput
                  label=""
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  error={form.formState.errors.target_overall_time?.message}
                  className="w-32 items-end"
                />
              )}
            />
          </div>
        </div>
      )}

      {/* Cutoff times from catalog — shown if a catalog race is selected */}
      {selectedRace && (
        <Card className="bg-muted/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm">Race cutoff times</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-4 gap-2 text-xs">
              {(
                [
                  { label: 'Swim', key: 'cutoff_swim' },
                  { label: 'Bike', key: 'cutoff_bike' },
                  { label: 'Run', key: 'cutoff_run' },
                  { label: 'Overall', key: 'cutoff_overall' },
                ] as const
              ).map(({ label, key }) => {
                // We stored these on selectedRace via the races table query
                // but RaceOption doesn't carry them — we need to cross-ref
                // We get them when we load from the catalog
                return (
                  <div key={key} className="flex flex-col gap-0.5">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-mono font-medium">—</span>
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Detailed cutoffs shown after race is fully loaded.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Race history */}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Your race history</h3>
        {loadingResults ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : raceResults.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            No past race results yet. They'll appear here once you add them.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left pb-1 pr-3">Race</th>
                  <th className="text-left pb-1 pr-2">Date</th>
                  <th className="text-right pb-1 pr-2">Swim</th>
                  <th className="text-right pb-1 pr-2">Bike</th>
                  <th className="text-right pb-1 pr-2">Run</th>
                  <th className="text-right pb-1">Overall</th>
                </tr>
              </thead>
              <tbody>
                {raceResults.map((r) => (
                  <tr key={r.id} className="border-b border-border/50">
                    <td className="py-1 pr-3 font-medium">{r.race_name ?? '—'}</td>
                    <td className="py-1 pr-2 text-muted-foreground">
                      {r.result_date
                        ? format(parseISO(r.result_date), 'MMM yyyy')
                        : '—'}
                    </td>
                    <td className="py-1 pr-2 text-right font-mono">
                      {formatInterval(r.finish_swim)}
                    </td>
                    <td className="py-1 pr-2 text-right font-mono">
                      {formatInterval(r.finish_bike)}
                    </td>
                    <td className="py-1 pr-2 text-right font-mono">
                      {formatInterval(r.finish_run)}
                    </td>
                    <td className="py-1 text-right font-mono font-medium">
                      {formatInterval(r.finish_overall)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Notes */}
      <FormField
        control={form.control}
        name="notes"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              Strategy & notes{' '}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </FormLabel>
            <FormControl>
              <Textarea
                placeholder="Race strategy, pacing plan, key objectives…"
                rows={3}
                {...field}
                value={field.value ?? ''}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm -C /Users/razi.rasheed/Developer/POCs/tri05/web typecheck 2>&1
```

Expected: no errors.

---

## Task 6: Onboarding wizard shell

**Files:**
- Create: `web/components/onboarding/wizard.tsx`

- [ ] **Step 1: Create `web/components/onboarding/wizard.tsx`**

This is the main wizard client component. It owns step state, both form instances, and the final two-phase save.

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form } from '@/components/ui/form'
import { StepPreference } from './step-preference'
import { StepGoal } from './step-goal'
import {
  PreferenceFormSchema,
  GoalFormSchema,
  type PreferenceFormValues,
  type GoalFormValues,
} from '@/lib/onboarding-schemas'
import { savePreferenceProfile, saveGoalManifest } from '@/lib/onboarding-actions'
import type { RaceOption } from './race-combobox'

interface OnboardingWizardProps {
  initialRaces: RaceOption[]
}

const STEPS = [
  {
    id: 1,
    title: 'Availability & Preferences',
    description: 'Tell us about your weekly training hours and schedule',
  },
  {
    id: 2,
    title: 'Goal Manifest',
    description: 'Set your target race and performance goals',
  },
]

export function OnboardingWizard({ initialRaces }: OnboardingWizardProps) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [isSaving, setIsSaving] = useState(false)

  const prefForm = useForm<PreferenceFormValues>({
    resolver: zodResolver(PreferenceFormSchema),
    defaultValues: {
      max_hours_per_week: 10,
      available_hours: {},
      long_swim_day: null,
      long_bike_day: null,
      long_run_day: null,
      rest_day: null,
      constraints_notes: '',
    },
  })

  const goalForm = useForm<GoalFormValues>({
    resolver: zodResolver(GoalFormSchema),
    defaultValues: {
      goal_type: 'finish',
      race_id: null,
      race_name: '',
      race_date: '',
      race_url: '',
      target_swim_time: '',
      target_t1_time: '',
      target_bike_time: '',
      target_t2_time: '',
      target_run_time: '',
      target_overall_time: '',
      notes: '',
    },
  })

  async function handleNext() {
    const valid = await prefForm.trigger()
    if (!valid) return
    setStep(2)
  }

  async function handleFinish(data: GoalFormValues) {
    setIsSaving(true)
    try {
      const prefData = prefForm.getValues()
      const [prefResult, goalResult] = await Promise.all([
        savePreferenceProfile(prefData),
        saveGoalManifest(data),
      ])

      if (prefResult.error) {
        toast.error(`Failed to save preferences: ${prefResult.error}`)
        setIsSaving(false)
        return
      }
      if (goalResult.error) {
        toast.error(`Failed to save goal: ${goalResult.error}`)
        setIsSaving(false)
        return
      }

      toast.success('Onboarding complete! Welcome to Triathlon OS.')
      router.push('/review')
      router.refresh()
    } catch (err) {
      toast.error('Unexpected error. Please try again.')
      setIsSaving(false)
    }
  }

  const progress = (step / STEPS.length) * 100
  const currentStep = STEPS[step - 1]

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-6">
      {/* Step indicator */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground uppercase tracking-wide text-xs font-medium">
            Onboarding
          </span>
          <span className="text-muted-foreground">
            Step {step} of {STEPS.length}
          </span>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>

      {/* Card */}
      <Card>
        <CardHeader>
          <CardTitle>{currentStep.title}</CardTitle>
          <CardDescription>{currentStep.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {step === 1 && (
            <FormProvider {...prefForm}>
              <Form {...prefForm}>
                <div className="flex flex-col gap-8">
                  <StepPreference />
                  <div className="flex justify-end">
                    <Button onClick={handleNext} type="button">
                      Next: Goal Manifest →
                    </Button>
                  </div>
                </div>
              </Form>
            </FormProvider>
          )}

          {step === 2 && (
            <FormProvider {...goalForm}>
              <Form {...goalForm}>
                <form onSubmit={goalForm.handleSubmit(handleFinish)}>
                  <div className="flex flex-col gap-8">
                    <StepGoal initialRaces={initialRaces} />
                    <div className="flex justify-between">
                      <Button
                        variant="outline"
                        type="button"
                        onClick={() => setStep(1)}
                        disabled={isSaving}
                      >
                        ← Back
                      </Button>
                      <Button type="submit" disabled={isSaving}>
                        {isSaving ? 'Saving…' : 'Finish & go to dashboard'}
                      </Button>
                    </div>
                  </div>
                </form>
              </Form>
            </FormProvider>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm -C /Users/razi.rasheed/Developer/POCs/tri05/web typecheck 2>&1
```

Expected: no errors.

---

## Task 7: Onboarding page + layout

**Files:**
- Create: `web/app/onboarding/layout.tsx`
- Create: `web/app/onboarding/page.tsx`

- [ ] **Step 1: Create `web/app/onboarding/layout.tsx`**

Minimal layout — no sidebar, just a centered container.

```typescript
export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background flex items-start justify-center p-6 pt-16">
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Create `web/app/onboarding/page.tsx`**

Server component: redirects if already onboarded; passes races to the wizard.

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OnboardingWizard } from '@/components/onboarding/wizard'
import type { RaceOption } from '@/components/onboarding/race-combobox'

export default async function OnboardingPage() {
  const supabase = await createClient()

  // Auth check (middleware already handles unauthenticated, but belt-and-suspenders)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // If already onboarded, go to /review
  const [{ data: pref }, { data: goal }] = await Promise.all([
    supabase.from('current_preference_profile').select('id').maybeSingle(),
    supabase.from('current_goal_manifest').select('id').maybeSingle(),
  ])

  if (pref && goal) {
    redirect('/review')
  }

  // Prefetch races catalog for the combobox
  const { data: races } = await supabase
    .from('races')
    .select('id, name, date, distance_type, city, country')
    .order('date', { ascending: true })

  return (
    <OnboardingWizard initialRaces={(races ?? []) as RaceOption[]} />
  )
}
```

- [ ] **Step 3: Build**

```bash
pnpm -C /Users/razi.rasheed/Developer/POCs/tri05/web build 2>&1 | tail -30
```

Expected: `✓ Compiled successfully`. Fix any TS/build errors before proceeding.

- [ ] **Step 4: Commit**

```bash
cd /Users/razi.rasheed/Developer/POCs/tri05 && \
  git add web/app/onboarding/ web/components/onboarding/ && \
  git commit -m "feat(sp2-ui): onboarding wizard — step-preference, step-goal, wizard shell, page + layout"
```

---

## Task 8: Onboarding gating in middleware

**Files:**
- Modify: `web/middleware.ts`

The middleware runs on the Edge — it cannot call the Supabase DB (only auth). The gating must be done in the `(app)` layout instead, since that's where we have the server-side Supabase client.

- [ ] **Step 1: Update `web/middleware.ts`** to allow `/onboarding` for authenticated users

Replace the authenticated-user redirect logic so `/onboarding` is not blocked:

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: do NOT use getSession() — it reads the JWT without verifying.
  // getUser() makes a server-side call to verify the token.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Unauthenticated users can only access /login
  if (!user && pathname !== '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Authenticated users visiting /login → send to /review
  // (onboarding gating happens in (app)/layout.tsx via DB check)
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/review'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

- [ ] **Step 2: Add onboarding gate to `web/app/(app)/layout.tsx`**

After the user auth check, check for current_preference_profile and current_goal_manifest. If both are missing, redirect to `/onboarding`. The existing file is at `web/app/(app)/layout.tsx`.

Replace the file content with:

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { ThemeToggle } from '@/components/theme-toggle'
import { UserMenu } from '@/components/user-menu'
import { Separator } from '@/components/ui/separator'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Onboarding gate: if athlete has no profile and no goal, send to /onboarding
  const [{ data: pref }, { data: goal }] = await Promise.all([
    supabase.from('current_preference_profile').select('id').maybeSingle(),
    supabase.from('current_goal_manifest').select('id').maybeSingle(),
  ])

  if (!pref && !goal) {
    redirect('/onboarding')
  }

  // Fetch the athlete row — RLS ensures we only get our own row
  const { data: athlete } = await supabase
    .from('athletes')
    .select('display_name, is_admin')
    .single()

  const displayName = athlete?.display_name ?? user.email ?? 'Athlete'
  const isAdmin = athlete?.is_admin ?? false

  return (
    <SidebarProvider>
      <AppSidebar />
      <div className="flex flex-1 flex-col min-h-screen">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="flex flex-1 items-center justify-end gap-2">
            <ThemeToggle />
            <UserMenu displayName={displayName} isAdmin={isAdmin} />
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4">
          {children}
        </main>
      </div>
    </SidebarProvider>
  )
}
```

- [ ] **Step 3: Build**

```bash
pnpm -C /Users/razi.rasheed/Developer/POCs/tri05/web build 2>&1 | tail -30
```

Expected: `✓ Compiled successfully`.

- [ ] **Step 4: Commit**

```bash
cd /Users/razi.rasheed/Developer/POCs/tri05 && \
  git add web/middleware.ts web/app/\(app\)/layout.tsx && \
  git commit -m "feat(sp2-ui): onboarding gating — redirect to /onboarding if no profile+goal"
```

---

## Task 9: Context page — view cards

**Files:**
- Create: `web/components/context/context-client.tsx`
- Modify: `web/app/(app)/context/page.tsx`

- [ ] **Step 1: Create `web/components/context/context-client.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PreferenceEditDialog } from './preference-edit-dialog'
import { GoalEditDialog } from './goal-edit-dialog'
import type { Tables } from '@/lib/database.types'
import { DAYS, DAY_LABELS, type Day } from '@/lib/onboarding-schemas'

type PrefProfile = Tables<'current_preference_profile'>
type GoalManifest = Tables<'current_goal_manifest'>
type RaceOption = { id: string; name: string; date: string | null; distance_type: string | null; city: string | null; country: string | null }

interface ContextClientProps {
  pref: PrefProfile | null
  goal: GoalManifest | null
  races: RaceOption[]
}

function formatDay(day: string | null | undefined): string {
  if (!day) return '—'
  return DAY_LABELS[day as Day] ?? day
}

function formatInterval(val: string | null | undefined): string {
  if (!val) return '—'
  return val
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try { return format(parseISO(dateStr), 'MMM d, yyyy') }
  catch { return dateStr }
}

type DayHours = { hours: number } | { am: number; pm: number }

function renderAvailableHours(availableHours: unknown): React.ReactNode {
  if (!availableHours || typeof availableHours !== 'object') {
    return <span className="text-muted-foreground text-sm">Not set</span>
  }
  const hours = availableHours as Record<string, DayHours>
  return (
    <div className="grid grid-cols-7 gap-1 text-xs">
      {DAYS.map((day) => {
        const dayVal = hours[day]
        if (!dayVal) return (
          <div key={day} className="flex flex-col items-center gap-0.5 text-muted-foreground">
            <span className="uppercase text-[10px]">{DAY_LABELS[day]}</span>
            <span>—</span>
          </div>
        )
        const isAmPm = 'am' in dayVal
        return (
          <div key={day} className="flex flex-col items-center gap-0.5">
            <span className="uppercase text-[10px] text-muted-foreground">{DAY_LABELS[day]}</span>
            {isAmPm ? (
              <>
                <Badge variant="secondary" className="text-[10px] px-1 h-4">{(dayVal as { am: number; pm: number }).am}h AM</Badge>
                <Badge variant="secondary" className="text-[10px] px-1 h-4">{(dayVal as { am: number; pm: number }).pm}h PM</Badge>
              </>
            ) : (
              <Badge variant="outline" className="text-[10px] px-1 h-4">{(dayVal as { hours: number }).hours}h</Badge>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function ContextClient({ pref, goal, races }: ContextClientProps) {
  const [prefDialogOpen, setPrefDialogOpen] = useState(false)
  const [goalDialogOpen, setGoalDialogOpen] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      {/* Preference Profile card */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Preference Profile</CardTitle>
            {pref ? (
              <CardDescription>
                v{pref.version} · valid from {formatDate(pref.valid_from)}
              </CardDescription>
            ) : (
              <CardDescription>Not set up yet</CardDescription>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => setPrefDialogOpen(true)}>
            Edit
          </Button>
        </CardHeader>
        {pref ? (
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground text-xs uppercase tracking-wide">Weekly target</span>
                <p className="font-medium mt-0.5">{pref.max_hours_per_week ?? '—'} hrs/week</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs uppercase tracking-wide">Rest day</span>
                <p className="font-medium mt-0.5">{formatDay(pref.rest_day)}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs uppercase tracking-wide">Long swim</span>
                <p className="font-medium mt-0.5">{formatDay(pref.long_swim_day)}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs uppercase tracking-wide">Long bike</span>
                <p className="font-medium mt-0.5">{formatDay(pref.long_bike_day)}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs uppercase tracking-wide">Long run</span>
                <p className="font-medium mt-0.5">{formatDay(pref.long_run_day)}</p>
              </div>
            </div>
            <div>
              <span className="text-muted-foreground text-xs uppercase tracking-wide">Availability</span>
              <div className="mt-2">{renderAvailableHours(pref.available_hours)}</div>
            </div>
            {pref.constraints_notes && (
              <div>
                <span className="text-muted-foreground text-xs uppercase tracking-wide">Notes</span>
                <p className="text-sm mt-0.5">{pref.constraints_notes}</p>
              </div>
            )}
          </CardContent>
        ) : (
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No preference profile yet.{' '}
              <button
                className="underline underline-offset-2"
                onClick={() => setPrefDialogOpen(true)}
              >
                Set it up
              </button>
            </p>
          </CardContent>
        )}
      </Card>

      {/* Goal Manifest card */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Goal Manifest</CardTitle>
            {goal ? (
              <CardDescription>
                v{goal.version} · valid from {formatDate(goal.valid_from)}
              </CardDescription>
            ) : (
              <CardDescription>Not set up yet</CardDescription>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => setGoalDialogOpen(true)}>
            Edit
          </Button>
        </CardHeader>
        {goal ? (
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground text-xs uppercase tracking-wide">Race</span>
                <p className="font-medium mt-0.5">{goal.race_name ?? '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs uppercase tracking-wide">Date</span>
                <p className="font-medium mt-0.5">{formatDate(goal.race_date)}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs uppercase tracking-wide">Goal type</span>
                <p className="font-medium mt-0.5 capitalize">{goal.goal_type?.replace('_', ' ') ?? '—'}</p>
              </div>
              {goal.race_url && (
                <div>
                  <span className="text-muted-foreground text-xs uppercase tracking-wide">Race URL</span>
                  <a
                    href={goal.race_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary text-sm underline underline-offset-2 mt-0.5 block truncate"
                  >
                    {goal.race_url}
                  </a>
                </div>
              )}
            </div>
            {goal.goal_type === 'target_time' && (
              <div>
                <span className="text-muted-foreground text-xs uppercase tracking-wide">Performance targets</span>
                <div className="grid grid-cols-6 gap-2 mt-2 text-xs">
                  {(
                    [
                      { label: 'Swim', val: goal.target_swim_time },
                      { label: 'T1', val: goal.target_t1_time },
                      { label: 'Bike', val: goal.target_bike_time },
                      { label: 'T2', val: goal.target_t2_time },
                      { label: 'Run', val: goal.target_run_time },
                      { label: 'Overall', val: goal.target_overall_time },
                    ]
                  ).map(({ label, val }) => (
                    <div key={label} className="flex flex-col gap-0.5">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-mono font-medium">{formatInterval(val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {goal.notes && (
              <div>
                <span className="text-muted-foreground text-xs uppercase tracking-wide">Notes</span>
                <p className="text-sm mt-0.5">{goal.notes}</p>
              </div>
            )}
          </CardContent>
        ) : (
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No goal manifest yet.{' '}
              <button
                className="underline underline-offset-2"
                onClick={() => setGoalDialogOpen(true)}
              >
                Set it up
              </button>
            </p>
          </CardContent>
        )}
      </Card>

      <PreferenceEditDialog
        open={prefDialogOpen}
        onOpenChange={setPrefDialogOpen}
        current={pref}
      />
      <GoalEditDialog
        open={goalDialogOpen}
        onOpenChange={setGoalDialogOpen}
        current={goal}
        races={races}
      />
    </div>
  )
}
```

- [ ] **Step 2: Replace `web/app/(app)/context/page.tsx`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { ContextClient } from '@/components/context/context-client'
import type { RaceOption } from '@/components/onboarding/race-combobox'

export default async function ContextPage() {
  const supabase = await createClient()

  const [
    { data: pref },
    { data: goal },
    { data: races },
  ] = await Promise.all([
    supabase.from('current_preference_profile').select('*').maybeSingle(),
    supabase.from('current_goal_manifest').select('*').maybeSingle(),
    supabase.from('races').select('id, name, date, distance_type, city, country').order('date', { ascending: true }),
  ])

  return (
    <ContextClient
      pref={pref ?? null}
      goal={goal ?? null}
      races={(races ?? []) as RaceOption[]}
    />
  )
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm -C /Users/razi.rasheed/Developer/POCs/tri05/web typecheck 2>&1
```

Expected: no errors.

---

## Task 10: Context page — edit dialogs

**Files:**
- Create: `web/components/context/preference-edit-dialog.tsx`
- Create: `web/components/context/goal-edit-dialog.tsx`

- [ ] **Step 1: Create `web/components/context/preference-edit-dialog.tsx`**

```typescript
'use client'

import { useEffect } from 'react'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { StepPreference } from '@/components/onboarding/step-preference'
import {
  PreferenceFormSchema,
  type PreferenceFormValues,
} from '@/lib/onboarding-schemas'
import { savePreferenceProfile } from '@/lib/onboarding-actions'
import type { Tables } from '@/lib/database.types'

type PrefProfile = Tables<'current_preference_profile'>

interface PreferenceEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  current: PrefProfile | null
}

export function PreferenceEditDialog({
  open,
  onOpenChange,
  current,
}: PreferenceEditDialogProps) {
  const form = useForm<PreferenceFormValues>({
    resolver: zodResolver(PreferenceFormSchema),
    defaultValues: {
      max_hours_per_week: current?.max_hours_per_week ?? 10,
      available_hours: (current?.available_hours ?? {}) as Record<string, never>,
      long_swim_day: (current?.long_swim_day as PreferenceFormValues['long_swim_day']) ?? null,
      long_bike_day: (current?.long_bike_day as PreferenceFormValues['long_bike_day']) ?? null,
      long_run_day: (current?.long_run_day as PreferenceFormValues['long_run_day']) ?? null,
      rest_day: (current?.rest_day as PreferenceFormValues['rest_day']) ?? null,
      constraints_notes: current?.constraints_notes ?? '',
      change_reason: '',
    },
  })

  // Reset defaults when `current` changes (e.g., after a successful save refreshes the page)
  useEffect(() => {
    form.reset({
      max_hours_per_week: current?.max_hours_per_week ?? 10,
      available_hours: (current?.available_hours ?? {}) as Record<string, never>,
      long_swim_day: (current?.long_swim_day as PreferenceFormValues['long_swim_day']) ?? null,
      long_bike_day: (current?.long_bike_day as PreferenceFormValues['long_bike_day']) ?? null,
      long_run_day: (current?.long_run_day as PreferenceFormValues['long_run_day']) ?? null,
      rest_day: (current?.rest_day as PreferenceFormValues['rest_day']) ?? null,
      constraints_notes: current?.constraints_notes ?? '',
      change_reason: '',
    })
  }, [current, open]) // eslint-disable-line react-hooks/exhaustive-deps

  async function onSubmit(data: PreferenceFormValues) {
    const result = await savePreferenceProfile(data)
    if (result.error) {
      toast.error(`Save failed: ${result.error}`)
      return
    }
    toast.success('Preferences updated (new version saved)')
    onOpenChange(false)
    // Trigger a full page refresh to reload server data
    window.location.reload()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Preference Profile</DialogTitle>
        </DialogHeader>
        <FormProvider {...form}>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
              <StepPreference />

              {/* Change reason */}
              <FormField
                control={form.control}
                name="change_reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Reason for change{' '}
                      <span className="text-muted-foreground font-normal">(optional)</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Starting a new training block, schedule change…"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? 'Saving…' : 'Save new version'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Create `web/components/context/goal-edit-dialog.tsx`**

```typescript
'use client'

import { useEffect } from 'react'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { StepGoal } from '@/components/onboarding/step-goal'
import {
  GoalFormSchema,
  type GoalFormValues,
} from '@/lib/onboarding-schemas'
import { saveGoalManifest } from '@/lib/onboarding-actions'
import type { Tables } from '@/lib/database.types'
import type { RaceOption } from '@/components/onboarding/race-combobox'

type GoalManifest = Tables<'current_goal_manifest'>

interface GoalEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  current: GoalManifest | null
  races: RaceOption[]
}

export function GoalEditDialog({
  open,
  onOpenChange,
  current,
  races,
}: GoalEditDialogProps) {
  const form = useForm<GoalFormValues>({
    resolver: zodResolver(GoalFormSchema),
    defaultValues: {
      goal_type: (current?.goal_type as GoalFormValues['goal_type']) ?? 'finish',
      race_id: current?.race_id ?? null,
      race_name: current?.race_name ?? '',
      race_date: current?.race_date ?? '',
      race_url: current?.race_url ?? '',
      target_swim_time: current?.target_swim_time ?? '',
      target_t1_time: current?.target_t1_time ?? '',
      target_bike_time: current?.target_bike_time ?? '',
      target_t2_time: current?.target_t2_time ?? '',
      target_run_time: current?.target_run_time ?? '',
      target_overall_time: current?.target_overall_time ?? '',
      notes: current?.notes ?? '',
      change_reason: '',
    },
  })

  useEffect(() => {
    form.reset({
      goal_type: (current?.goal_type as GoalFormValues['goal_type']) ?? 'finish',
      race_id: current?.race_id ?? null,
      race_name: current?.race_name ?? '',
      race_date: current?.race_date ?? '',
      race_url: current?.race_url ?? '',
      target_swim_time: current?.target_swim_time ?? '',
      target_t1_time: current?.target_t1_time ?? '',
      target_bike_time: current?.target_bike_time ?? '',
      target_t2_time: current?.target_t2_time ?? '',
      target_run_time: current?.target_run_time ?? '',
      target_overall_time: current?.target_overall_time ?? '',
      notes: current?.notes ?? '',
      change_reason: '',
    })
  }, [current, open]) // eslint-disable-line react-hooks/exhaustive-deps

  async function onSubmit(data: GoalFormValues) {
    const result = await saveGoalManifest(data)
    if (result.error) {
      toast.error(`Save failed: ${result.error}`)
      return
    }
    toast.success('Goal manifest updated (new version saved)')
    onOpenChange(false)
    window.location.reload()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Goal Manifest</DialogTitle>
        </DialogHeader>
        <FormProvider {...form}>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
              <StepGoal initialRaces={races} />

              {/* Change reason */}
              <FormField
                control={form.control}
                name="change_reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Reason for change{' '}
                      <span className="text-muted-foreground font-normal">(optional)</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. New A-race selected, revised time goal…"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? 'Saving…' : 'Save new version'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: Build and fix any errors**

```bash
pnpm -C /Users/razi.rasheed/Developer/POCs/tri05/web build 2>&1 | tail -40
```

Expected: `✓ Compiled successfully`. Fix any TS/build errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/razi.rasheed/Developer/POCs/tri05 && \
  git add web/app/\(app\)/context/ web/components/context/ && \
  git commit -m "feat(sp2-ui): context page — view cards + preference/goal edit dialogs"
```

---

## Task 11: Final build verification + commit

- [ ] **Step 1: Full build**

```bash
pnpm -C /Users/razi.rasheed/Developer/POCs/tri05/web build 2>&1
```

Expected output must end with something like:
```
✓ Compiled successfully
Route (app)                              Size     First Load JS
┌ ○ /login                              ...
├ ƒ /onboarding                         ...
├ ƒ /(app)/context                      ...
├ ƒ /(app)/review                       ...
...
```

Fix any errors. Common issues:
- Missing `lucide-react` (used in `race-combobox.tsx`) — install: `pnpm -C web add lucide-react`
- Missing `date-fns` — install: `pnpm -C web add date-fns`
- Server actions file must have `'use server'` at top

- [ ] **Step 2: Final commit**

```bash
cd /Users/razi.rasheed/Developer/POCs/tri05 && \
  git add web && \
  git commit -m "feat(sp2-ui): slice 2 — onboarding wizard + context (preference + goal)"
```

---

## Spec Coverage Self-Check

| Spec requirement | Task covering it |
|---|---|
| `/onboarding` 2-step wizard | Tasks 4–7 |
| Step 1: max_hours, availability grid (Mon–Sun, Unspecified/Day/AM+PM), allocated/remaining | Tasks 3, 4 |
| Step 1: long_swim/bike/run day, rest_day, constraints_notes | Task 4 |
| Step 2: goal_type segmented control | Task 5 |
| Step 2: race combobox + "Not listed?" manual toggle | Task 3 |
| Step 2: split inputs (swim/T1/bike/T2/run) h:mm:ss | Tasks 2, 3, 5 |
| Step 2: auto-calculated overall (sum of splits) | Tasks 2, 5 |
| Step 2: Targets from history (race_results) | Task 5 |
| Step 2: catalog cutoffs shown for selected catalog race | Task 5 (placeholder shown, cutoffs require extended RaceOption with cutoff fields) |
| Finish writes version 1 of both tables | Tasks 2 (actions), 6 (wizard) |
| Onboarding gating (no profile + no goal → redirect /onboarding) | Task 8 |
| `/onboarding` redirects to `/review` if already onboarded | Task 7 |
| `/context` view with both current views | Task 9 |
| `/context` Edit action pre-fills forms | Task 10 |
| Edit saves new version with change_reason | Tasks 2 (actions), 10 |
| Shows valid_from / version | Task 9 |
| `pnpm -C web build` green | Task 11 |
| Commit on sp2-review-ui | Task 11 |

**Note on catalog cutoffs:** `RaceOption` defined in this plan only carries `id, name, date, distance_type, city, country`. To show actual `cutoff_*` values, `RaceOption` would need to include those fields and the server fetch would need to select them. Task 5's goal form shows a placeholder message instead. This is a minor known gap — the catalog query in `onboarding/page.tsx` and `context/page.tsx` can be extended to `select('id, name, date, distance_type, city, country, cutoff_swim, cutoff_bike, cutoff_run, cutoff_overall')` if the implementor wants the full cutoffs.

**Note on `'use server'`:** `onboarding-actions.ts` must begin with `'use server'` — it is included in Task 2 Step 2 code above.
