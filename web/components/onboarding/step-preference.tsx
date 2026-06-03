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
