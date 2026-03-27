import { getServerSession } from 'next-auth'
import { writeContextFile } from '@/lib/context-storage'
import { getFeatureFlags } from '@/lib/integrations'
import { authOptions } from '../auth/[...nextauth]/route'
import { supabaseAdmin } from '@/lib/supabase-admin'
export const dynamic = 'force-dynamic'

const DEFAULTS = {
  roadmap: '',
  peak_hours: 'standard',
  rhythm_notes: '',
  energy_default: 'medium',
  adhd_aware: false,
  adhd_patterns: [],
  known_blockers: [],
  // COO-maintained: domain-specific terms for Deepgram keyterm prompting
  voice_keyterms: [],
  financial_goals: [],
  relationship_tiers: {},
  // life_areas is a user-defined array: [{ key, label, emoji, blocks }]
  life_areas: [],
  weekly_time_budget: {},
  coo_notes: '',
  relationship_seeds: '',
  background_proposals: [],
  notification_prefs: {
    morning_brief:           true,  morning_brief_time:    '07:30',
    midday_checkin:          true,  midday_checkin_time:   '12:00',
    afternoon_checkin:       true,  afternoon_checkin_time:'16:00',
    evening_retro:           true,  evening_retro_time:    '19:00',
    urgent_alerts:           true,
    weekly_review:           true,
    birthday_alerts:         true,
  },
  onboarding_complete: false,
  looking_for_jobs: true,
  show_health_snapshot: false,
  health_baselines: {},
  // User-provided LLM keys — stored per user, never logged
  gemini_api_key: null,
  anthropic_api_key: null,
  /** sticky = one bg image until next evolution. rotate_load = random from tree_gallery_by_slug[current species slug] */
  tree_bg_mode: 'sticky',
  /** @deprecated rotation now uses tree_gallery_by_slug */
  tree_favorites_by_tier: {},
  /** { "bristlecone": ["bristlecone","bristlecone-dusk"], ... } — image keys = /public/species/{key}.jpg, same species only */
  tree_gallery_by_slug: {},
}

export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.email
  const { data, error } = await supabaseAdmin
    .from('user_context')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('settings GET user_context', error)
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ settings: { ...DEFAULTS, ...(data || {}) } })
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.email
  const { goals: _excludeGoals, ...body } = await req.json()

  const { data, error } = await supabaseAdmin
    .from('user_context')
    .upsert({
      user_id: userId,
      ...body,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Write context file to cloud storage (non-blocking — don't fail the request)
  try {
    const flags = getFeatureFlags(data.integration_tier, data.addons)
    const tokenRow = await supabaseAdmin
      .from('user_tokens').select('access_token').eq('user_id', userId).single()
      .then(r => r.data)
    if (tokenRow?.access_token) {
      writeContextFile(flags.contextStorage, tokenRow.access_token, data)
        .catch(() => {}) // fire-and-forget
    }
  } catch { /* non-fatal */ }

  return Response.json({ settings: data })
}

// DELETE — full reset: wipes all user data, keeps account + connectors
export async function DELETE(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.email

  await Promise.all([
    // Reset user_context to bare minimum
    supabaseAdmin.from('user_context').upsert({
      user_id: userId,
      onboarding_complete: false,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' }),
    // Wipe activity data
    supabaseAdmin.from('tasks').delete().eq('user_id', userId),
    supabaseAdmin.from('schedules').delete().eq('user_id', userId),
    supabaseAdmin.from('agents').delete().eq('user_id', userId),
    // Wipe tree data
    supabaseAdmin.from('tree_branches').delete().eq('user_id', userId),
    supabaseAdmin.from('tree_rings').delete().eq('user_id', userId),
    supabaseAdmin.from('tree_roots').delete().eq('user_id', userId),
    supabaseAdmin.from('tree_relationships').delete().eq('user_id', userId),
    supabaseAdmin.from('tree_legacies').delete().eq('user_id', userId),
    supabaseAdmin.from('tree_species').delete().eq('user_id', userId),
  ])

  return Response.json({ ok: true })
}

// PATCH — partial update (used by COO to write back patterns, notes)
export async function PATCH(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.email
  const updates = await req.json()

  // Get current
  const { data: current } = await supabaseAdmin
    .from('user_context')
    .select('*')
    .eq('user_id', userId)
    .single()

  // goals is owned exclusively by /api/goals — never let a settings write overwrite it
  const { goals: _excludeGoals, ...safeUpdates } = updates

  const merged = {
    ...(current || DEFAULTS),
    ...safeUpdates,
    // goals must come from current only — never from the update payload
    goals: current?.goals ?? [],
    // Arrays merge rather than replace
    adhd_patterns:  [...new Set([...(current?.adhd_patterns  || []), ...(safeUpdates.adhd_patterns  || [])])],
    known_blockers: [...new Set([...(current?.known_blockers || []), ...(safeUpdates.known_blockers || [])])],
    voice_keyterms: [...new Set([...(current?.voice_keyterms || []), ...(safeUpdates.voice_keyterms || [])])],
    updated_at: new Date().toISOString(),
  }

  await supabaseAdmin.from('user_context').upsert({ user_id: userId, ...merged }, { onConflict: 'user_id' })
  return Response.json({ ok: true })
}
