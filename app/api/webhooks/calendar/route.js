import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

/**
 * POST /api/webhooks/calendar
 * Receives Google Calendar push notifications (header-only — no body payload).
 *
 * On any calendar change, marks today's schedule as stale so the
 * next dashboard load triggers a fresh morning brief.
 *
 * Headers Google sends:
 *   X-Goog-Channel-Id      — our channelId (UUID stored in webhook_channels)
 *   X-Goog-Resource-State  — "sync" (initial ping) | "exists" (change) | "not_exists" (deleted)
 *   X-Goog-Resource-Id     — opaque resourceId (needed to stop the channel)
 */
export async function POST(req) {
  const channelId     = req.headers.get('x-goog-channel-id')
  const resourceState = req.headers.get('x-goog-resource-state')

  // "sync" is just a confirmation ping when the watch is first registered — ignore it
  if (!channelId || resourceState === 'sync') return new Response('ok', { status: 200 })

  const channel = await supabaseAdmin
    .from('webhook_channels')
    .select('user_id')
    .eq('channel_id', channelId)
    .single()
    .then(r => r.data)

  if (!channel?.user_id) return new Response('ok', { status: 200 })

  // Mark today's schedule stale; the dashboard will re-fetch on next load
  const today = new Date().toISOString().slice(0, 10)
  await supabaseAdmin
    .from('schedules')
    .update({ stale: true })
    .eq('user_id', channel.user_id)
    .eq('date', today)

  return new Response('ok', { status: 200 })
}
