import { supabaseAdmin } from '@/lib/supabase'
import { getFeatureFlags } from '@/lib/integrations'
import { generateMorningBriefWithOura, runAgentBrief } from '@/lib/coo'
import { getTodayEvents, getImportantEmails, clearCOOEvents, writeCOOScheduleToCalendar, writeUrgentAlert, getRelationshipContacts, getUpcomingBirthdays, getOverdueContacts } from '@/lib/google'
import { getOuraMorningContext } from '@/lib/oura'
import { generateRelationshipBrief } from '@/lib/coo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function todayKey() { return new Date().toISOString().slice(0, 10) }

export async function GET(req) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const type = new URL(req.url).searchParams.get('type') || 'morning'
  const results = []

  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  const { data: activeUsers } = await supabaseAdmin
    .from('tasks').select('user_id').gte('created_at', cutoff).limit(100)

  const userIds = [...new Set((activeUsers || []).map(r => r.user_id))]

  for (const userId of userIds) {
    try {
      let result
      if (type === 'morning')       result = await runMorning(userId)
      else if (type === 'agents')   result = await runAgents(userId)
      else if (type === 'relationships') result = await runRelationships(userId)
      results.push({ userId, type, ...result })
    } catch (err) {
      results.push({ userId, type, error: err.message })
    }
  }

  return Response.json({ ran: results.length, results })
}

async function getTokenAndContext(userId) {
  const [tokenRow, userCtx, ouraConnector] = await Promise.all([
    supabaseAdmin.from('user_tokens').select('*').eq('user_id', userId).single().then(r => r.data),
    supabaseAdmin.from('user_context').select('*').eq('user_id', userId).single().then(r => r.data),
    supabaseAdmin.from('connectors').select('*').eq('user_id', userId).eq('provider', 'oura').eq('enabled', true).single().then(r => r.data),
  ])
  const flags = getFeatureFlags(userCtx?.integration_tier, userCtx?.addons)
  return { tokenRow, userCtx, ouraConnector, flags }
}

