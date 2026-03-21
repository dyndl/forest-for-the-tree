import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { registerGmailWatch, registerCalendarWatch, stopCalendarWatch } from '@/lib/google'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'

/**
 * POST /api/webhooks/register
 * Registers (or renews) Gmail Pub/Sub watch and Calendar events.watch for a user.
 * Called from:
 *   - onboarding DoneStep (coo/init boot) — authenticated with session
 *   - Sunday cron for watch renewal — authenticated with CRON_SECRET
 */
export async function POST(req) {
  let userId

  const auth = req.headers.get('authorization')
  if (auth === `Bearer ${process.env.CRON_SECRET}`) {
    // Internal call from cron
    const body = await req.json().catch(() => ({}))
    userId = body.user_id
  } else {
    const session = await getServerSession(authOptions)
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    userId = session.user.email
  }

  if (!userId) return Response.json({ error: 'No user_id' }, { status: 400 })

  const tokenRow = await supabaseAdmin
    .from('user_tokens').select('*').eq('user_id', userId).single().then(r => r.data)

  if (!tokenRow?.access_token) {
    return Response.json({ ok: false, reason: 'no_google_token' })
  }

  const results = {}

  // ── Gmail push watch ─────────────────────────────────────────────────────────
  try {
    const gmailData = await registerGmailWatch(tokenRow.access_token, tokenRow.refresh_token)
    await supabaseAdmin.from('webhook_channels').upsert({
      id:         `gmail_${userId}`,
      user_id:    userId,
      provider:   'gmail',
      history_id: gmailData.historyId,
      expiration: Number(gmailData.expiration),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    results.gmail = 'registered'
  } catch (err) {
    console.error('registerGmailWatch error:', err.message)
    results.gmail = `error: ${err.message}`
  }

  // ── Calendar events.watch ────────────────────────────────────────────────────
  try {
    // Stop existing channel first to avoid duplicate watches
    const existing = await supabaseAdmin
      .from('webhook_channels').select('channel_id,resource_id')
      .eq('id', `cal_${userId}`).single().then(r => r.data)

    if (existing?.channel_id && existing?.resource_id) {
      await stopCalendarWatch(
        tokenRow.access_token, tokenRow.refresh_token,
        existing.channel_id, existing.resource_id
      )
    }

    const channelId = randomUUID()
    const calData   = await registerCalendarWatch(tokenRow.access_token, tokenRow.refresh_token, channelId)

    await supabaseAdmin.from('webhook_channels').upsert({
      id:          `cal_${userId}`,
      user_id:     userId,
      provider:    'calendar',
      channel_id:  channelId,
      resource_id: calData.resourceId,
      expiration:  Number(calData.expiration),
      updated_at:  new Date().toISOString(),
    }, { onConflict: 'id' })
    results.calendar = 'registered'
  } catch (err) {
    console.error('registerCalendarWatch error:', err.message)
    results.calendar = `error: ${err.message}`
  }

  return Response.json({ ok: true, results })
}
