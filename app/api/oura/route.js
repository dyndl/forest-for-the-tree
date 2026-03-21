import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getOuraMorningContext, validateOuraToken } from '@/lib/oura'

// GET — fetch latest Oura data (cached)
export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.email
  const refresh = new URL(req.url).searchParams.get('refresh') === 'true'

  // Check connector
  const { data: connector } = await supabaseAdmin
    .from('connectors')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'oura')
    .eq('enabled', true)
    .single()

  if (!connector) return Response.json({ connected: false })

  // Cache check — refresh at most once per hour
  if (!refresh && connector.metadata?.cached_at) {
    const age = Date.now() - new Date(connector.metadata.cached_at).getTime()
    if (age < 60 * 60 * 1000) {
      return Response.json({ connected: true, data: connector.metadata.last_data, cached: true })
    }
  }

  const token = connector.credentials?.access_token
  if (!token) return Response.json({ connected: false, error: 'No token stored' })

  const data = await getOuraMorningContext(token)

  // Update cache
  await supabaseAdmin.from('connectors').update({
    metadata: { ...connector.metadata, last_data: data, cached_at: new Date().toISOString() },
    last_sync: new Date().toISOString(),
    last_error: null,
  }).eq('id', connector.id).eq('user_id', userId)

  return Response.json({ connected: true, data, cached: false })
}

// POST — connect Oura (validate + store token)
export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { token } = await req.json()
  if (!token) return Response.json({ error: 'Token required' }, { status: 400 })

  const validation = await validateOuraToken(token)
  if (!validation.valid) return Response.json({ error: 'Invalid Oura token. Get yours at cloud.ouraring.com/personal-access-tokens' }, { status: 400 })

  const userId = session.user.email
  const connectorId = 'oura_' + userId.replace(/[^a-z0-9]/g, '_')

  await supabaseAdmin.from('connectors').upsert({
    id: connectorId,
    user_id: userId,
    name: 'Oura Ring',
    type: 'api_key',
    provider: 'oura',
    credentials: { access_token: token },
    scopes: ['readiness', 'sleep', 'activity'],
    enabled: true,
    last_sync: new Date().toISOString(),
    metadata: { oura_email: validation.email },
    created_at: new Date().toISOString(),
  }, { onConflict: 'id,user_id' })

  // Fetch initial data
  const data = await getOuraMorningContext(token)

  // Update user_context energy default based on current readiness
  if (data?.energy_level) {
    await supabaseAdmin.from('user_context').upsert({
      user_id: userId,
      energy_default: data.energy_level,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
  }

  return Response.json({ connected: true, data, oura_email: validation.email })
}

// DELETE — disconnect Oura
export async function DELETE(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.email
  await supabaseAdmin.from('connectors')
    .update({ enabled: false })
    .eq('user_id', userId)
    .eq('provider', 'oura')

  return Response.json({ ok: true })
}
