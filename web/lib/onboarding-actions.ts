'use server'

import { createClient } from '@/lib/supabase/server'
import type { PreferenceFormValues, GoalFormValues } from '@/lib/onboarding-schemas'

export async function savePreferenceProfile(
  data: PreferenceFormValues,
): Promise<{ error: string | null }> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Not authenticated' }

  // Compute next version
  const { data: existing } = await supabase
    .from('preference_profiles')
    .select('version')
    .order('version', { ascending: false })
    .limit(1)
    .single()

  const nextVersion = (existing?.version ?? 0) + 1

  const { error } = await supabase.from('preference_profiles').insert({
    athlete_id: user.id,
    version: nextVersion,
    valid_from: new Date().toISOString(),
    max_hours_per_week: data.max_hours_per_week,
    available_hours: data.available_hours,
    long_swim_day: data.long_swim_day ?? null,
    long_bike_day: data.long_bike_day ?? null,
    long_run_day: data.long_run_day ?? null,
    rest_day: data.rest_day ?? null,
    constraints_notes: data.constraints_notes ?? null,
    change_reason: data.change_reason ?? null,
  })

  if (error) return { error: error.message }
  return { error: null }
}

export async function saveGoalManifest(
  data: GoalFormValues,
): Promise<{ error: string | null }> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Not authenticated' }

  // Compute next version
  const { data: existing } = await supabase
    .from('goal_manifests')
    .select('version')
    .order('version', { ascending: false })
    .limit(1)
    .single()

  const nextVersion = (existing?.version ?? 0) + 1

  const raceUrl = data.race_url && data.race_url.trim() !== '' ? data.race_url : null

  const { error } = await supabase.from('goal_manifests').insert({
    athlete_id: user.id,
    version: nextVersion,
    valid_from: new Date().toISOString(),
    goal_type: data.goal_type,
    race_id: data.race_id ?? null,
    race_name: data.race_name,
    race_date: data.race_date,
    race_url: raceUrl,
    target_swim_time: data.target_swim_time ?? null,
    target_t1_time: data.target_t1_time ?? null,
    target_bike_time: data.target_bike_time ?? null,
    target_t2_time: data.target_t2_time ?? null,
    target_run_time: data.target_run_time ?? null,
    target_overall_time: data.target_overall_time ?? null,
    notes: data.notes ?? null,
    change_reason: data.change_reason ?? null,
  })

  if (error) return { error: error.message }
  return { error: null }
}
