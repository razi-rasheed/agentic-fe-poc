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
