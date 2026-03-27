import { supabaseAdmin } from '@/lib/supabase-admin'
import { getGmailHistory, getMessageMetadata, writeUrgentAlert } from '@/lib/google'
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

  // Fire-and-forget: scan for urgent job emails + run agent checks
  if (newMessageIds.length > 0) {
    scanUrgentJobEmails(userId, tokenRow, newMessageIds).catch(() => {})
    runAgentChecks(userId, tokenRow).catch(() => {})
  }

  return new Response('ok', { status: 200 })
}

// ── JOB EMAIL KEYWORDS ─────────────────────────────────────────────────────────
const JOB_SUBJECT_RE = /interview|phone\s+screen|technical\s+screen|offer|rejection|next\s+steps|moving\s+forward|availability|schedule\s+a\s+call|get\s+back\s+to\s+you|your\s+application|following\s+up|heard\s+back|excited\s+to|love\s+to\s+chat|loop\s+you\s+in/i
const RESPOND_RE = /respond|reply|please\s+confirm|let\s+us\s+know|action\s+required|response\s+needed|following\s+up/i
const NOREPLY_RE = /noreply|no-reply|donotreply|notifications@|alerts@|newsletter/i

async function scanUrgentJobEmails(userId, tokenRow, messageIds) {
  const today = new Date().toISOString().slice(0, 10)

  // Fetch existing tasks to avoid duplicates
  const { data: existing } = await supabaseAdmin.from('tasks')
    .select('name').eq('user_id', userId).eq('date', today)
  const existingNames = new Set((existing || []).map(t => t.name.toLowerCase()))

  for (const msgId of messageIds.slice(0, 10)) {
    try {
      const meta = await getMessageMetadata(tokenRow.access_token, tokenRow.refresh_token, msgId)
      const { subject, from, labelIds } = meta

      // Skip auto-generated/noreply senders
      if (NOREPLY_RE.test(from)) continue

      const isImportant = labelIds.includes('IMPORTANT') || labelIds.includes('STARRED')
      const isJobRelated = JOB_SUBJECT_RE.test(subject)
      const needsResponse = RESPOND_RE.test(subject) || isJobRelated

      // Create a DO task only if Gmail flagged it important AND it's job-related
      if (isImportant && isJobRelated) {
        const taskName = `Reply: ${subject.slice(0, 60)}`
        if (existingNames.has(taskName.toLowerCase())) continue

        const fromAddress = from.match(/<([^>]+)>/) ? from.match(/<([^>]+)>/)[1] : from.split(' ').pop()
        const notes = `From: ${from}\n\nSource: mailto:${fromAddress}`

        await supabaseAdmin.from('tasks').insert({
          user_id: userId,
          name: taskName,
          q: 'do',
          cat: 'career',
          blocks: 2,
          who: 'me',
          notes,
          done: false,
          date: today,
          source: 'coo',
        })

        // Calendar alert so it appears within the hour
        if (tokenRow.access_token && needsResponse) {
          await writeUrgentAlert(
            tokenRow.access_token, tokenRow.refresh_token,
            'Job Email', `Action needed: ${subject}`
          ).catch(() => {})
        }
      }
    } catch { /* skip this message */ }
  }
}

async function runAgentChecks(userId, tokenRow) {
  const today  = new Date().toISOString().slice(0, 10)
  const [agents, tasks, userCtxRow] = await Promise.all([
    supabaseAdmin.from('agents').select('*').eq('user_id', userId).then(r => r.data || []),
    supabaseAdmin.from('tasks').select('*').eq('user_id', userId).eq('date', today).then(r => r.data || []),
    supabaseAdmin.from('user_context').select('gemini_api_key, anthropic_api_key').eq('user_id', userId).maybeSingle().then(r => r.data),
  ])
  const llmKeys = {
    anthropicKey: userCtxRow?.anthropic_api_key || null,
    geminiKey: userCtxRow?.gemini_api_key || null,
  }

  for (const agent of agents) {
    const result = await runAgentBrief({ agent, tasks, isSilent: true, llmKeys })
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
