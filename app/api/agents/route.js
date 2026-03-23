import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { runAgentBrief } from '@/lib/coo'
export const dynamic = 'force-dynamic'

function todayKey() { return new Date().toISOString().slice(0, 10) }

// Default agents are intentionally generic — users customise these during setup
// or create their own via the Agents tab (+ button).
// To add starter agents that match your life areas, edit this array.
const DEFAULT_AGENTS = [
  {
    id: 'a1', name: 'Deep Work Coach', icon: '🧠', area: 'deep_work',
    score: 80, runs: 0, streak: 0,
    prompt: 'You are my deep work coach. Help me protect focus blocks, avoid distraction, and make progress on my most important work each day. Suggest one concrete deep work session per day in 15-min blocks. Be direct and encouraging.',
    custom_prompt: null, output: '', alert: '', status: 'idle',
  },
  {
    id: 'a2', name: 'Relationship Pulse', icon: '🤝', area: 'relationships',
    score: 70, runs: 0, streak: 0,
    prompt: 'You are my relationship steward. Suggest one meaningful touchpoint per day — a message, call, or shared activity — under 20 min. Flag if I have gone several days without social contact.',
    custom_prompt: null, output: '', alert: '', status: 'idle',
  },
  {
    id: 'a3', name: 'Learning Curator', icon: '📚', area: 'learning',
    score: 75, runs: 0, streak: 0,
    prompt: 'You are my learning strategist. Build spaced-repetition study plans in 15-min blocks. Ask me what I am currently learning and suggest one concept to work on today.',
    custom_prompt: null, output: '', alert: '', status: 'idle',
  },
]

export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabaseAdmin.from('agents').select('*').eq('user_id', session.user.email)
  if (!data || data.length === 0) {
    // Seed defaults
    const seeds = DEFAULT_AGENTS.map(a => ({ ...a, user_id: session.user.email }))
    await supabaseAdmin.from('agents').insert(seeds)
    return Response.json({ agents: DEFAULT_AGENTS })
  }
  return Response.json({ agents: data })
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const userId = session.user.email

  // ── Bulk create from onboarding ─────────────────────────────────────────────
  if (body.agents && Array.isArray(body.agents)) {
    const { agents, replace_defaults, merge_mode } = body
    if (replace_defaults && !merge_mode) {
      // Remove any existing default/seeded agents before inserting onboarding ones
      await supabaseAdmin.from('agents').delete().eq('user_id', userId)
    }
    const rows = agents.map(a => ({ ...a, user_id: userId }))
    const { error } = await supabaseAdmin.from('agents').insert(rows)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true, count: rows.length })
  }

  // ── Run a single agent ───────────────────────────────────────────────────────
  const { agentId, silent } = body

  const { data: agentRow } = await supabaseAdmin.from('agents').select('*').eq('id', agentId).eq('user_id', userId).single()
  if (!agentRow) return Response.json({ error: 'Agent not found' }, { status: 404 })

  const tasks = (await supabaseAdmin.from('tasks').select('*').eq('user_id', userId).eq('date', todayKey())).data || []

  // Pull agent context (uploaded voice memos, files, notes)
  const { data: contextRows } = await supabaseAdmin
    .from('agent_context')
    .select('content, source_type, filename, created_at')
    .eq('user_id', userId)
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(5)

  const agentContext = contextRows?.length
    ? '\n\nCONTEXT FROM UPLOADED MATERIALS:\n' + contextRows.map(r =>
        `[${r.source_type?.toUpperCase()} — ${r.filename} — ${new Date(r.created_at).toLocaleDateString()}]\n${r.content?.slice(0, 1000)}`
      ).join('\n\n')
    : ''

  // Augment agent prompt with context
  const augmentedAgent = agentContext
    ? { ...agentRow, prompt: (agentRow.custom_prompt || agentRow.prompt) + agentContext }
    : agentRow

  // Mark thinking
  await supabaseAdmin.from('agents').update({ status: 'thinking' }).eq('id', agentId).eq('user_id', userId)

  const result = await runAgentBrief({ agent: augmentedAgent, tasks, isSilent: silent })

  const updates = {
    status: result.urgent ? 'alert' : 'ok',
    output: result.output,
    alert: result.alert || '',
    runs: (agentRow.runs || 0) + 1,
    score: Math.min(99, (agentRow.score || 50) + 1),
    last_run: new Date().toISOString(),
  }

  await supabaseAdmin.from('agents').update(updates).eq('id', agentId).eq('user_id', userId)
  return Response.json({ result: updates })
}

export async function PATCH(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, ...updates } = await req.json()
  await supabaseAdmin.from('agents').update(updates).eq('id', id).eq('user_id', session.user.email)
  return Response.json({ ok: true })
}
