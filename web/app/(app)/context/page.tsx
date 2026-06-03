import { createClient } from '@/lib/supabase/server'
import { ContextClient } from '@/components/context/context-client'
import type { RaceOption } from '@/components/onboarding/race-combobox'

export default async function ContextPage() {
  const supabase = await createClient()

  const [
    { data: pref },
    { data: goal },
    { data: races },
  ] = await Promise.all([
    supabase.from('current_preference_profile').select('*').maybeSingle(),
    supabase.from('current_goal_manifest').select('*').maybeSingle(),
    supabase.from('races').select('id, name, date, distance_type, city, country').order('date', { ascending: true }),
  ])

  return (
    <ContextClient
      pref={pref ?? null}
      goal={goal ?? null}
      races={(races ?? []) as RaceOption[]}
    />
  )
}
