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
