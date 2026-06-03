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
    } catch {
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
