import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { structureGoal, proposeInitialGoals } from '@/lib/coo'
import { getImportantEmails } from '@/lib/google'
export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.email
  const { data: ctx } = await supabaseAdmin.from('user_context').select('goals').eq('user_id', userId).maybeSingle()
  return Response.json({ goals: ctx?.goals || [] })
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.email

  const body = await req.json()

  // ── Auto-seed goals from profile + email context ──────────────────────────
  if (body.action === 'auto_seed') {
    const { data: ctx } = await supabaseAdmin
      .from('user_context').select('goals, outline, roadmap, life_areas')
      .eq('user_id', userId).maybeSingle()

    const existing = (ctx?.goals || []).filter(g => g.status !== 'archived')
    const lifeAreas = ctx?.life_areas || []

    // Find which life area keys already have at least one active goal
    const coveredCategories = new Set(existing.map(g => g.category?.toLowerCase()))
    const lifeAreaKeys = lifeAreas.map(a => (a.key || a.label || '').toLowerCase())
    const uncoveredAreas = lifeAreas.filter(a => {
      const key = (a.key || a.label || '').toLowerCase()
      return !coveredCategories.has(key)
    })

    // All life areas covered — nothing to seed
    if (existing.length > 0 && uncoveredAreas.length === 0) {
      return Response.json({ goals: ctx.goals, skipped: true })
    }

    // Pull email signals if Google is connected
    let emailContext = ''
    if (session.accessToken) {
      try {
        const emails = await getImportantEmails(session.accessToken, session.refreshToken)
        emailContext = emails.slice(0, 8).map(e => `[${e.category}] ${e.subject} — from ${e.from}`).join('\n')
      } catch {}
    }

    // If filling gaps, only request goals for uncovered areas
    const areasToSeed = uncoveredAreas.length > 0 && existing.length > 0 ? uncoveredAreas : lifeAreas
    const existingGoalCategories = existing.length > 0 ? [...coveredCategories] : []

    const proposed = await proposeInitialGoals({
      outline: ctx?.outline || '',
      roadmap: ctx?.roadmap || '',
      lifeAreas: areasToSeed,
      emailContext,
      existingGoalCategories,
    })
    if (!proposed.length) return Response.json({ goals: existing, seeded: false })

    // Deduplicate by title — never add a goal whose title closely matches an existing one
    const existingTitles = new Set(existing.map(g => g.title.toLowerCase().trim()))
    const deduped = proposed.filter(g => {
      const t = (g.title || '').toLowerCase().trim()
      if (!t) return false
      // Exact or near-exact match
      if (existingTitles.has(t)) return false
      // Substring containment check (e.g. "Land a job" vs "Land a data science job")
      for (const et of existingTitles) {
        if (et.includes(t) || t.includes(et)) return false
      }
      return true
    })
    if (!deduped.length) return Response.json({ goals: existing, seeded: false })

    const newGoals = deduped.map((g, i) => ({
      id: `goal_${Date.now()}_${i}`,
      title: g.title,
      description: g.description || '',
      category: g.category || 'personal',
      emoji: g.emoji || '🎯',
      status: 'active',
      created_at: new Date().toISOString().slice(0, 10),
      coo_note: 'Seeded by COO from your profile and context — edit freely.',
      milestones: (g.milestones || []).map((m, j) => ({ ...m, id: m.id || `m${j + 1}`, label: m.label || m.text || '' })),
      metrics: g.metrics || [],
      suggested_agents: g.suggested_agents || [],
      custom_data: {},
    }))

    const goals = [...existing, ...newGoals]
    await supabaseAdmin.from('user_context').update({ goals }).eq('user_id', userId)
    return Response.json({ goals, seeded: true, added: newGoals.length })
  }

  // ── Manual goal creation ──────────────────────────────────────────────────
  const { title, description, target_date } = body
  if (!title) return Response.json({ error: 'title required' }, { status: 400 })

  const { data: ctx } = await supabaseAdmin
    .from('user_context').select('goals, outline, roadmap, life_areas, adhd_aware')
    .eq('user_id', userId).maybeSingle()

  const structure = await structureGoal({ title, description, target_date, userCtx: ctx })

  const newGoal = {
    id: `goal_${Date.now()}`,
    title,
    description: description || '',
    target_date: target_date || null,
    status: 'active',
    created_at: new Date().toISOString().slice(0, 10),
    emoji: structure.emoji || '🎯',
    category: structure.category || 'career',
    coo_note: structure.coo_note || '',
    milestones: (structure.milestones || []).map((m, i) => ({ ...m, id: m.id || `m${i + 1}` })),
    metrics: structure.metrics || [],
    suggested_agents: structure.suggested_agents || [],
    custom_data: {},
  }

  const goals = [...(ctx?.goals || []), newGoal]
  await supabaseAdmin.from('user_context').update({ goals }).eq('user_id', userId)
  return Response.json({ goal: newGoal, goals })
}

export async function PATCH(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.email

  const body = await req.json()
  const { id, action } = body

  const { data: ctx } = await supabaseAdmin.from('user_context').select('goals').eq('user_id', userId).maybeSingle()
  let goals = ctx?.goals || []

  if (action === 'delete') {
    // Soft-delete: archive so the goal is excluded from re-seeding but not lost
    goals = goals.map(g => g.id !== id ? g : { ...g, status: 'archived', archived_at: new Date().toISOString().slice(0, 10) })
  } else if (action === 'toggle_milestone') {
    goals = goals.map(g => g.id !== id ? g : {
      ...g,
      milestones: g.milestones.map(m => m.id === body.milestone_id ? { ...m, done: !m.done } : m),
    })
  } else if (action === 'update_metric') {
    goals = goals.map(g => g.id !== id ? g : {
      ...g,
      metrics: g.metrics.map(m => m.key === body.metric_key ? { ...m, value: body.value } : m),
    })
  } else if (action === 'set_status') {
    goals = goals.map(g => g.id !== id ? g : { ...g, status: body.status, ...(body.status === 'met' ? { met_at: new Date().toISOString().slice(0, 10) } : {}) })
  } else if (action === 'dismiss_suggestion') {
    goals = goals.map(g => g.id !== id ? g : {
      ...g,
      suggested_agents: (g.suggested_agents || []).filter(a => a.name !== body.agent_name),
    })
  } else if (action === 'update') {
    goals = goals.map(g => g.id !== id ? g : { ...g, ...body.updates })
  }

  await supabaseAdmin.from('user_context').update({ goals }).eq('user_id', userId)
  return Response.json({ goals })
}
