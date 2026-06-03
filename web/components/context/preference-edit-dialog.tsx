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
      available_hours: (current?.available_hours ?? {}) as Record<string, { hours: number } | { am: number; pm: number }>,
      long_swim_day: (current?.long_swim_day as PreferenceFormValues['long_swim_day']) ?? null,
      long_bike_day: (current?.long_bike_day as PreferenceFormValues['long_bike_day']) ?? null,
      long_run_day: (current?.long_run_day as PreferenceFormValues['long_run_day']) ?? null,
      rest_day: (current?.rest_day as PreferenceFormValues['rest_day']) ?? null,
      constraints_notes: current?.constraints_notes ?? '',
      change_reason: '',
    },
  })

  // Reset defaults when `current` or dialog open state changes
  useEffect(() => {
    form.reset({
      max_hours_per_week: current?.max_hours_per_week ?? 10,
      available_hours: (current?.available_hours ?? {}) as Record<string, { hours: number } | { am: number; pm: number }>,
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
