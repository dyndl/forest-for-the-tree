import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getRelationshipContacts, getUpcomingBirthdays, getOverdueContacts, updateContactLastContact } from '@/lib/google'
import { generateRelationshipBrief } from '@/lib/coo'
export const dynamic = 'force-dynamic'

export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const refresh = new URL(req.url).searchParams.get('refresh') === 'true'
  const userId = session.user.email

  if (!refresh) {
    const { data: cached } = await supabaseAdmin.from('relationship_cache').select('*').eq('user_id', userId).single()
    if (cached?.updated_at && Date.now() - new Date(cached.updated_at).getTime() < 6 * 60 * 60 * 1000) {
      return Response.json({ contacts: cached.contacts, overdue: cached.overdue, birthdays: cached.birthdays, cached: true })
    }
  }

  const contacts = await getRelationshipContacts(session.accessToken, session.refreshToken)
  const overdue = getOverdueContacts(contacts)
  const birthdays = getUpcomingBirthdays(contacts)

  await supabaseAdmin.from('relationship_cache').upsert(
    { user_id: userId, contacts, overdue, birthdays, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  )

  return Response.json({ contacts, overdue, birthdays, cached: false })
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { type, userMessage, resourceName, weekly } = await req.json()
  const userId = session.user.email

  if (type === 'mark_contacted' && resourceName) {
    const ok = await updateContactLastContact(session.accessToken, session.refreshToken, resourceName)
    await supabaseAdmin.from('relationship_cache').delete().eq('user_id', userId)
    return Response.json({ ok })
  }

  const [{ data: cached }, { data: userCtx }] = await Promise.all([
    supabaseAdmin.from('relationship_cache').select('*').eq('user_id', userId).single(),
    supabaseAdmin.from('user_context').select('gemini_api_key, anthropic_api_key').eq('user_id', userId).maybeSingle(),
  ])
  const contacts = cached?.contacts || []
  const overdueContacts = cached?.overdue || getOverdueContacts(contacts)
  const upcomingBirthdays = cached?.birthdays || getUpcomingBirthdays(contacts)
  const llmKeys = {
    anthropicKey: userCtx?.anthropic_api_key || null,
    geminiKey: userCtx?.gemini_api_key || null,
  }

  const result = await generateRelationshipBrief({ contacts, overdueContacts, upcomingBirthdays, userMessage, weeklyCheckin: weekly || false, llmKeys })

  await supabaseAdmin.from('relationship_briefs').upsert(
    { user_id: userId, date: new Date().toISOString().slice(0,10), brief: result, weekly: weekly||false, created_at: new Date().toISOString() },
    { onConflict: 'user_id,date' }
  )

  return Response.json({ result })
}
