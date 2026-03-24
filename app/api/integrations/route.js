import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { testGoogleVoice } from '@/lib/google'
export const dynamic = 'force-dynamic'

// GET /api/integrations  — returns status for all integrations + linked accounts
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.email

  const [tokenRow, ctx] = await Promise.all([
    supabaseAdmin.from('user_tokens').select('access_token,refresh_token').eq('user_id', userId).maybeSingle().then(r => r.data),
    supabaseAdmin.from('user_context').select('linked_accounts').eq('user_id', userId).maybeSingle().then(r => r.data),
  ])

  return Response.json({
    google_connected: !!tokenRow?.access_token,
    linked_accounts: ctx?.linked_accounts || [],
  })
}

// POST /api/integrations  { action: 'test_voice' | 'test_oura' }
export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.email
  const { action } = await req.json()

  const tokenRow = await supabaseAdmin.from('user_tokens').select('access_token,refresh_token').eq('user_id', userId).maybeSingle().then(r => r.data)
  if (!tokenRow?.access_token) return Response.json({ error: 'Google not connected' }, { status: 400 })

  if (action === 'test_voice') {
    const result = await testGoogleVoice(tokenRow.access_token, tokenRow.refresh_token)
    return Response.json(result)
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 })
}
