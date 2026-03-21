import { supabaseAdmin } from '@/lib/supabase-admin'
import { getGmailHistory, writeUrgentAlert } from '@/lib/google'
import { runAgentBrief } from '@/lib/coo'

export const dynamic = 'force-dynamic'

/**
 * POST /api/webhooks/gmail
 * Receives Gmail Pub/Sub push notifications.
 *
 * Pub/Sub sends:
 *   { message: { data: "<base64: { emailAddress, historyId }>", messageId, publishTime }, subscription }
 *
 * Google Cloud setup required:
 *   1. Create Pub/Sub topic (e.g. "gmail-push")
 *   2. Grant gmail-api-push@system.gserviceaccount.com "Pub/Sub Publisher" on the topic
 *   3. Create a push subscription pointing to this URL
 *   4. Set GMAIL_PUBSUB_TOPIC=projects/{project-id}/topics/gmail-push in env
 */
export async function POST(req) {
  const body = await req.json().catch(() => null)
  if (!body?.message?.data) return new Response('ok', { status: 200 })

  let payload
  try {
    payload = JSON.parse(Buffer.from(body.message.data, 'base64').toString())
  } catch {
    return new Response('ok', { status: 200 })
  }

  const { emailAddress, historyId } = payload
  if (!emailAddress || !historyId) return new Response('ok', { status: 200 })

  const userId = emailAddress

  const [channel, tokenRow] = await Promise.all([
    supabaseAdmin.from('webhook_channels').select('history_id')
      .eq('id', `gmail_${userId}`).single().then(r => r.data),
    supabaseAdmin.from('user_tokens').select('*')
      .eq('user_id', userId).single().then(r => r.data),
  ])

  if (!tokenRow?.access_token) return new Response('ok', { status: 200 })

  const startId = channel?.history_id || historyId

  // Advance the stored historyId immediately to prevent reprocessing on retry
  await supabaseAdmin.from('webhook_channels').upsert({
    id:         `gmail_${userId}`,
    user_id:    userId,
    provider:   'gmail',
    history_id: historyId,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' })

  // Fetch message IDs added since last historyId
  const newMessageIds = await getGmailHistory(
    tokenRow.access_token, tokenRow.refresh_token, startId
  ).catch(() => [])

  // Fire-and-forget agent checks when new mail arrives
  if (newMessageIds.length > 0) {
    runAgentChecks(userId, tokenRow).catch(() => {})
  }

  return new Response('ok', { status: 200 })
}

async function runAgentChecks(userId, tokenRow) {
  const today  = new Date().toISOString().slice(0, 10)
  const [agents, tasks] = await Promise.all([
    supabaseAdmin.from('agents').select('*').eq('user_id', userId).then(r => r.data || []),
    supabaseAdmin.from('tasks').select('*').eq('user_id', userId).eq('date', today).then(r => r.data || []),
  ])

  for (const agent of agents) {
    const result = await runAgentBrief({ agent, tasks, isSilent: true })
    await supabaseAdmin.from('agents').update({
      status:   result.urgent ? 'alert' : 'ok',
      alert:    result.alert || '',
      last_run: new Date().toISOString(),
    }).eq('id', agent.id).eq('user_id', userId)

    if (result.urgent && result.alert && tokenRow.access_token) {
      await writeUrgentAlert(
        tokenRow.access_token, tokenRow.refresh_token,
        agent.name, result.alert
      ).catch(() => {})
    }
  }
}
