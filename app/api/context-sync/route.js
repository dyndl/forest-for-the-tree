import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { readContextFile, buildContextMarkdown } from '@/lib/context-storage'
import { getFeatureFlags } from '@/lib/integrations'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ── GET /api/context-sync ─────────────────────────────────────────────────────
// Called on app load — reads the user's cloud context file and returns it.
// The client can use this to detect if the file was edited externally.
export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.email

  const [userCtx, tokenRow] = await Promise.all([
    supabaseAdmin.from('user_context').select('*').eq('user_id', userId).single().then(r => r.data),
    supabaseAdmin.from('user_tokens').select('access_token').eq('user_id', userId).single().then(r => r.data),
  ])

  if (!userCtx || !tokenRow?.access_token) {
    return Response.json({ synced: false, reason: 'no_token' })
  }

  const flags = getFeatureFlags(userCtx.integration_tier, userCtx.addons)
  if (flags.contextStorage === 'local') {
    return Response.json({ synced: false, reason: 'local_tier' })
  }

  const cloudText = await readContextFile(flags.contextStorage, tokenRow.access_token)
  if (!cloudText) {
    // File doesn't exist yet — write current context to cloud
    const { writeContextFile } = await import('@/lib/context-storage')
    await writeContextFile(flags.contextStorage, tokenRow.access_token, userCtx)
    return Response.json({ synced: true, action: 'created' })
  }

  return Response.json({ synced: true, action: 'read', content: cloudText })
}

// ── POST /api/context-sync ────────────────────────────────────────────────────
// Explicitly push current Supabase context to cloud storage.
// Called after retros, check-ins, and settings saves.
export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.email

  const [userCtx, tokenRow] = await Promise.all([
    supabaseAdmin.from('user_context').select('*').eq('user_id', userId).single().then(r => r.data),
    supabaseAdmin.from('user_tokens').select('access_token').eq('user_id', userId).single().then(r => r.data),
  ])

  if (!userCtx || !tokenRow?.access_token) {
    return Response.json({ ok: false, reason: 'no_token' })
  }

  const flags = getFeatureFlags(userCtx.integration_tier, userCtx.addons)
  if (flags.contextStorage === 'local') {
    return Response.json({ ok: false, reason: 'local_tier' })
  }

  const { writeContextFile } = await import('@/lib/context-storage')
  const ok = await writeContextFile(flags.contextStorage, tokenRow.access_token, userCtx)
  return Response.json({ ok })
}
