import { z } from 'zod/v3'

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

export const AvailableHoursSchema = z.record(z.string(), DayHoursSchema)

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

// Interval field: validate format only, store as raw string in the form.
// Transformation (null coercion + normalization) happens in the action.
export const IntervalStringSchema = z
  .string()
  .optional()
  .nullable()
  .refine(
    (val) => {
      if (!val || val.trim() === '') return true
      return /^\d{1,2}:\d{2}(:\d{2})?$/.test(val.trim())
    },
    { message: 'Use h:mm:ss format' },
  )

// ----- Preference Profile -----

export const PreferenceFormSchema = z.object({
  max_hours_per_week: z.coerce
    .number()
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

// Utility: normalise an interval string from the form field to Postgres-compatible format
// Returns null for empty string.
export function normaliseInterval(val: string | null | undefined): string | null {
  if (!val || val.trim() === '') return null
  const trimmed = val.trim()
  const parts = trimmed.split(':')
  if (parts.length === 2) return `0:${parts[0]}:${parts[1]}`
  return trimmed
}

// Utility: sum interval strings to compute overall
// Intervals are "h:mm:ss". Returns null if all segments are empty/null.
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