async function runMorning(userId) {
  const { tokenRow, userCtx, ouraConnector } = await getTokenAndContext(userId)

  const tasks = (await supabaseAdmin.from('tasks').select('*').eq('user_id', userId).eq('date', todayKey())).data || []

  let calendarEvents = [], emails = [], ouraData = null
  const { flags } = await getTokenAndContext(userId).catch(() => ({ flags: getFeatureFlags() }))

  if (flags.googleCalendar && tokenRow?.access_token) {
    try {
      await clearCOOEvents(tokenRow.access_token, tokenRow.refresh_token)
      ;[calendarEvents, emails] = await Promise.all([
        getTodayEvents(tokenRow.access_token, tokenRow.refresh_token),
        getImportantEmails(tokenRow.access_token, tokenRow.refresh_token),
      ])
    } catch (e) { console.error('Google API error:', e.message) }
  }

  // Fetch Oura data if connected
  if (ouraConnector?.credentials?.access_token) {
    try {
      ouraData = await getOuraMorningContext(ouraConnector.credentials.access_token)
      // Auto-update energy level from Oura
      if (ouraData?.energy_level) {
        await supabaseAdmin.from('user_context').upsert({
          user_id: userId,
          energy_default: ouraData.energy_level,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
      }
      // Cache Oura data in connector
      await supabaseAdmin.from('connectors').update({
        metadata: { last_data: ouraData, cached_at: new Date().toISOString() },
        last_sync: new Date().toISOString(),
      }).eq('user_id', userId).eq('provider', 'oura')
    } catch (e) { console.error('Oura error:', e.message) }
  }

  const plan = await generateMorningBriefWithOura({
    tasks, calendarEvents, emails,
    roadmap: userCtx?.roadmap,
    ouraData,
    userContext: userCtx,
  })

  if (!plan) return { ok: false, error: 'Plan generation failed' }

  const slots = plan.slots.map(s => ({ ...s, taskId: s.task_id || null, state: 'pending' }))
  const record = {
    user_id: userId, date: todayKey(), stale: false,
    coo_message: plan.coo_message, energy_read: plan.energy_read,
    top_3_mits: plan.top_3_mits, eliminated: plan.eliminated,
    slots, calendar_events: calendarEvents, email_summary: emails.slice(0, 5),
    oura_data: ouraData,
    created_at: new Date().toISOString(),
  }

  await supabaseAdmin.from('schedules').upsert(record, { onConflict: 'user_id,date' })

  let eventsCreated = 0
  if (tokenRow?.access_token) {
    try {
      // Add Oura note to morning brief calendar event
      eventsCreated = await writeCOOScheduleToCalendar(
        tokenRow.access_token, tokenRow.refresh_token,
        { slots, top_3_mits: plan.top_3_mits, oura_note: plan.oura_note }
      )
    } catch (e) { console.error('Calendar write error:', e.message) }
  }

  return { ok: true, eventsCreated, hasOura: !!ouraData }
}

async function runAgents(userId) {
  const { tokenRow, userCtx } = await getTokenAndContext(userId)
  const agents = (await supabaseAdmin.from('agents').select('*').eq('user_id', userId)).data || []
  const tasks = (await supabaseAdmin.from('tasks').select('*').eq('user_id', userId).eq('date', todayKey())).data || []
  const alerts = []

  for (const agent of agents) {
    const result = await runAgentBrief({ agent, tasks, isSilent: true })
    await supabaseAdmin.from('agents').update({
      status: result.urgent ? 'alert' : 'ok',
      alert: result.alert || '',
      last_run: new Date().toISOString(),
    }).eq('id', agent.id).eq('user_id', userId)

    if (result.urgent && result.alert && tokenRow?.access_token) {
      try {
        await writeUrgentAlert(tokenRow.access_token, tokenRow.refresh_token, agent.name, result.alert)
        alerts.push(agent.name)
      } catch {}
    }
  }

  return { ok: true, urgentAlerts: alerts }
}

async function runRelationships(userId) {
  const { tokenRow } = await getTokenAndContext(userId)
  if (!tokenRow?.access_token) return { ok: false, error: 'No token' }

  const contacts = await getRelationshipContacts(tokenRow.access_token, tokenRow.refresh_token)
  const overdue = getOverdueContacts(contacts)
  const birthdays = getUpcomingBirthdays(contacts)

  await supabaseAdmin.from('relationship_cache').upsert(
    { user_id: userId, contacts, overdue, birthdays, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  )

  const result = await generateRelationshipBrief({
    contacts, overdueContacts: overdue, upcomingBirthdays: birthdays,
    userMessage: 'Weekly Sunday review', weeklyCheckin: true,
  })

  await supabaseAdmin.from('relationship_briefs').upsert(
    { user_id: userId, date: todayKey(), brief: result, weekly: true, created_at: new Date().toISOString() },
    { onConflict: 'user_id,date' }
  )

  if (result?.birthday_alerts?.length > 0 && tokenRow.access_token) {
    for (const alert of result.birthday_alerts) {
      await writeUrgentAlert(tokenRow.access_token, tokenRow.refresh_token, 'Relationship Pulse', `🎂 ${alert}`)
    }
  }

  const urgentOverdue = overdue.filter(c => c.tier === 'close' && c.daysSince > 14)
  if (urgentOverdue.length > 0 && tokenRow.access_token) {
    const names = urgentOverdue.map(c => c.name).join(', ')
    await writeUrgentAlert(tokenRow.access_token, tokenRow.refresh_token, 'Relationship Pulse', `Haven't connected with ${names} in a while — one text today?`)
  }

  return { ok: true, contactsScanned: contacts.length, overdueFound: overdue.length, birthdaysSoon: birthdays.length }
}
