import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { supabaseAdmin } from '@/lib/supabase'
import { runAgentBrief } from '@/lib/coo'

function todayKey() { return new Date().toISOString().slice(0, 10) }

const DEFAULT_AGENTS = [
  { id: 'a1', name: 'Career COO', icon: '🎯', area: 'career', score: 82, runs: 0, streak: 0, prompt: 'You are my ADHD-aware career COO. Goal: land an ML-heavy Data Science role in 4 weeks. Give prioritized, time-blocked daily actions in 15-min increments. Flag procrastination patterns. Be direct and warm.', customPrompt: null, output: '', alert: '', status: 'idle' },
  { id: 'a2', name: 'Interview Coach', icon: '🧠', area: 'interview', score: 91, runs: 0, streak: 0, prompt: 'You are my senior DS/ML interview coach. Focus: XGBoost for time-series vs classification, fraud detection, Python algorithms (LeetCode easy/medium). Drill plans, explain-to-interviewer templates, fintech ML pitfalls.', customPrompt: null, output: '', alert: '', status: 'idle' },
  { id: 'a3', name: 'Fitness Pacer', icon: '⚡', area: 'fitness', score: 67, runs: 0, streak: 0, prompt: 'You are my fitness coach. Suggest one micro-workout per day in a 15-min block — ADHD-friendly, varied, quick wins. Track streaks. Motivate without guilt.', customPrompt: null, output: '', alert: '', status: 'idle' },
  { id: 'a4', name: 'Relationship Pulse', icon: '🤝', area: 'family', score: 74, runs: 0, streak: 0, prompt: 'You are my relationship steward. Suggest one meaningful touchpoint per day — text, call, or shared activity — under 20 min. Flag if I have gone 2+ days without social contact.', customPrompt: null, output: '', alert: '', status: 'idle' },
  { id: 'a5', name: 'Finance Tracker', icon: '💰', area: 'finance', score: 58, runs: 0, streak: 0, prompt: 'You are my personal finance COO. Budget: $60/mo tools + $20 buffer. Track spending, flag overages, suggest savings. Weekly summaries in plain numbers.', customPrompt: null, output: '', alert: '', status: 'idle' },
  { id: 'a6', name: 'Learning Curator', icon: '📚', area: 'learning', score: 79, runs: 0, streak: 0, prompt: 'You are my learning strategist. Build spaced-repetition study plans in 15-min blocks. Current focus: XGBoost, time-series, Python algorithms. Suggest one concept to master today.', customPrompt: null, output: '', alert: '', status: 'idle' },
  { id: 'a7', name: 'Music Mentor', icon: '🎵', area: 'music', score: 50, runs: 0, streak: 0, prompt: 'You are my music mentor and producer. I have a backlog of voice memo brainstorms. Help me develop raw ideas into songs, beats, or compositions. Extract the emotional core, suggest chord progressions or production directions, identify lyric fragments, and give one concrete next action under 15 minutes. Be direct, creative, and specific.', customPrompt: null, output: '', alert: '', status: 'idle' },
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

  const { agentId, silent } = await req.json()
  const userId = session.user.email

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
    ? { ...agentRow, prompt: (agentRow.customPrompt || agentRow.prompt) + agentContext }
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
