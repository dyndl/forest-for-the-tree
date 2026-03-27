import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateMorningBriefWithOura, assessVetoImpact, gatherAgentContributions, parseJSON } from '@/lib/coo'
import { getTodayEvents, getImportantEmails } from '@/lib/google'
import { getOuraMorningContext, refreshOuraToken } from '@/lib/oura'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

function todayKey() { return new Date().toISOString().slice(0, 10) }
function buildVetoHistory(schedules) {
  const vetoes = []
  for (const sched of (schedules || [])) {
    for (const s of (sched.slots || [])) {
      if (s.state === 'vetoed') {
        vetoes.push(`• ${sched.date} ${s.time}: "${s.label}" [${s.quadrant || '?'}/${s.category || '?'}]`)
      }
    }
  }
  if (!vetoes.length) return ''
  return `RECENT VETOES — past 7 days (do not re-schedule these patterns):\n${vetoes.slice(0, 12).join('\n')}`
}
function tomorrowKey() { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10) }
function activeScheduleDate() {
  const h = new Date().getHours()
  return h >= 14 ? tomorrowKey() : todayKey()
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.email

  const today = todayKey()
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  const tomorrow = tomorrowKey()

  const { data: rows } = await supabaseAdmin.from('schedules').select('*')
    .eq('user_id', userId).in('date', [yesterday, today, tomorrow]).order('date', { ascending: false })

  if (!rows?.length) return Response.json({ schedule: null })
  return Response.json({ schedule: rows.find(r => r.date === today) || rows.find(r => r.date === tomorrow) || rows[rows.length - 1] || null })
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.email
  const body = await req.json().catch(() => ({}))

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data) => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)) } catch {}
      }
      try {
        send({ status: 'fetching' })

        const currentHour = typeof body.localHour === 'number' ? body.localHour : new Date().getHours()
        const localToday = body.localDate || todayKey()
        const localTomorrow = body.localTomorrow || tomorrowKey()
        const planForTomorrow = currentHour >= 14

        const tasksQuery = planForTomorrow
          ? supabaseAdmin.from('tasks').select('*').eq('user_id', userId).eq('done', false).neq('status', 'wont_do')
          : supabaseAdmin.from('tasks').select('*').eq('user_id', userId).eq('date', localToday)

        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
        const overdueQuery = supabaseAdmin.from('tasks').select('*')
          .eq('user_id', userId).eq('done', false).neq('status', 'wont_do')
          .lt('date', localToday).gte('date', sevenDaysAgo)

        const [tasks, userCtx, ouraConnector, recentScheds, agentRows, overdueTasksData] = await Promise.all([
          tasksQuery.then(r => r.data || []),
          supabaseAdmin.from('user_context').select('*').eq('user_id', userId).single().then(r => r.data),
          supabaseAdmin.from('connectors').select('*').eq('user_id', userId).eq('provider', 'oura').eq('enabled', true).single().then(r => r.data),
          supabaseAdmin.from('schedules').select('date, slots').eq('user_id', userId).gte('date', sevenDaysAgo).order('date', { ascending: false }).limit(7).then(r => r.data || []),
          supabaseAdmin.from('agents').select('*').eq('user_id', userId).then(r => r.data || []),
          overdueQuery.then(r => r.data || []),
        ])
        const vetoHistory = buildVetoHistory(recentScheds)

        const goals = userCtx?.goals || []
        // Cap agent contributions at 4s — a slow/missing API key must not hang the whole request
        const agentContributions = await Promise.race([
          gatherAgentContributions({ agents: agentRows, goals, tasks, roadmap: body.roadmap || userCtx?.roadmap, userCtx }),
          new Promise(resolve => setTimeout(() => resolve(''), 4000)),
        ])

        let calendarEvents = [], emails = [], ouraData = null

        if (session.accessToken) {
          try {
            const linkedAccounts = userCtx?.linked_accounts || []
            ;[calendarEvents, emails] = await Promise.all([
              getTodayEvents(session.accessToken, session.refreshToken, linkedAccounts),
              getImportantEmails(session.accessToken, session.refreshToken),
            ])
          } catch {}
        }

        if (ouraConnector?.credentials?.access_token) {
          try {
            let token = ouraConnector.credentials.access_token
            const { expires_at, refresh_token } = ouraConnector.credentials
            if (ouraConnector.type === 'oauth' && refresh_token && expires_at) {
              const msLeft = new Date(expires_at).getTime() - Date.now()
              if (msLeft < 7 * 24 * 60 * 60 * 1000) {
                try {
                  const refreshed = await refreshOuraToken(refresh_token)
                  token = refreshed.access_token
                  await supabaseAdmin.from('connectors').update({
                    credentials: { access_token: refreshed.access_token, refresh_token: refreshed.refresh_token, expires_at: refreshed.expires_at },
                    last_sync: new Date().toISOString(),
                  }).eq('id', ouraConnector.id).eq('user_id', userId)
                } catch { /* use existing token */ }
              }
            }
            ouraData = await getOuraMorningContext(token)
          } catch {}
        }

        send({ status: 'generating' })

        const { chunks, planDateKey } = await generateMorningBriefWithOura({
          tasks, calendarEvents, emails,
          roadmap: body.roadmap || userCtx?.roadmap,
          ouraData, userContext: userCtx, currentHour,
          localDate: localToday, localTomorrow,
          vetoHistory, agentContributions,
          overdueTasks: overdueTasksData,
          stream: true,
        })

        let raw = ''
        for await (const chunk of chunks) { raw += chunk }

        const plan = parseJSON(raw)
        if (!plan) { send({ error: 'COO failed to generate plan' }); return }
        if (!plan.plan_date) plan.plan_date = planDateKey

        send({ status: 'saving' })

        const planDate = plan.plan_date || (planForTomorrow ? localTomorrow : localToday)
        const slots = plan.slots.map(s => ({
          ...s,
          taskId: s.task_id || null,
          state: s.type === 'optional_tonight' ? 'optional' : 'pending',
        }))
        const record = {
          user_id: userId, date: planDate, stale: false,
          coo_message: plan.coo_message, energy_read: plan.energy_read,
          top_3_mits: plan.top_3_mits, eliminated: plan.eliminated,
          slots, calendar_events: calendarEvents, email_summary: emails.slice(0, 5),
          oura_data: ouraData, created_at: new Date().toISOString(),
        }

        await supabaseAdmin.from('schedules').upsert(record, { onConflict: 'user_id,date' })

        const TASK_TYPES = new Set(['task', 'deep_work', null, undefined])
        const SKIP_TYPES = new Set(['break', 'lunch', 'free', 'event', 'optional_tonight'])
        const taskSlots = slots.filter(s =>
          !SKIP_TYPES.has(s.type) && TASK_TYPES.has(s.type) &&
          !s.taskId && !s.bundle?.length && s.label && s.quadrant !== 'eliminate'
        )
        const bundleSlots = slots.filter(s => s.bundle?.length > 0)

        let proposedTasks = []
        const hasWork = taskSlots.length > 0 || bundleSlots.some(s => s.bundle.some(sub => !sub.taskId && sub.label))
        if (hasWork) {
          await supabaseAdmin.from('tasks').delete()
            .eq('user_id', userId).eq('date', planDate).eq('status', 'proposed').eq('source', 'coo')

          if (taskSlots.length > 0) {
            const insertRows = taskSlots.map(s => ({
              user_id: userId,
              name: s.label,
              q: s.quadrant || 'do',
              cat: s.category || userCtx?.life_areas?.[0]?.key || 'admin',
              blocks: s.duration_blocks || 2,
              who: 'me',
              notes: s.note && s.source_ref ? `${s.note}\n\nSource: ${s.source_ref}` : s.note || (s.source_ref ? `Source: ${s.source_ref}` : ''),
              done: false,
              date: planDate,
              status: 'proposed',
              source: 'coo',
            }))
            const { data: created } = await supabaseAdmin.from('tasks').insert(insertRows).select()
            if (created?.length) {
              proposedTasks = [...proposedTasks, ...created]
              created.forEach((task, i) => {
                const sl = slots.find(s => s.label === taskSlots[i].label && !s.taskId && !s.bundle?.length)
                if (sl) sl.taskId = task.id
              })
            }
          }

          for (const slot of bundleSlots) {
            const needsTask = slot.bundle.filter(sub => !sub.taskId && sub.label)
            if (!needsTask.length) continue
            const insertRows = needsTask.map(sub => ({
              user_id: userId,
              name: sub.label,
              q: sub.quadrant || slot.quadrant || 'do',
              cat: sub.category || slot.category || userCtx?.life_areas?.[0]?.key || 'admin',
              blocks: sub.duration_blocks || 2,
              who: 'me',
              notes: sub.source_ref ? `Source: ${sub.source_ref}` : '',
              done: false,
              date: planDate,
              status: 'proposed',
              source: 'coo',
            }))
            const { data: created } = await supabaseAdmin.from('tasks').insert(insertRows).select()
            if (created?.length) {
              proposedTasks = [...proposedTasks, ...created]
              let ci = 0
              for (const sub of slot.bundle) {
                if (!sub.taskId && sub.label && created[ci]) {
                  sub.taskId = created[ci].id
                  ci++
                }
              }
            }
          }

          if (proposedTasks.length) {
            record.slots = slots
            await supabaseAdmin.from('schedules').update({ slots }).eq('user_id', userId).eq('date', planDate)
          }
        }

        send({ schedule: record, proposed_tasks: proposedTasks, task_migrations: plan.task_migrations || [] })
      } catch (e) {
        console.error('schedule POST error:', e)
        send({ error: e?.message || 'Schedule generation failed' })
      } finally {
        try { controller.close() } catch {}
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

export async function PATCH(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { action, slotIndex, reason, pushback_date, label, time, note, duration_blocks, subtaskStates, localDate: clientDate } = await req.json()
  const userId = session.user.email

  const schedDate = clientDate || activeScheduleDate()
  const { data: existing } = await supabaseAdmin.from('schedules').select('*').eq('user_id', userId).eq('date', schedDate).single()
  if (!existing) return Response.json({ error: 'No schedule' }, { status: 404 })

  const slots = [...existing.slots]

  if (action === 'bundle_update') {
    const bundle = slots[slotIndex]?.bundle
    if (bundle && subtaskStates) {
      for (const [iStr, state] of Object.entries(subtaskStates)) {
        const i = parseInt(iStr)
        if (bundle[i]) {
          bundle[i].state = state
          if (state === 'vetoed' && reason) bundle[i].veto_reason = reason
        }
      }
      const subStates = bundle.map(s => s.state)
      const allVetoed = subStates.every(s => s === 'vetoed')
      const anyPending = subStates.some(s => s === 'pending')
      slots[slotIndex].state = allVetoed ? 'vetoed' : anyPending ? 'pending' : 'accepted'
      slots[slotIndex].bundle = bundle
    }
  } else if (action === 'accept') {
    slots[slotIndex].state = 'accepted'
  } else if (action === 'accept_all') {
    slots.forEach(s => {
      if (s.taskId && (s.state === 'pending' || s.state === 'optional')) s.state = 'accepted'
      if (s.bundle?.length) {
        s.bundle.forEach(sub => { if (sub.state === 'pending') sub.state = 'accepted' })
        s.state = 'accepted'
      }
    })
  } else if (action === 'veto') {
    slots[slotIndex].state = 'vetoed'
    if (reason) slots[slotIndex].veto_reason = reason
    if (pushback_date && slots[slotIndex].taskId) {
      await supabaseAdmin.from('tasks').update({ date: pushback_date }).eq('id', slots[slotIndex].taskId).eq('user_id', userId)
      slots[slotIndex].pushed_to = pushback_date
    }
  } else if (action === 'edit') {
    if (label !== undefined) slots[slotIndex].label = label
    if (time !== undefined) slots[slotIndex].time = time
    if (note !== undefined) slots[slotIndex].note = note
    if (duration_blocks !== undefined) slots[slotIndex].duration_blocks = duration_blocks
    if (slots[slotIndex].taskId) {
      const taskUpdates = {}
      if (duration_blocks !== undefined) taskUpdates.blocks = duration_blocks
      if (label !== undefined) taskUpdates.name = label
      if (Object.keys(taskUpdates).length)
        await supabaseAdmin.from('tasks').update(taskUpdates).eq('id', slots[slotIndex].taskId).eq('user_id', userId)
    }
  }

  const taskSlotsFinal = slots.filter(s => !['break','lunch','free','event','optional_tonight'].includes(s.type))
  let acceptedFinal = 0, vetoedFinal = 0
  for (const s of taskSlotsFinal) {
    if (s.bundle?.length) {
      for (const sub of s.bundle) {
        if (sub.state === 'accepted') acceptedFinal++
        else if (sub.state === 'vetoed') vetoedFinal++
      }
    } else {
      if (s.state === 'accepted') acceptedFinal++
      else if (s.state === 'vetoed') vetoedFinal++
    }
  }
  const total = acceptedFinal + vetoedFinal
  const cooScore = total > 0 ? Math.round((acceptedFinal / total) * 100) : null

  await supabaseAdmin.from('schedules').update({ slots, coo_score: cooScore }).eq('user_id', userId).eq('date', schedDate)

  if (action === 'veto') {
    const vi = slotIndex
    supabaseAdmin.from('tasks').select('*').eq('user_id', userId).eq('date', schedDate)
      .then(r => assessVetoImpact({ vetoedSlot: slots[vi], remainingSlots: slots, tasks: r.data || [] }))
      .then(impact => {
        if (!impact) return
        const updated = slots.map((s, i) => i === vi ? { ...s, impact: impact.impact, suggestion: impact.suggestion, severity: impact.severity } : s)
        return supabaseAdmin.from('schedules').update({ slots: updated }).eq('user_id', userId).eq('date', schedDate)
      })
      .catch(() => {})
  }

  return Response.json({ slots, coo_score: cooScore })
}
