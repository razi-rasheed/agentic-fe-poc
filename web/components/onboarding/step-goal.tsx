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
    const autoSum = sumSplits(
      typeof swim === 'string' ? swim : null,
      typeof t1 === 'string' ? t1 : null,
      typeof bike === 'string' ? bike : null,
      typeof t2 === 'string' ? t2 : null,
      typeof run === 'string' ? run : null,
    )
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
                    value={typeof field.value === 'string' ? field.value : ''}
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
                  value={typeof field.value === 'string' ? field.value : ''}
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
                  { label: 'Swim' },
                  { label: 'Bike' },
                  { label: 'Run' },
                  { label: 'Overall' },
                ]
              ).map(({ label }) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-mono font-medium">—</span>
                </div>
              ))}
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
            No past race results yet. They&apos;ll appear here once you add them.
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
