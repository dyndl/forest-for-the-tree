import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { scanGmailInbox, scanCalendarUpcoming, scanContactsCount } from '@/lib/google'
import { generateBootProposals } from '@/lib/coo'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// GET /api/coo/init — scan all connected resources and return a COO boot briefing
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.email

  // Load user context + tokens in parallel
  const [userCtx, tokenRow, ouraRow] = await Promise.all([
    supabaseAdmin.from('user_context').select('*').eq('user_id', userId).single().then(r => r.data),
    supabaseAdmin.from('user_tokens').select('*').eq('user_id', userId).single().then(r => r.data),
    supabaseAdmin.from('connectors').select('access_token').eq('user_id', userId).eq('provider', 'oura').single().then(r => r.data),
  ])

  const hasGoogle = !!tokenRow?.access_token
  const hasOura   = !!ouraRow?.access_token

  // ── Scan resources ─────────────────────────────────────────────────────────
  let inboxStats    = null
  let calendarCount = 0
  let contactCount  = 0

  if (hasGoogle) {
    const [gmail, cal, contacts] = await Promise.all([
      scanGmailInbox(tokenRow.access_token, tokenRow.refresh_token),
      scanCalendarUpcoming(tokenRow.access_token, tokenRow.refresh_token),
      scanContactsCount(tokenRow.access_token, tokenRow.refresh_token),
    ])
    inboxStats    = gmail
    calendarCount = cal
    contactCount  = contacts
  }

  // ── Build resources list ────────────────────────────────────────────────────
  const resources = []

  if (hasGoogle) {
    resources.push({
      name:   'Gmail',
      status: 'connected',
      detail: `${inboxStats.unread.toLocaleString()} unread · ${inboxStats.subscriptions.toLocaleString()} subscriptions`,
    })
    resources.push({
      name:   'Google Calendar',
      status: 'connected',
      detail: `${calendarCount} event${calendarCount !== 1 ? 's' : ''} in the next 14 days`,
    })
    if (contactCount > 0) {
      resources.push({
        name:   'Google Contacts',
        status: 'connected',
        detail: `${contactCount.toLocaleString()} contacts`,
      })
    }
  }

  if (hasOura) {
    resources.push({ name: 'Oura Ring', status: 'connected', detail: 'Ring data live' })
  }

  if (resources.length === 0) {
    resources.push({ name: 'Local mode', status: 'connected', detail: 'No external integrations — context saved locally' })
  }

  // ── ETA for first brief ─────────────────────────────────────────────────────
  const now         = new Date()
  const nextBrief   = new Date(now)
  if (now.getHours() >= 8) nextBrief.setDate(nextBrief.getDate() + 1)
  nextBrief.setHours(7, 30, 0, 0)
  const hoursUntil  = Math.round((nextBrief - now) / (60 * 60 * 1000))
  const etaLabel    = hoursUntil < 1
    ? 'Your first morning brief will be ready in less than an hour'
    : hoursUntil < 12
    ? `Your first morning brief will be ready in ~${hoursUntil}h`
    : 'Your first morning brief will be ready tomorrow at 7:30am'

  // ── Schedule steps ──────────────────────────────────────────────────────────
  const scheduleSteps = [
    hasGoogle ? `Map your next 14 days — ${calendarCount} events already on the books` : 'Extract tasks from your outline and build your first week',
    'Pull priorities from your outline and set up your Eisenhower matrix',
    userCtx?.adhd_aware ? 'Break all work into ≤30 min focus chunks with explicit transition buffers' : `Align deep-work blocks with your peak hours (${userCtx?.peak_hours || '9–11am, 3–5pm'})`,
    hasOura ? 'Factor Oura readiness into daily cognitive load — protect you on low days' : null,
    hasGoogle && contactCount > 0 ? 'Scan contacts for upcoming birthdays and overdue touchpoints' : null,
  ].filter(Boolean)

  // ── Generate personalised background proposals via Claude ───────────────────
  const background_proposals = await generateBootProposals({
    userCtx,
    inboxStats,
    calendarCount,
    contactCount,
    hasOura,
  })

  return Response.json({
    resources,
    eta:               etaLabel,
    schedule_steps:    scheduleSteps,
    background_proposals,
  })
}
