import { supabaseAdmin } from '@/lib/supabase-admin'
export const dynamic = 'force-dynamic'

// GET /api/auth/link-account/callback?code=...&state=...
// Exchanges auth code for tokens and stores in user_context.linked_accounts
export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const stateRaw = searchParams.get('state')
  const base = process.env.NEXTAUTH_URL || 'http://localhost:3000'

  if (!code || !stateRaw) return Response.redirect(`${base}/settings?link=error`)

  let userId, label
  try {
    const parsed = JSON.parse(Buffer.from(stateRaw, 'base64').toString())
    userId = parsed.userId
    label = parsed.label || 'Secondary'
  } catch {
    return Response.redirect(`${base}/settings?link=error`)
  }

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${base}/api/auth/link-account/callback`,
      grant_type: 'authorization_code',
    }),
  })
  const tokens = await tokenRes.json()
  if (!tokens.access_token) return Response.redirect(`${base}/settings?link=error`)

  // Get the account's email from Google
  const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  const profile = await profileRes.json()
  const linkedEmail = profile.email

  if (!linkedEmail) return Response.redirect(`${base}/settings?link=error`)
  if (linkedEmail === userId) return Response.redirect(`${base}/settings?link=same_account`)

  // Save to user_context.linked_accounts (upsert by email)
  const { data: ctx } = await supabaseAdmin.from('user_context').select('linked_accounts').eq('user_id', userId).maybeSingle()
  const existing = (ctx?.linked_accounts || []).filter(a => a.email !== linkedEmail)
  const linked = [...existing, {
    email: linkedEmail,
    name: profile.name || linkedEmail,
    label,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || null,
    expires_at: tokens.expires_in ? Math.floor(Date.now() / 1000) + tokens.expires_in : null,
    use_calendar: true,
  }]
  await supabaseAdmin.from('user_context').update({ linked_accounts: linked }).eq('user_id', userId)

  return Response.redirect(`${base}/settings?link=success&account=${encodeURIComponent(linkedEmail)}`)
}
