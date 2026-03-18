import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ── POST /api/onboarding/generate-agents ─────────────────────────────────────
// Accepts: { outline: string, life_areas: array, roadmap: string }
// Returns: { agents: array } — personalised agents derived from the user's outline
export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { outline, life_areas = [], roadmap = '' } = await req.json()
  if (!outline?.trim()) return Response.json({ error: 'No outline provided' }, { status: 400 })

  const areaNames = life_areas.map(a => `${a.emoji} ${a.label}`).join(', ') || 'not specified'

  const prompt = `You are helping a new user set up their autonomous life COO app.

The user has written a personal outline describing their life, goals, priorities, and patterns.
Your job is to read it carefully and generate a set of focused autonomous agents that will help them.

USER'S OUTLINE:
---
${outline.slice(0, 4000)}
---

THEIR 4-WEEK GOAL: ${roadmap || 'not specified'}
THEIR LIFE AREAS: ${areaNames}

Generate between 3 and 7 agents. Each agent should:
- Cover a distinct area of their life mentioned in the outline
- Have a system prompt tailored to their specific context, goals, and patterns
- Be actionable and concrete — not generic
- Reference their specific situation where relevant

Respond ONLY with valid JSON — no preamble, no markdown fences:
{
  "agents": [
    {
      "id": "a1",
      "name": "Short agent name (2-3 words max)",
      "icon": "single emoji",
      "area": "matching life area key or a short new key (snake_case)",
      "prompt": "You are [role]. [2-4 sentences of specific, personalised system prompt based on the user's outline. Reference their actual goals, patterns, and context.]",
      "rationale": "One sentence explaining why this agent is useful for this specific person."
    }
  ]
}`

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
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const data = await res.json()
  const raw = data.content?.map(c => c.text || '').join('') || ''

  try {
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
    const agents = (parsed.agents || []).map((a, i) => ({
      ...a,
      id: `onboarding_${Date.now()}_${i}`,
      score: 75,
      runs: 0,
      streak: 0,
      customPrompt: null,
      output: '',
      alert: '',
      status: 'idle',
    }))
    return Response.json({ agents })
  } catch {
    return Response.json({ error: 'Failed to parse agent suggestions', raw }, { status: 500 })
  }
}
