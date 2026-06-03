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
import type { RaceOption } from '@/components/onboarding/race-combobox'

type PrefProfile = Tables<'current_preference_profile'>
type GoalManifest = Tables<'current_goal_manifest'>

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
  if (!availableHours || typeof availableHours !== 'object' || Array.isArray(availableHours)) {
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
                v{pref.version} &middot; valid from {formatDate(pref.valid_from)}
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
                v{goal.version} &middot; valid from {formatDate(goal.valid_from)}
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
