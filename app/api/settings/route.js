import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { supabaseAdmin } from '@/lib/supabase'

const DEFAULTS = {
  roadmap: '',
  peak_hours: '9-11am, 3-5pm',
  energy_default: 'medium',
  adhd_aware: false,
  adhd_patterns: [],
  known_blockers: [],
  financial_goals: [],
  relationship_tiers: {},
  // life_areas is a user-defined array: [{ key, label, emoji, blocks }]
  life_areas: [],
  weekly_time_budget: {},
  coo_notes: '',
  notification_prefs: {
    morning_brief: true,
    midday_checkin: true,
    afternoon_checkin: true,
    evening_retro: true,
    urgent_alerts: true,
    weekly_review: true,
    birthday_alerts: true,
  },
  onboarding_complete: false,
}

export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.email
  const { data } = await supabaseAdmin
    .from('user_context')
    .select('*')
    .eq('user_id', userId)
    .single()

  return Response.json({ settings: { ...DEFAULTS, ...data } })
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.email
  const body = await req.json()

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
  return Response.json({ settings: data })
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

  const merged = {
    ...(current || DEFAULTS),
    ...updates,
    // Arrays merge rather than replace
    adhd_patterns: [...new Set([...(current?.adhd_patterns || []), ...(updates.adhd_patterns || [])])],
    known_blockers: [...new Set([...(current?.known_blockers || []), ...(updates.known_blockers || [])])],
    updated_at: new Date().toISOString(),
  }

  await supabaseAdmin.from('user_context').upsert({ user_id: userId, ...merged }, { onConflict: 'user_id' })
  return Response.json({ ok: true })
}
