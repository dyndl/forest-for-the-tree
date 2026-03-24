import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateTaskProposals } from '@/lib/coo'
import { getImportantEmails, getTodayEvents } from '@/lib/google'

export const dynamic = 'force-dynamic'

function todayKey() { return new Date().toISOString().slice(0, 10) }

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

  const [ctxRes, tasksRes, tokenRes] = await Promise.all([
    supabaseAdmin.from('user_context').select('roadmap,outline,life_areas,adhd_aware,integration_tier').eq('user_id', userId).maybeSingle(),
    supabaseAdmin.from('tasks').select('id,name,q,cat,blocks,done').eq('user_id', userId).eq('date', todayKey()),
    supabaseAdmin.from('user_tokens').select('access_token,refresh_token').eq('user_id', userId).maybeSingle(),
  ])

  const ctx = ctxRes.data || {}
  const tasks = tasksRes.data || []
  const token = tokenRes.data

  let emails = [], calendarEvents = []
  if (token?.access_token) {
    try { [emails, calendarEvents] = await Promise.all([getImportantEmails(token.access_token, token.refresh_token), getTodayEvents(token.access_token, token.refresh_token)]) } catch {}
  }

  const proposals = await generateTaskProposals({
    emails, calendarEvents, tasks,
    roadmap: ctx.roadmap || '',
    outline: ctx.outline || '',
    lifeAreas: ctx.life_areas || [],
    adhdAware: ctx.adhd_aware || false,
  })

  await supabaseAdmin.from('user_context').update({ background_proposals: proposals, updated_at: new Date().toISOString() }).eq('user_id', userId)
  return Response.json({ proposals })
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
