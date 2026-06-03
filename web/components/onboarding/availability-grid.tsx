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
      const pmVal = current && 'pm' in current ? (current as { am: number; pm: number }).pm : 0
      next[day] = { am: num, pm: pmVal }
    } else {
      const amVal = current && 'am' in current ? (current as { am: number; pm: number }).am : 0
      next[day] = { am: amVal, pm: num }
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
                  value={dayVal && 'hours' in dayVal ? (dayVal as { hours: number }).hours : ''}
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
                    value={dayVal && 'am' in dayVal ? (dayVal as { am: number; pm: number }).am : ''}
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
                    value={dayVal && 'pm' in dayVal ? (dayVal as { am: number; pm: number }).pm : ''}
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
