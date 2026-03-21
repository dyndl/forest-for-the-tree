import { supabaseAdmin } from '@/lib/supabase-admin'
import { getOuraMorningContext } from '@/lib/oura'

const OURA_API = 'https://api.ouraring.com'

export const dynamic = 'force-dynamic'

// GET /api/oura/callback — Oura OAuth2 callback
export async function GET(req) {
  const base = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const stateRaw = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  if (error) {
    return Response.redirect(`${base}/onboarding?oura=denied`)
  }

  if (!code || !stateRaw) {
    return Response.redirect(`${base}/onboarding?oura=error&reason=missing_params`)
  }

  let state
  try {
    state = JSON.parse(Buffer.from(stateRaw, 'base64url').toString())
  } catch {
    return Response.redirect(`${base}/onboarding?oura=error&reason=bad_state`)
  }

  const redirectUri = `${base}/api/oura/callback`

  // Exchange code for tokens
  const tokenRes = await fetch('https://api.ouraring.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: process.env.OURA_CLIENT_ID,
      client_secret: process.env.OURA_CLIENT_SECRET,
    }),
  })

  if (!tokenRes.ok) {
    const body = await tokenRes.text()
    console.error('Oura token exchange failed:', body)
    return Response.redirect(`${base}/onboarding?oura=error&reason=token_exchange`)
  }

  const { access_token, refresh_token, expires_in } = await tokenRes.json()
  const userId = state.email

  // Fetch Oura personal info (gives us oura_user_id for webhook routing)
  const personalRes = await fetch(`${OURA_API}/v2/usercollection/personal_info`, {
    headers: { Authorization: `Bearer ${access_token}` },
  })
  const personal   = personalRes.ok ? await personalRes.json() : {}
  const ouraUserId = personal.id || null

  // Fetch initial Oura data
  const ouraData = await getOuraMorningContext(access_token).catch(() => null)

  const connectorId = 'oura_' + userId.replace(/[^a-z0-9]/g, '_')
  const expiresAt = expires_in
    ? new Date(Date.now() + expires_in * 1000).toISOString()
    : null

  await supabaseAdmin.from('connectors').upsert({
    id: connectorId,
    user_id: userId,
    name: 'Oura Ring',
    type: 'oauth',
    provider: 'oura',
    oura_user_id: ouraUserId,
    credentials: { access_token, refresh_token, expires_at: expiresAt },
    scopes: ['daily', 'heartrate', 'personal'],
    enabled: true,
    last_sync: new Date().toISOString(),
    metadata: { last_data: ouraData, cached_at: new Date().toISOString() },
    created_at: new Date().toISOString(),
  }, { onConflict: 'id,user_id' })

  // Register Oura webhook subscription (fire-and-forget)
  if (ouraUserId && process.env.OURA_WEBHOOK_SECRET) {
    const webhookBase = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    fetch(`${OURA_API}/v2/webhook/subscription`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        callback_url:       `${webhookBase}/api/webhooks/oura`,
        event_type:         'create',
        data_type:          'daily_sleep',
        verification_token: process.env.OURA_WEBHOOK_SECRET,
      }),
    }).catch(() => {}) // non-fatal
  }

  // Update energy default from readiness if available
  if (ouraData?.energy_level) {
    await supabaseAdmin.from('user_context').upsert({
      user_id: userId,
      energy_default: ouraData.energy_level,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
  }

  const returnTo = state.return_to || '/onboarding'
  const sep = returnTo.includes('?') ? '&' : '?'
  return Response.redirect(`${base}${returnTo}${sep}oura=connected`)
}
