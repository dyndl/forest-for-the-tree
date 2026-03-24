import { getServerSession } from 'next-auth'
import { authOptions } from '../[...nextauth]/route'
export const dynamic = 'force-dynamic'

// GET /api/auth/link-account?label=Work
// Returns a Google OAuth URL for linking a secondary account (calendar only)
export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const label = new URL(req.url).searchParams.get('label') || 'Secondary'
  const state = Buffer.from(JSON.stringify({ userId: session.user.email, label })).toString('base64')

  const base = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${base}/api/auth/link-account/callback`,
    response_type: 'code',
    scope: [
      'openid', 'email', 'profile',
      'https://www.googleapis.com/auth/calendar.events',
    ].join(' '),
    access_type: 'offline',
    prompt: 'consent select_account',
    state,
  })

  return Response.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` })
}

// DELETE /api/auth/link-account  { email }
// Remove a linked account
export async function DELETE(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.email
  const { email } = await req.json()

  const { supabaseAdmin } = await import('@/lib/supabase-admin')
  const { data: ctx } = await supabaseAdmin.from('user_context').select('linked_accounts').eq('user_id', userId).maybeSingle()
  const linked = (ctx?.linked_accounts || []).filter(a => a.email !== email)
  await supabaseAdmin.from('user_context').update({ linked_accounts: linked }).eq('user_id', userId)
  return Response.json({ linked_accounts: linked })
}
