import { supabaseAdmin } from '@/lib/supabase-admin'
import { getOuraMorningContext } from '@/lib/oura'

export const dynamic = 'force-dynamic'

/**
 * POST /api/webhooks/oura
 * Receives Oura ring-sync webhooks (fires when the ring syncs after sleep).
 *
 * Oura sends:
 *   Header: x-oura-verification-token (must match OURA_WEBHOOK_SECRET)
 *   Body:   { event_type, data_type, object_id, user_id, created_at }
 *
 * Oura webhook subscription setup:
 *   POST https://api.ouraring.com/v2/webhook/subscription
 *   { callback_url, event_type: "create", data_type: "daily_sleep", verification_token }
 *
 * Requires OURA_WEBHOOK_SECRET env var.
 */
export async function POST(req) {
  const token = req.headers.get('x-oura-verification-token')
  if (token !== process.env.OURA_WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  const body = await req.json().catch(() => null)
  // Only act on sleep data — that's what drives energy/readiness scores
  if (!body?.user_id || body?.data_type !== 'daily_sleep') {
    return new Response('ok', { status: 200 })
  }

  // Look up our user by Oura's user_id (stored on connect in oura_user_id column)
  const connector = await supabaseAdmin
    .from('connectors')
    .select('user_id, credentials')
    .eq('provider', 'oura')
    .eq('oura_user_id', body.user_id)
    .single()
    .then(r => r.data)

  if (!connector) return new Response('ok', { status: 200 })

  const { user_id: userId, credentials } = connector

  const ouraData = await getOuraMorningContext(credentials.access_token).catch(() => null)
  if (!ouraData) return new Response('ok', { status: 200 })

  // Update connector cache and energy level in parallel
  const today = new Date().toISOString().slice(0, 10)
  await Promise.all([
    supabaseAdmin.from('connectors').update({
      metadata:  { last_data: ouraData, cached_at: new Date().toISOString() },
      last_sync: new Date().toISOString(),
    }).eq('user_id', userId).eq('provider', 'oura'),

    ouraData.energy_level
      ? supabaseAdmin.from('user_context').upsert({
          user_id:        userId,
          energy_default: ouraData.energy_level,
          updated_at:     new Date().toISOString(),
        }, { onConflict: 'user_id' })
      : Promise.resolve(),

    // Mark today's schedule stale so the morning brief regenerates with fresh Oura data
    supabaseAdmin.from('schedules')
      .update({ stale: true, oura_data: ouraData })
      .eq('user_id', userId)
      .eq('date', today),
  ])

  return new Response('ok', { status: 200 })
}
