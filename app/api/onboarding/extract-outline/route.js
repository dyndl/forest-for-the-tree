import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ── POST /api/onboarding/extract-outline ─────────────────────────────────────
// Accepts: multipart form with a .txt, .md, .pdf, or image file
// Returns: { text: string } — extracted plain text for the outline field
export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file')
  if (!file) return Response.json({ error: 'No file provided' }, { status: 400 })

  const filename = file.name || 'upload'
  const mimeType = file.type || 'application/octet-stream'
  const buffer = Buffer.from(await file.arrayBuffer())
  const sizeMB = buffer.length / (1024 * 1024)

  if (sizeMB > 10) return Response.json({ error: 'File too large (max 10 MB)' }, { status: 400 })

  const isText  = mimeType.startsWith('text/') || /\.(txt|md)$/i.test(filename)
  const isPDF   = mimeType === 'application/pdf' || filename.endsWith('.pdf')
  const isImage = mimeType.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(filename)

  if (!isText && !isPDF && !isImage) {
    return Response.json({ error: 'Only .txt, .md, .pdf, and image files are supported' }, { status: 400 })
  }

  // Plain text — return directly
  if (isText) {
    const text = buffer.toString('utf-8').slice(0, 8000)
    return Response.json({ text })
  }

  const base64 = buffer.toString('base64')

  // Image — extract via Claude vision
  if (isImage) {
    const imgMime = ['image/jpeg','image/png','image/gif','image/webp'].includes(mimeType) ? mimeType : 'image/png'
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: imgMime, data: base64 } },
            { type: 'text', text: 'This is a screenshot of an outline or notes. Extract all the text and structure faithfully as plain text — preserve headings, lists, and hierarchy. Return only the extracted content, no preamble.' },
          ],
        }],
      }),
    })
    const json = await res.json()
    const text = json.content?.map(c => c.text || '').join('') || ''
    return Response.json({ text: text.slice(0, 8000) })
  }

  // PDF — extract via Claude document API
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
          { type: 'text', text: 'Extract the full text content of this document as plain text. Preserve structure where meaningful (headings, lists). Remove page numbers, headers/footers. Return only the extracted text — no preamble.' },
        ],
      }],
    }),
  })

  const data = await res.json()
  const text = data.content?.map(c => c.text || '').join('') || ''
  return Response.json({ text: text.slice(0, 8000) })
}
