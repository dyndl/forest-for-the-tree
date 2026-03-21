import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ── TRANSCRIBE ───────────────────────────────────────────────────────────────
// Priority: user's Whisper key → app Deepgram key → app Whisper key
// Size caps used as duration proxy (phone M4A ≈ 1–1.5 MB/min):
//   Deepgram: 4 min → 6 MB cap
//   Whisper:  1 min → 1.5 MB cap
const DEEPGRAM_MAX_MB = 6    // ≈ 4 min
const WHISPER_MAX_MB  = 1.5  // ≈ 1 min

async function transcribeAudio(buffer, mimeType, filename, userId) {
  const sizeMB = buffer.length / (1024 * 1024)

  // Check if user has their own OpenAI key (Whisper addon)
  if (userId) {
    const { data } = await supabaseAdmin.from('user_context').select('openai_api_key').eq('user_id', userId).single()
    if (data?.openai_api_key) {
      if (sizeMB > WHISPER_MAX_MB) throw new Error(`Whisper clips are capped at ~1 min. Use Deepgram for up to 4 min.`)
      return transcribeWhisper(buffer, mimeType, filename, data.openai_api_key)
    }
  }

  // App-level Deepgram (free tier — recommended default, 4-min cap)
  if (process.env.DEEPGRAM_API_KEY) {
    if (sizeMB > DEEPGRAM_MAX_MB) throw new Error(`Voice clips are capped at 4 minutes. Please trim and try again.`)
    return transcribeDeepgram(buffer, mimeType, filename, userId)
  }

  // Fallback: app-level Whisper key
  if (process.env.OPENAI_API_KEY) {
    if (sizeMB > WHISPER_MAX_MB) throw new Error(`Whisper clips are capped at ~1 min. Use Deepgram for up to 4 min.`)
    return transcribeWhisper(buffer, mimeType, filename, process.env.OPENAI_API_KEY)
  }

  throw new Error('No transcription service configured')
}

// Domain-specific keyterms for Nova-3 keyterm prompting — improves accuracy
// for vocabulary the COO and agents use constantly
const BASE_KEYTERMS = [
  // App brand + COO operations
  'forest for the tree', 'forest brief', 'morning brief', 'evening retro', 'weekly retro',
  // Tree metaphor vocabulary
  'deep roots', 'canopy', 'seedling', 'prune', 'growing season', 'dormant', 'branch', 'forest floor',
  // Hardware + scores
  'Oura', 'ring score',
  // Existing high-value terms
  'Eisenhower matrix', 'COO', 'readiness score', 'deep work', 'focus block',
  'cognitive load', 'life areas', 'adhd', 'hyperfocus', 'context switching',
  'task initiation', 'decision fatigue', 'time block', 'energy level',
]

async function transcribeDeepgram(buffer, mimeType, filename, userId) {
  // Merge base keyterms with any the COO has learned for this user
  let userKeyterms = []
  if (userId) {
    const { data } = await supabaseAdmin.from('user_context').select('voice_keyterms').eq('user_id', userId).single()
    userKeyterms = data?.voice_keyterms || []
  }
  const allKeyterms = [...new Set([...BASE_KEYTERMS, ...userKeyterms])]
    .slice(0, 100) // Deepgram cap
    .map(t => `keyterm=${encodeURIComponent(t)}`).join('&')

  const params = [
    'model=nova-3',
    'smart_format=true',
    'punctuate=true',
    'utterances=true',
    'dictation=true',   // "new line", "period" etc. format correctly
    'numerals=true',    // "three pm" → "3pm", "five tasks" → "5 tasks"
    'language=en',
    allKeyterms,
  ].join('&')

  const res = await fetch(
    `https://api.deepgram.com/v1/listen?${params}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
        'Content-Type': mimeType || 'audio/m4a',
      },
      body: buffer,
    }
  )

  if (!res.ok) throw new Error(`Deepgram error: ${await res.text()}`)

  const json = await res.json()
  const channel = json.results?.channels?.[0]?.alternatives?.[0]
  const words = channel?.words || []

  // Normalise to same shape as Whisper verbose_json
  return {
    text: channel?.transcript || '',
    duration: json.metadata?.duration || 0,
    segments: words.reduce((segs, w) => {
      const last = segs[segs.length - 1]
      if (last && w.start - last.end < 1.5) {
        last.text += ' ' + w.word
        last.end = w.end
      } else {
        segs.push({ start: Math.round(w.start), end: Math.round(w.end), text: w.word })
      }
      return segs
    }, []),
    provider: 'deepgram',
  }
}

async function transcribeWhisper(buffer, mimeType, filename, apiKey) {
  const formData = new FormData()
  const blob = new Blob([buffer], { type: mimeType })
  formData.append('file', blob, filename || 'audio.m4a')
  formData.append('model', 'whisper-1')
  formData.append('response_format', 'verbose_json')
  formData.append('language', 'en')

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  })

  if (!res.ok) throw new Error(`Whisper error: ${await res.text()}`)

  const json = await res.json()
  return { ...json, provider: 'whisper' }
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
      const whisperResult = await transcribeAudio(buffer, mimeType, filename, userId)
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
