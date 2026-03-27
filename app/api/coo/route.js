import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateCheckin, generateEveningRetro, generateWeeklyReview, extractAndStorePatterns, generateChatResponse, generateDelegationPlan, parseDoneList, generateWeeklyFeedback, generateChatAutocomplete } from '@/lib/coo'
import { getImportantEmails, getTodayEvents } from '@/lib/google'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

function todayKey() { return new Date().toISOString().slice(0, 10) }

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.email
  const body = await req.json()
  const { type, userMessage, task: delegateTask, goals: delegateGoals, digestId, feedback } = body

  const [tasks, schedule, userCtx] = await Promise.all([
    supabaseAdmin.from('tasks').select('*').eq('user_id', userId).eq('date', todayKey()).then(r => r.data || []),
    supabaseAdmin.from('schedules').select('*').eq('user_id', userId).eq('date', todayKey()).maybeSingle().then(r => r.data),
    supabaseAdmin.from('user_context').select('*').eq('user_id', userId).maybeSingle().then(r => r.data),
  ])
  const llmKeys = {
    anthropicKey: userCtx?.anthropic_api_key || null,
    geminiKey: userCtx?.gemini_api_key || null,
  }

  const roadmap = userCtx?.roadmap || 'No roadmap set yet'
  let result

  if (type === 'midday' || type === 'afternoon') {
    result = await generateCheckin({ type, tasks, schedule, userMessage, llmKeys })
  } else if (type === 'evening') {
    const incompleteTasks = tasks.filter(t => !t.done && t.status !== 'wont_do')
    result = await generateEveningRetro({ tasks, schedule, roadmap, incompleteTasks, llmKeys })

    // Store retro
    await supabaseAdmin.from('retros').upsert(
      { user_id: userId, date: todayKey(), data: result, created_at: new Date().toISOString() },
      { onConflict: 'user_id,date' }
    )

    // COO memory write-back — extract patterns and store
    const patterns = await extractAndStorePatterns({ retroResult: result, userId, llmKeys })
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
    result = await generateWeeklyReview({ weekTasks: weekTasks || [], roadmap, llmKeys })
  } else if (type === 'weekly_feedback') {
    // User responded to weekly digest — update final_message + clear pending flag
    const { digestId, feedback } = body
    const { data: digestRow } = await supabaseAdmin.from('weekly_digests').select('*').eq('id', digestId).eq('user_id', userId).maybeSingle()
    if (digestRow) {
      const fb = await generateWeeklyFeedback({ digest: digestRow.digest, userFeedback: feedback, llmKeys })
      const finalMessage = fb?.final_message || feedback
      await supabaseAdmin.from('weekly_digests').update({ user_feedback: feedback, final_message: finalMessage }).eq('id', digestId)
      await supabaseAdmin.from('user_context').update({ pending_weekly_digest: false, updated_at: new Date().toISOString() }).eq('user_id', userId)
      result = { message: finalMessage }
    } else {
      result = { message: 'Thanks for the feedback!' }
    }
  } else if (type === 'parse_done') {
    const lifeAreas = userCtx?.life_areas || []
    result = await parseDoneList({ text: userMessage, lifeAreas, userCtx, llmKeys })
  } else if (type === 'delegate') {
    // Delegation plan — COO generates execution plan for user sign-off
    let emails = [], calendarEvents = []
    const tokenRow = await supabaseAdmin.from('user_tokens').select('access_token,refresh_token').eq('user_id', userId).maybeSingle().then(r => r.data)
    if (tokenRow?.access_token) {
      try {
        ;[emails, calendarEvents] = await Promise.all([
          getImportantEmails(tokenRow.access_token, tokenRow.refresh_token),
          getTodayEvents(tokenRow.access_token, tokenRow.refresh_token),
        ])
      } catch {}
    }
    const goals = delegateGoals || userCtx?.goals || []
    result = await generateDelegationPlan({ task: delegateTask || {}, goals, userCtx, emails, calendarEvents, llmKeys })
  } else if (type === 'autocomplete') {
    result = await generateChatAutocomplete({ partialMessage: userMessage, tasks, schedule, llmKeys })
  } else {
    // Free-form chat — fetch live email + calendar context so the COO can reference them
    let emails = [], calendarEvents = []
    const tokenRow = await supabaseAdmin.from('user_tokens').select('access_token,refresh_token').eq('user_id', userId).maybeSingle().then(r => r.data)
    if (tokenRow?.access_token) {
      try {
        ;[emails, calendarEvents] = await Promise.all([
          getImportantEmails(tokenRow.access_token, tokenRow.refresh_token),
          getTodayEvents(tokenRow.access_token, tokenRow.refresh_token),
        ])
      } catch {}
    }
    result = await generateChatResponse({ userMessage, tasks, schedule, userCtx, emails, calendarEvents, llmKeys })

    // Persist chat exchange to chat_logs for tier journal generation
    const cooMsg = result?.message || result?.headline || ''
    if (userMessage && cooMsg) {
      supabaseAdmin.from('tree_species').select('current_tier').eq('user_id', userId).maybeSingle()
        .then(({ data: sp }) => supabaseAdmin.from('chat_logs').insert([
          { user_id: userId, role: 'user', content: userMessage, tier_at: sp?.current_tier || 1 },
          { user_id: userId, role: 'coo', content: cooMsg, tier_at: sp?.current_tier || 1 },
        ]))
        .catch(() => {})
    }
  }

  return Response.json({ result })
}
