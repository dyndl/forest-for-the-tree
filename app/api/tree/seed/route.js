import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { supabaseAdmin } from '@/lib/supabase-admin'

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'
const NOW = new Date().getFullYear()

/**
 * POST /api/tree/seed
 *
 * One-time seeder: parses the user's career outline + relationship_seeds
 * and populates tree_branches, tree_rings, tree_roots, tree_relationships,
 * and tree_legacies from Claude's analysis.
 *
 * Body: { force? }  — force=true re-seeds even if branches already exist
 */
export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.email
  const body = await req.json().catch(() => ({}))
  const force = body.force

  // Skip if already seeded unless forced
  if (!force) {
    const { data: existing } = await supabaseAdmin
      .from('tree_branches')
      .select('id')
      .eq('user_id', userId)
      .limit(1)
    if (existing?.length) return Response.json({ skipped: true, reason: 'already seeded' })
  }

  // Fetch user context
  const { data: ctx } = await supabaseAdmin
    .from('user_context')
    .select('outline, roadmap, life_areas, relationship_seeds, coo_notes')
    .eq('user_id', userId)
    .maybeSingle()

  const outline = body.outline || ctx?.outline || ctx?.coo_notes || ''
  const roadmap = ctx?.roadmap || ''
  const relSeeds = body.relationship_seeds || ctx?.relationship_seeds || ''
  const lifeAreas = Array.isArray(ctx?.life_areas)
    ? ctx.life_areas.map(a => a.label || a).join(', ')
    : ''

  if (!outline && !relSeeds) return Response.json({ skipped: true, reason: 'no_context', debug: { outline_chars: 0, relseeds_chars: 0, has_coo_notes: !!(ctx?.coo_notes) } })

  // Fetch birth year from tree_species
  const { data: sp } = await supabaseAdmin
    .from('tree_species')
    .select('birth_year')
    .eq('user_id', userId)
    .maybeSingle()
  const birthYear = sp?.birth_year || NOW - 30

  const prompt = `You are building the Life Tree for a user. Analyze their background and extract structured data for their tree visualization.

USER BACKGROUND:
${outline.slice(0, 4000)}

4-WEEK GOAL: ${roadmap || 'not set'}
LIFE AREAS: ${lifeAreas || 'not specified'}
KEY RELATIONSHIPS TO SEED: ${relSeeds || 'none provided'}
CURRENT YEAR: ${NOW}
BIRTH YEAR (approx): ${birthYear}

Extract and return JSON with these exact keys. All years must be integers between ${birthYear} and ${NOW}.

1. branches (3–8 items): Major career/life phases
   { label: string (2-4 words), start_year: int, end_year: int|null (null if current), side: 1 or -1 (alternate), state: "growing"|"done"|"dormant"|"stunted", depth_factor: 0.5–2.5 }

2. rings (one per year, key years only, 4–12 items): Life chapter milestones
   { year: int, chapter: string (1-4 words), score: 1–5, ring_width: 3–18 }

3. roots (2–5 items): Core values, foundational habits, or formative experiences
   { label: string (2-4 words), side: 1 or -1, years_ago: int (1–${NOW - birthYear}), origin_year: int, angle: 25–75, depth_factor: 0.5–2.0, score: 1–5 }

4. relationships (2–4 items): Key people from relationship seeds or outline
   { name: string (first name only), side: "left" or "right", score: 1–5 (1=distant, 5=close) }

5. legacies (1–3 items): Long-term visions or contributions the user is building toward
   { label: string (2-4 words), side: 1 or -1 }

Respond ONLY with valid JSON:
{
  "branches": [...],
  "rings": [...],
  "roots": [...],
  "relationships": [...],
  "legacies": [...]
}`

  const res = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  let parsed
  try {
    const data = await res.json()
    const raw = data.content?.map(c => c.text || '').join('') || ''
    parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
  } catch {
    return Response.json({ error: 'Failed to parse seed data' }, { status: 500 })
  }

  // Clear existing data if forcing
  if (force) {
    await Promise.all([
      supabaseAdmin.from('tree_branches').delete().eq('user_id', userId),
      supabaseAdmin.from('tree_rings').delete().eq('user_id', userId),
      supabaseAdmin.from('tree_roots').delete().eq('user_id', userId),
      supabaseAdmin.from('tree_relationships').delete().eq('user_id', userId),
      supabaseAdmin.from('tree_legacies').delete().eq('user_id', userId),
    ])
  }

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
  const yr = (v) => clamp(parseInt(v) || NOW, birthYear, NOW)

  const branches = (parsed.branches || []).map(b => ({
    user_id: userId,
    label: String(b.label || '').slice(0, 80),
    start_year: yr(b.start_year),
    end_year: b.end_year ? yr(b.end_year) : null,
    side: b.side === -1 ? -1 : 1,
    state: ['growing','done','dormant','stunted','pruned'].includes(b.state) ? b.state : 'growing',
    depth_factor: clamp(parseFloat(b.depth_factor) || 1, 0.5, 2.5),
  }))

  const rings = (parsed.rings || []).map(r => ({
    user_id: userId,
    year: yr(r.year),
    chapter: String(r.chapter || '').slice(0, 60),
    score: clamp(parseInt(r.score) || 3, 1, 5),
    ring_width: clamp(parseFloat(r.ring_width) || 8, 3, 18),
  }))

  const roots = (parsed.roots || []).map(r => ({
    user_id: userId,
    label: String(r.label || '').slice(0, 80),
    side: r.side === -1 ? -1 : 1,
    years_ago: clamp(parseInt(r.years_ago) || 5, 1, NOW - birthYear),
    origin_year: yr(r.origin_year),
    angle: clamp(parseFloat(r.angle) || 45, 25, 75),
    depth_factor: clamp(parseFloat(r.depth_factor) || 1, 0.5, 2.0),
    score: clamp(parseInt(r.score) || 3, 1, 5),
  }))

  const relationships = (parsed.relationships || []).map(r => ({
    user_id: userId,
    name: String(r.name || '').slice(0, 50),
    side: r.side === 'left' ? 'left' : 'right',
    score: clamp(parseInt(r.score) || 3, 1, 5),
  }))

  const legacies = (parsed.legacies || []).map(l => ({
    user_id: userId,
    label: String(l.label || '').slice(0, 80),
    side: l.side === -1 ? -1 : 1,
  }))

  const results = await Promise.all([
    branches.length ? supabaseAdmin.from('tree_branches').insert(branches) : null,
    rings.length ? supabaseAdmin.from('tree_rings').insert(rings) : null,
    roots.length ? supabaseAdmin.from('tree_roots').insert(roots) : null,
    relationships.length ? supabaseAdmin.from('tree_relationships').insert(relationships) : null,
    legacies.length ? supabaseAdmin.from('tree_legacies').insert(legacies) : null,
  ])

  const errors = results.filter(Boolean).map(r => r.error).filter(Boolean)
  if (errors.length) {
    console.error('tree/seed errors:', errors)
  }

  return Response.json({
    ok: true,
    seeded: {
      branches: branches.length,
      rings: rings.length,
      roots: roots.length,
      relationships: relationships.length,
      legacies: legacies.length,
    },
    debug: { outline_chars: outline.length, relseeds_chars: relSeeds.length, insert_errors: errors.length },
  })
}
