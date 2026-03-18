import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { supabaseAdmin } from '@/lib/supabase'
import { generateCheckin, generateEveningRetro, generateWeeklyReview, extractAndStorePatterns } from '@/lib/coo'

function todayKey() { return new Date().toISOString().slice(0, 10) }

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.email
  const { type, userMessage } = await req.json()

  const [tasks, schedule, userCtx] = await Promise.all([
    supabaseAdmin.from('tasks').select('*').eq('user_id', userId).eq('date', todayKey()).then(r => r.data || []),
    supabaseAdmin.from('schedules').select('*').eq('user_id', userId).eq('date', todayKey()).single().then(r => r.data),
    supabaseAdmin.from('user_context').select('*').eq('user_id', userId).single().then(r => r.data),
  ])

  const roadmap = userCtx?.roadmap || 'No roadmap set yet'
  let result

  if (type === 'midday' || type === 'afternoon') {
    result = await generateCheckin({ type, tasks, schedule, userMessage })
  } else if (type === 'evening') {
    result = await generateEveningRetro({ tasks, schedule, roadmap })

    // Store retro
    await supabaseAdmin.from('retros').upsert(
      { user_id: userId, date: todayKey(), data: result, created_at: new Date().toISOString() },
      { onConflict: 'user_id,date' }
    )

    // COO memory write-back — extract patterns and store
    const patterns = await extractAndStorePatterns({ retroResult: result, userId })
    if (patterns) {
      const existing = userCtx?.coo_notes || ''
      const newNote = patterns.coo_note || ''
      const updatedNote = newNote && !existing.includes(newNote)
        ? (existing ? existing + ' ' + newNote : newNote)
        : existing

      await fetch(`${process.env.NEXTAUTH_URL}/api/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-internal': process.env.CRON_SECRET },
        body: JSON.stringify({
          adhd_patterns: patterns.adhd_patterns || [],
          known_blockers: patterns.known_blockers || [],
          coo_notes: updatedNote,
        }),
      }).catch(() => {})
    }
  } else if (type === 'weekly') {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const { data: weekTasks } = await supabaseAdmin.from('tasks').select('*').eq('user_id', userId).gte('date', weekAgo)
    result = await generateWeeklyReview({ weekTasks: weekTasks || [], roadmap })
  }

  return Response.json({ result })
}
