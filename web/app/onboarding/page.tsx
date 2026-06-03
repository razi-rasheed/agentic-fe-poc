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
