import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateTaskProposals } from '@/lib/coo'
import { getImportantEmails, getTodayEvents } from '@/lib/google'

export const dynamic = 'force-dynamic'

function todayKey() { return new Date().toISOString().slice(0, 10) }

const JOB_SUBJECT_RE = /interview|phone\s+screen|technical\s+screen|offer|rejection|next\s+steps|moving\s+forward|availability|schedule\s+a\s+call|get\s+back\s+to\s+you|your\s+application|following\s+up|heard\s+back|excited\s+to|love\s+to\s+chat|loop\s+you\s+in/i
const NOREPLY_RE = /noreply|no-reply|donotreply|notifications@|alerts@|newsletter/i

export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: ctx } = await supabaseAdmin.from('user_context').select('background_proposals').eq('user_id', session.user.email).maybeSingle()
  return Response.json({ proposals: ctx?.background_proposals || [] })
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.email
  const today = todayKey()

  const [ctxRes, tasksRes, tokenRes] = await Promise.all([
    supabaseAdmin.from('user_context').select('roadmap,outline,life_areas,adhd_aware,integration_tier,gemini_api_key,anthropic_api_key').eq('user_id', userId).maybeSingle(),
    supabaseAdmin.from('tasks').select('id,name,q,cat,blocks,done').eq('user_id', userId).eq('date', today),
    supabaseAdmin.from('user_tokens').select('access_token,refresh_token').eq('user_id', userId).maybeSingle(),
  ])

  const ctx = ctxRes.data || {}
  const tasks = tasksRes.data || []
  const token = tokenRes.data

  let emails = [], calendarEvents = []
  if (token?.access_token) {
    try { [emails, calendarEvents] = await Promise.all([getImportantEmails(token.access_token, token.refresh_token), getTodayEvents(token.access_token, token.refresh_token)]) } catch {}
  }

  // ── Auto-create DO tasks for important job emails not yet on task list ────────
  const existingNames = new Set(tasks.map(t => t.name.toLowerCase()))
  const urgentEmailTasks = []
  for (const email of emails) {
    if (NOREPLY_RE.test(email.from)) continue
    const isJobRelated = JOB_SUBJECT_RE.test(email.subject)
    const isImportantCategory = ['interview', 'action_required', 'important_unread'].includes(email.category)
    if (!isJobRelated && !isImportantCategory) continue

    const taskName = `Reply: ${email.subject.slice(0, 60)}`
    if (existingNames.has(taskName.toLowerCase())) continue

    const fromAddress = email.from.match(/<([^>]+)>/)
      ? email.from.match(/<([^>]+)>/)[1]
      : email.from.trim()
    const notes = `From: ${email.from}\n\nSource: mailto:${fromAddress}`

    urgentEmailTasks.push({
      user_id: userId, name: taskName, q: 'do', cat: 'career',
      blocks: 2, who: 'me', notes, done: false, date: today, source: 'coo',
    })
    existingNames.add(taskName.toLowerCase())
  }
  if (urgentEmailTasks.length > 0) {
    await supabaseAdmin.from('tasks').insert(urgentEmailTasks)
  }

  const llmKeys = {
    anthropicKey: ctx.anthropic_api_key || null,
    geminiKey: ctx.gemini_api_key || null,
  }
  const proposals = await generateTaskProposals({
    emails, calendarEvents, tasks,
    roadmap: ctx.roadmap || '',
    outline: ctx.outline || '',
    lifeAreas: ctx.life_areas || [],
    adhdAware: ctx.adhd_aware || false,
    llmKeys,
  })

  await supabaseAdmin.from('user_context').update({ background_proposals: proposals, updated_at: new Date().toISOString() }).eq('user_id', userId)
  return Response.json({ proposals, urgent_tasks_added: urgentEmailTasks.length })
}

export async function PATCH(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.email
  const { action, proposal } = await req.json()

  const { data: ctx } = await supabaseAdmin.from('user_context').select('background_proposals').eq('user_id', userId).maybeSingle()
  const current = ctx?.background_proposals || []
  const updated = current.filter(p => p.id !== proposal.id)

  let task = null
  if (action === 'accept') {
    const { data: inserted } = await supabaseAdmin.from('tasks').insert({
      user_id: userId, name: proposal.name, q: proposal.q || 'do',
      cat: proposal.cat || 'admin', blocks: proposal.blocks || 2,
      who: 'me',
      notes: proposal.rationale && proposal.source_ref
        ? `${proposal.rationale}\n\nSource: ${proposal.source_ref}`
        : proposal.rationale || (proposal.source_ref ? `Source: ${proposal.source_ref}` : ''),
      done: false,
      date: todayKey(), source: 'coo_proposal',
    }).select().single()
    task = inserted
  }

  await supabaseAdmin.from('user_context').update({ background_proposals: updated, updated_at: new Date().toISOString() }).eq('user_id', userId)
  return Response.json({ task, proposals: updated })
}
