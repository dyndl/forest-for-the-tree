import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateTierJournal } from '@/lib/coo'

export const dynamic = 'force-dynamic'
export const maxDuration = 45

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.email
  const { data } = await supabaseAdmin.from('tier_journals').select('*')
    .eq('user_id', userId).order('created_at', { ascending: false })
  return Response.json({ journals: data || [] })
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.email
  const { from_tier, to_tier, species, emoji } = await req.json()

  // Return cached journal if already generated for this tier transition
  const { data: existing } = await supabaseAdmin.from('tier_journals')
    .select('*').eq('user_id', userId).eq('from_tier', from_tier).maybeSingle()
  if (existing) return Response.json({ journal: existing })

  // Gather materials in parallel
  const [{ data: chatLogs }, { data: recentTasks }, { data: sp }, { data: userCtx }] = await Promise.all([
    supabaseAdmin.from('chat_logs').select('role, content, created_at')
      .eq('user_id', userId).eq('tier_at', from_tier)
      .order('created_at', { ascending: true }).limit(50),
    supabaseAdmin.from('tasks').select('name, blocks, cat, done, created_at')
      .eq('user_id', userId).eq('done', true)
      .order('created_at', { ascending: false }).limit(50),
    supabaseAdmin.from('tree_species').select('longest_streak, current_streak').eq('user_id', userId).maybeSingle(),
    supabaseAdmin.from('user_context').select('gemini_api_key, anthropic_api_key').eq('user_id', userId).maybeSingle(),
  ])
  const llmKeys = {
    anthropicKey: userCtx?.anthropic_api_key || null,
    geminiKey: userCtx?.gemini_api_key || null,
  }

  const stats = {
    tasks_done: recentTasks?.length || 0,
    peak_streak: sp?.longest_streak || 0,
  }

  const journal = await generateTierJournal({
    chatLogs: chatLogs || [],
    recentTasks: recentTasks || [],
    fromTier: from_tier,
    toTier: to_tier,
    species,
    emoji,
    stats,
  })

  if (!journal) return Response.json({ error: 'Journal generation failed' }, { status: 500 })

  const record = {
    user_id: userId,
    from_tier,
    to_tier,
    species,
    emoji,
    journal,
    stats,
    created_at: new Date().toISOString(),
  }
  await supabaseAdmin.from('tier_journals').upsert(record, { onConflict: 'user_id,from_tier' })
  return Response.json({ journal: record })
}
