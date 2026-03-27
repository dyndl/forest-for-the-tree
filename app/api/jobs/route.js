import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateJobDigest } from '@/lib/coo'
import { getJobBacklogEmails } from '@/lib/google'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

function todayKey() { return new Date().toISOString().slice(0, 10) }

// GET /api/jobs — return today's digest or most recent
export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.email

  const { data } = await supabaseAdmin
    .from('job_digests')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()

  return Response.json(data || { leads: [], backlog_count: 0, summary: null, date: null })
}

// POST /api/jobs or /api/jobs?refresh=true — run fresh digest
export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.email

  const [tokenRow, userCtxRow] = await Promise.all([
    supabaseAdmin.from('user_tokens').select('access_token,refresh_token').eq('user_id', userId).maybeSingle().then(r => r.data),
    supabaseAdmin.from('user_context').select('roadmap, gemini_api_key, anthropic_api_key').eq('user_id', userId).maybeSingle().then(r => r.data),
  ])

  let emails = []
  if (tokenRow?.access_token) {
    try { emails = await getJobBacklogEmails(tokenRow.access_token, tokenRow.refresh_token) } catch {}
  }

  const llmKeys = {
    anthropicKey: userCtxRow?.anthropic_api_key || null,
    geminiKey: userCtxRow?.gemini_api_key || null,
  }
  const digest = await generateJobDigest({ emails, userCtx: userCtxRow, llmKeys })
  if (!digest) return Response.json({ error: 'digest failed' }, { status: 500 })

  const today = todayKey()
  await supabaseAdmin.from('job_digests').upsert({
    user_id: userId,
    date: today,
    leads: digest.leads || [],
    summary: digest.summary || '',
    backlog_count: digest.backlog_count || 0,
    created_at: new Date().toISOString(),
  }, { onConflict: 'user_id,date' })

  return Response.json({ ...digest, date: today })
}

// PATCH /api/jobs — update lead status (applied/rejected/saved)
export async function PATCH(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.email

  const { leadIndex, status, date } = await req.json()
  const targetDate = date || todayKey()

  const { data: row } = await supabaseAdmin
    .from('job_digests').select('leads').eq('user_id', userId).eq('date', targetDate).maybeSingle()

  if (!row) return Response.json({ error: 'not found' }, { status: 404 })

  const leads = (row.leads || []).map((l, i) =>
    i === leadIndex ? { ...l, status } : l
  )

  await supabaseAdmin.from('job_digests').update({ leads }).eq('user_id', userId).eq('date', targetDate)
  return Response.json({ ok: true, leads })
}
