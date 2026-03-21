import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateMorningBriefWithOura, assessVetoImpact } from '@/lib/coo'
import { getTodayEvents, getImportantEmails } from '@/lib/google'
import { getOuraMorningContext } from '@/lib/oura'

function todayKey() { return new Date().toISOString().slice(0, 10) }

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { data } = await supabaseAdmin.from('schedules').select('*').eq('user_id', session.user.email).eq('date', todayKey()).single()
  return Response.json({ schedule: data || null })
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.email
  const body = await req.json()

  const [tasks, userCtx, ouraConnector] = await Promise.all([
    supabaseAdmin.from('tasks').select('*').eq('user_id', userId).eq('date', todayKey()).then(r => r.data || []),
    supabaseAdmin.from('user_context').select('*').eq('user_id', userId).single().then(r => r.data),
    supabaseAdmin.from('connectors').select('*').eq('user_id', userId).eq('provider', 'oura').eq('enabled', true).single().then(r => r.data),
  ])

  let calendarEvents = [], emails = [], ouraData = null

  if (session.accessToken) {
    try {
      ;[calendarEvents, emails] = await Promise.all([
        getTodayEvents(session.accessToken, session.refreshToken),
        getImportantEmails(session.accessToken, session.refreshToken),
      ])
    } catch {}
  }

  if (ouraConnector?.credentials?.access_token) {
    try {
      ouraData = await getOuraMorningContext(ouraConnector.credentials.access_token)
    } catch {}
  }

  const plan = await generateMorningBriefWithOura({
    tasks, calendarEvents, emails,
    roadmap: body.roadmap || userCtx?.roadmap,
    ouraData,
    userContext: userCtx,
  })

  if (!plan) return Response.json({ error: 'COO failed to generate plan' }, { status: 500 })

  const slots = plan.slots.map(s => ({ ...s, taskId: s.task_id || null, state: 'pending' }))
  const record = {
    user_id: userId, date: todayKey(), stale: false,
    coo_message: plan.coo_message, energy_read: plan.energy_read,
    top_3_mits: plan.top_3_mits, eliminated: plan.eliminated,
    slots, calendar_events: calendarEvents, email_summary: emails.slice(0, 5),
    oura_data: ouraData, created_at: new Date().toISOString(),
  }

  await supabaseAdmin.from('schedules').upsert(record, { onConflict: 'user_id,date' })
  return Response.json({ schedule: record })
}

export async function PATCH(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { action, slotIndex } = await req.json()
  const userId = session.user.email

  const { data: existing } = await supabaseAdmin.from('schedules').select('*').eq('user_id', userId).eq('date', todayKey()).single()
  if (!existing) return Response.json({ error: 'No schedule' }, { status: 404 })

  const slots = [...existing.slots]

  if (action === 'accept') {
    slots[slotIndex].state = 'accepted'
  } else if (action === 'accept_all') {
    slots.forEach(s => { if (s.taskId && s.state === 'pending') s.state = 'accepted' })
  } else if (action === 'veto') {
    slots[slotIndex].state = 'vetoed'
    const tasks = (await supabaseAdmin.from('tasks').select('*').eq('user_id', userId).eq('date', todayKey())).data || []
    const impact = await assessVetoImpact({ vetoedSlot: slots[slotIndex], remainingSlots: slots, tasks })
    if (impact) {
      slots[slotIndex].impact = impact.impact
      slots[slotIndex].suggestion = impact.suggestion
      slots[slotIndex].severity = impact.severity
    }
  }

  await supabaseAdmin.from('schedules').update({ slots }).eq('user_id', userId).eq('date', todayKey())
  return Response.json({ slots })
}
