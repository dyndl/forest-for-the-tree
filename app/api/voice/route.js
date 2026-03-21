import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/voice — receives raw audio blob from browser MediaRecorder
// Client sends: { audio_base64, mime_type, agent_id, context, duration }
export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { audio_base64, mime_type, agent_id, context, duration } = await req.json()
  if (!audio_base64) return Response.json({ error: 'No audio data' }, { status: 400 })

  const buffer = Buffer.from(audio_base64, 'base64')
  const filename = `voice_memo_${Date.now()}.webm`

  // Forward to media handler logic
  const formData = new FormData()
  formData.append('file', new Blob([buffer], { type: mime_type || 'audio/webm' }), filename)
  formData.append('type', 'audio')
  formData.append('agent_id', agent_id || '')
  formData.append('context', context || 'Live voice memo')

  // Call internal media route
  const origin = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const mediaRes = await fetch(`${origin}/api/media`, {
    method: 'POST',
    headers: { Cookie: req.headers.get('cookie') || '' },
    body: formData,
  })

  return mediaRes
}
