import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getImportantEmails, archiveEmails } from '@/lib/google'

export const dynamic = 'force-dynamic'

export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: token } = await supabaseAdmin.from('user_tokens').select('access_token,refresh_token').eq('user_id', session.user.email).maybeSingle()
  if (!token?.access_token) return Response.json({ emails: [], grouped: {}, counts: {}, total: 0 })
  const emails = await getImportantEmails(token.access_token, token.refresh_token)
  const grouped = emails.reduce((acc, e) => { if (!acc[e.category]) acc[e.category] = []; acc[e.category].push(e); return acc }, {})
  return Response.json({ emails, grouped, counts: Object.fromEntries(Object.entries(grouped).map(([k, v]) => [k, v.length])), total: emails.length })
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { action, messageIds } = await req.json()
  if (action !== 'archive' || !messageIds?.length) return Response.json({ error: 'Invalid request' }, { status: 400 })
  const { data: token } = await supabaseAdmin.from('user_tokens').select('access_token,refresh_token').eq('user_id', session.user.email).maybeSingle()
  if (!token?.access_token) return Response.json({ error: 'No token' }, { status: 401 })
  const result = await archiveEmails(token.access_token, token.refresh_token, messageIds)
  return Response.json(result)
}
