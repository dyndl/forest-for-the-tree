import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ── TRANSCRIBE via Whisper ───────────────────────────────────────────────────
async function transcribeAudio(buffer, mimeType, filename) {
  const formData = new FormData()
  const blob = new Blob([buffer], { type: mimeType })
  formData.append('file', blob, filename || 'audio.m4a')
  formData.append('model', 'whisper-1')
  formData.append('response_format', 'verbose_json') // includes segments + timestamps
  formData.append('language', 'en')

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: formData,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Whisper error: ${err}`)
  }

  return res.json()
}

// ── ANALYZE IMAGE via Claude ─────────────────────────────────────────────────
async function analyzeImage(buffer, mimeType, context) {
  const base64 = Buffer.from(buffer).toString('base64')
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: base64 },
          },
          {
            type: 'text',
            text: context
              ? `The user provided this context: "${context}"\n\nDescribe what you see in this image and extract any actionable information relevant to the context. Be specific and direct.`
              : 'Describe what you see in this image. Extract any text, ideas, lists, or actionable content. Be specific.',
          },
        ],
      }],
    }),
  })

  const data = await res.json()
  return data.content?.[0]?.text || ''
}

// ── POST /api/media — upload + process ──────────────────────────────────────
export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.email
  const formData = await req.formData()
  const file = formData.get('file')
  const agentId = formData.get('agent_id') || null
  const context = formData.get('context') || ''
  const type = formData.get('type') || 'auto' // 'audio' | 'image' | 'document' | 'auto'

  if (!file) return Response.json({ error: 'No file provided' }, { status: 400 })

  const filename = file.name || 'upload'
  const mimeType = file.type || 'application/octet-stream'
  const buffer = Buffer.from(await file.arrayBuffer())
  const sizeMB = buffer.length / (1024 * 1024)

  if (sizeMB > 25) return Response.json({ error: 'File too large (max 25MB)' }, { status: 400 })

  // Auto-detect type
  const isAudio = type === 'audio' || mimeType.startsWith('audio/') || /\.(m4a|mp3|wav|aac|ogg|webm|mp4)$/i.test(filename)
  const isImage = type === 'image' || mimeType.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(filename)
  const isPDF = mimeType === 'application/pdf' || filename.endsWith('.pdf')
  const isText = mimeType.startsWith('text/') || /\.(txt|md)$/i.test(filename)

  let result = {
    id: `media_${Date.now()}`,
    user_id: userId,
    filename,
    mime_type: mimeType,
    size_mb: Math.round(sizeMB * 100) / 100,
    agent_id: agentId,
    context,
    type: isAudio ? 'audio' : isImage ? 'image' : isPDF ? 'pdf' : 'document',
    transcript: null,
    analysis: null,
    extracted_ideas: [],
    created_at: new Date().toISOString(),
  }

  try {
    if (isAudio) {
      // Transcribe with Whisper
      const whisperResult = await transcribeAudio(buffer, mimeType, filename)
      result.transcript = whisperResult.text || ''
      result.duration_seconds = Math.round(whisperResult.duration || 0)
      result.segments = whisperResult.segments?.map(s => ({
        start: Math.round(s.start),
        end: Math.round(s.end),
        text: s.text.trim(),
      })) || []

      // Extract ideas from transcript via Claude
      if (result.transcript && agentId) {
        const ideaRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 800,
            messages: [{
              role: 'user',
              content: `You are a music mentor and producer analyzing a voice brainstorm recording.

TRANSCRIPT:
${result.transcript}

USER CONTEXT: ${context || 'Music brainstorm'}

Extract and organize what you hear. Respond ONLY with JSON:
{
  "title": "short evocative title for this brainstorm",
  "mood": "1-3 words describing the emotional feel",
  "genre_hints": ["genre or style hints mentioned or implied"],
  "lyric_fragments": ["any lyric ideas, phrases, or words that stood out"],
  "melodic_ideas": ["descriptions of any melodic or rhythmic ideas mentioned"],
  "production_notes": ["any production, sound, or arrangement ideas"],
  "next_actions": ["concrete next steps to develop this idea — max 3"],
  "tags": ["searchable tags for this idea"]
}`,
            }],
          }),
        })
        const ideaData = await ideaRes.json()
        const ideaText = ideaData.content?.[0]?.text || ''
        try {
          result.extracted_ideas = JSON.parse(ideaText.replace(/```json|```/g, '').trim())
        } catch {
          result.analysis = ideaText
        }
      }

    } else if (isImage) {
      result.analysis = await analyzeImage(buffer, mimeType, context)

    } else if (isPDF || isText) {
      // For PDFs and text files, extract text content
      if (isText) {
        result.transcript = buffer.toString('utf-8')
      } else {
        // PDFs need a parser — pass to Claude as document
        const base64 = buffer.toString('base64')
        const pdfRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1500,
            messages: [{
              role: 'user',
              content: [
                { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
                { type: 'text', text: context ? `Context: ${context}\n\nExtract and summarize the key content from this document.` : 'Extract and summarize the key content from this document.' },
              ],
            }],
          }),
        })
        const pdfData = await pdfRes.json()
        result.analysis = pdfData.content?.[0]?.text || ''
      }
    }

  } catch (err) {
    result.error = err.message
  }

  // Store in Supabase
  await supabaseAdmin.from('media_uploads').insert(result)

  // If linked to an agent, also append to agent context
  if (agentId && (result.transcript || result.analysis)) {
    const content = result.extracted_ideas
      ? JSON.stringify(result.extracted_ideas)
      : result.transcript || result.analysis || ''

    await supabaseAdmin.from('agent_context').upsert({
      user_id: userId,
      agent_id: agentId,
      source_type: result.type,
      source_id: result.id,
      filename,
      content: content.slice(0, 8000), // cap at 8k chars
      created_at: new Date().toISOString(),
    }, { onConflict: 'user_id,agent_id,source_id' })
  }

  return Response.json({ result })
}

// ── GET /api/media — list uploads for a user/agent ──────────────────────────
export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const agentId = url.searchParams.get('agent_id')
  const limit = parseInt(url.searchParams.get('limit') || '20')

  let query = supabaseAdmin
    .from('media_uploads')
    .select('*')
    .eq('user_id', session.user.email)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (agentId) query = query.eq('agent_id', agentId)

  const { data } = await query
  return Response.json({ uploads: data || [] })
}

// ── DELETE /api/media ─────────────────────────────────────────────────────────
export async function DELETE(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  await supabaseAdmin.from('media_uploads').delete().eq('id', id).eq('user_id', session.user.email)
  await supabaseAdmin.from('agent_context').delete().eq('source_id', id).eq('user_id', session.user.email)
  return Response.json({ ok: true })
}
