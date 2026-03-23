import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createGoogleTask, completeGoogleTask, getGoogleTasks } from '@/lib/google'
export const dynamic = 'force-dynamic'

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

// GET /api/tasks — fetch today's tasks
export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.email
  const date = new URL(req.url).searchParams.get('date') || todayKey()

  const { data, error } = await supabaseAdmin
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .order('created_at', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ tasks: data })
}

// POST /api/tasks — create task + sync to Google Tasks
export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.email
  const body = await req.json()
  const task = {
    user_id: userId,
    name: body.name,
    q: body.q || 'do',
    cat: body.cat || 'admin',
    blocks: body.blocks || 2,
    who: body.who || 'me',
    notes: body.notes || '',
    done: false,
    date: body.date || todayKey(),
    source: body.source || 'manual',
    google_task_id: null,
  }

  const { data, error } = await supabaseAdmin.from('tasks').insert(task).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Sync to Google Tasks async (don't block response)
  if (session.accessToken) {
    try {
      const { listId } = await getGoogleTasks(session.accessToken, session.refreshToken)
      if (listId) {
        await createGoogleTask(session.accessToken, session.refreshToken, listId, task)
      }
    } catch {}
  }

  return Response.json({ task: data })
}

// PATCH /api/tasks — update (toggle done, move quadrant)
export async function PATCH(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.email
  const body = await req.json()
  const { id, ...updates } = body

  // Fetch existing task to detect done transition
  const { data: existing } = await supabaseAdmin
    .from('tasks').select('done,blocks,q').eq('id', id).eq('user_id', userId).single()

  const { data, error } = await supabaseAdmin
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Award XP + update streak when a task is newly completed (fire-and-forget)
  const newlyDone = updates.done === true && existing && !existing.done
  let xpEvent = null
  if (newlyDone) {
    xpEvent = await awardXP(userId, existing.blocks || 2).catch(() => null)
  }

  // If marking done, sync to Google Tasks
  if (updates.done && data.google_task_id && session.accessToken) {
    try {
      const { listId } = await getGoogleTasks(session.accessToken, session.refreshToken)
      if (listId && data.google_task_id) {
        await completeGoogleTask(session.accessToken, session.refreshToken, listId, data.google_task_id)
      }
    } catch {}
  }

  return Response.json({ task: data, xp: xpEvent })
}

/**
 * Award XP to the user's tree on task completion.
 * Returns { h_gained, w_gained, streak, multiplier, tier_up } or null.
 */
async function awardXP(userId, blocks) {
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

  const [{ data: sp }, { data: nextTier }] = await Promise.all([
    supabaseAdmin.from('tree_species').select('*').eq('user_id', userId).maybeSingle(),
    supabaseAdmin.from('tree_species')
      .select('current_tier')
      .eq('user_id', userId)
      .maybeSingle()
      .then(async r => {
        if (!r.data) return { data: null }
        return supabaseAdmin
          .from('tree_species_catalog')
          .select('tier,name,slug,emoji,height_ft,width_ft')
          .gt('tier', r.data.current_tier || 1)
          .order('tier', { ascending: true })
          .limit(1)
          .maybeSingle()
      }),
  ])

  if (!sp) return null

  // ── Streak calculation ─────────────────────────────────────────────────────
  const last = sp.last_activity_date
  let streak = sp.current_streak || 0
  if (last === today) {
    // Already recorded today — don't extend streak again
    streak = streak // unchanged
  } else if (last === yesterday) {
    streak += 1
  } else {
    streak = 1 // broken or first day
  }

  // Streak bonus: +5% per day, capped at 2.5× at 30 days
  const multiplier = Math.round(Math.min(2.5, 1.0 + streak * 0.05) * 100) / 100

  // ── XP calculation ─────────────────────────────────────────────────────────
  const hBase = blocks * 10
  const wBase = blocks * 5
  const hGained = Math.round(hBase * multiplier)
  const wGained = Math.round(wBase * multiplier)

  const newHXP = (sp.height_xp || 0) + hGained
  const newWXP = (sp.width_xp || 0) + wGained

  // ── Tier advancement ───────────────────────────────────────────────────────
  let tierUp = null
  let newTier = sp.current_tier || 1
  let newSlug = sp.species_slug
  let newName = sp.species_name
  let newEmoji = sp.species_emoji

  if (nextTier) {
    const threshH = Math.round((nextTier.height_ft || 0) * 60)
    const threshW = Math.round((nextTier.width_ft || 0) * 180)
    if (newHXP >= threshH && newWXP >= threshW) {
      tierUp = { from: newTier, to: nextTier.tier, species: nextTier.name, emoji: nextTier.emoji }
      newTier = nextTier.tier
      newSlug = nextTier.slug
      newName = nextTier.name
      newEmoji = nextTier.emoji
    }
  }

  // ── Persist ────────────────────────────────────────────────────────────────
  await supabaseAdmin.from('tree_species').update({
    height_xp: newHXP,
    width_xp: newWXP,
    current_tier: newTier,
    species_slug: newSlug,
    species_name: newName,
    species_emoji: newEmoji,
    current_streak: streak,
    longest_streak: Math.max(sp.longest_streak || 0, streak),
    last_activity_date: today,
  }).eq('user_id', userId)

  return { h_gained: hGained, w_gained: wGained, streak, multiplier, tier_up: tierUp }
}

// DELETE /api/tasks
export async function DELETE(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  await supabaseAdmin.from('tasks').delete().eq('id', id).eq('user_id', session.user.email)
  return Response.json({ ok: true })
}
