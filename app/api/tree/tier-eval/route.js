import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { supabaseAdmin } from '@/lib/supabase-admin'

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'

/**
 * POST /api/tree/tier-eval
 *
 * Evaluates a user's career/life context against the species catalog and sets
 * their starting tree tier. Designed to run once after onboarding completes.
 *
 * Body: { outline?, roadmap?, life_areas?, force? }
 *   force=true re-evaluates even if tier > 1 (default: skip if already evaluated)
 */
export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.email
  const body = await req.json().catch(() => ({}))

  // Fetch existing tree + catalog + user context in parallel
  const [speciesRes, catalogRes, ctxRes] = await Promise.all([
    supabaseAdmin.from('tree_species').select('*').eq('user_id', userId).maybeSingle(),
    supabaseAdmin.from('tree_species_catalog').select('tier,name,slug,emoji,group_name,tier_group').order('tier', { ascending: true }),
    supabaseAdmin.from('user_context').select('outline,roadmap,life_areas,coo_notes').eq('user_id', userId).maybeSingle(),
  ])

  const species = speciesRes.data
  const catalog = catalogRes.data || []
  const ctx = ctxRes.data || {}

  // Skip if already evaluated (tier > 1) unless forced
  if (!body.force && species && species.current_tier > 1) {
    const row = catalog.find(c => c.tier === species.current_tier) || catalog[0]
    return Response.json({ tier: species.current_tier, catalog_row: row, skipped: true })
  }

  // Use passed data or fall back to saved context
  const outline = body.outline || ctx.outline || ''
  const roadmap = body.roadmap || ctx.roadmap || ''
  const lifeAreas = body.life_areas || ctx.life_areas || []
  const additionalContext = (body.additional_context || '').trim()

  // Persist additional context into user_context.coo_notes so future evals see it
  if (additionalContext) {
    const existing = ctx.coo_notes || ''
    const merged = existing
      ? `${existing}\n\n[User-added context for tier evaluation]\n${additionalContext}`
      : `[User-added context for tier evaluation]\n${additionalContext}`
    await supabaseAdmin.from('user_context')
      .update({ coo_notes: merged })
      .eq('user_id', userId)
  }

  if (!outline && !roadmap && !additionalContext) {
    return Response.json({ error: 'No context to evaluate', skipped: true })
  }

  if (!catalog.length) {
    return Response.json({ error: 'No catalog available', skipped: true })
  }

  // Build a concise catalog summary for Claude
  const minTier = catalog[0].tier
  const maxTier = catalog[catalog.length - 1].tier
  const groups = {}
  catalog.forEach(c => {
    if (!groups[c.tier_group]) groups[c.tier_group] = { name: c.group_name, min: c.tier, max: c.tier }
    groups[c.tier_group].max = Math.max(groups[c.tier_group].max, c.tier)
    groups[c.tier_group].min = Math.min(groups[c.tier_group].min, c.tier)
  })
  const groupSummary = Object.values(groups)
    .sort((a, b) => a.min - b.min)
    .map(g => `  Tiers ${g.min}–${g.max}: ${g.name}`)
    .join('\n')

  const prompt = `You are evaluating someone's career and life progress to set their starting tier in a life gamification system.

TIER SYSTEM (${minTier}–${maxTier}):
${groupSummary}

USER CONTEXT:
Career outline / background:
${outline.slice(0, 3000)}

Current 4-week goal: ${roadmap || 'Not set'}
Life areas: ${Array.isArray(lifeAreas) ? lifeAreas.map(a => a.label || a).join(', ') : String(lifeAreas)}${additionalContext ? `\n\nADDITIONAL CONTEXT (user-provided, treat as highly relevant):\n${additionalContext.slice(0, 2000)}` : ''}

GUIDELINES:
- Tier 1–${Math.round(maxTier * 0.1)}: Beginner, student, early exploration — just starting out
- Tier ${Math.round(maxTier * 0.1 + 1)}–${Math.round(maxTier * 0.25)}: Early career, building foundations — 1–3 years experience
- Tier ${Math.round(maxTier * 0.25 + 1)}–${Math.round(maxTier * 0.45)}: Established professional — 3–8 years, some accomplishments
- Tier ${Math.round(maxTier * 0.45 + 1)}–${Math.round(maxTier * 0.65)}: Senior practitioner — deep expertise, clear track record
- Tier ${Math.round(maxTier * 0.65 + 1)}–${Math.round(maxTier * 0.85)}: Expert / leader — recognized achievements, mentoring others
- Tier ${Math.round(maxTier * 0.85 + 1)}–${maxTier}: Master / visionary — exceptional, rare, enduring impact

Pick the single tier number (${minTier}–${maxTier}) that best represents where this person is TODAY based on their background.
Be generous but honest — reflect their actual demonstrated progress, not aspirations.

Respond ONLY with JSON:
{
  "tier": <integer between ${minTier} and ${maxTier}>,
  "reason": "1-2 sentences explaining the tier choice based on specific evidence from their background"
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
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  let tier = 1
  let reason = ''
  try {
    const data = await res.json()
    const raw = data.content?.map(c => c.text || '').join('') || ''
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
    tier = Math.max(minTier, Math.min(maxTier, parseInt(parsed.tier) || 1))
    reason = parsed.reason || ''
  } catch {
    return Response.json({ error: 'Evaluation failed to parse', skipped: true })
  }

  const onlyIncrease = body.only_increase === true
  if (onlyIncrease && species && tier <= species.current_tier) {
    const row = catalog.find(c => c.tier === species.current_tier) || catalog[0]
    return Response.json({ tier: species.current_tier, catalog_row: row, skipped: true, reason: 'tier unchanged (only_increase)' })
  }

  // Find the closest catalog row at or below this tier
  const eligible = catalog.filter(c => c.tier <= tier).sort((a, b) => b.tier - a.tier)
  const catalogRow = eligible[0] || catalog[0]

  // Update (or create) tree_species with the evaluated tier
  const update = {
    user_id: userId,
    current_tier: tier,
    species_slug: catalogRow.slug,
    species_name: catalogRow.name,
    species_emoji: catalogRow.emoji,
  }

  if (!species) {
    await supabaseAdmin.from('tree_species').insert({ ...update, birth_year: new Date().getFullYear() - 10 })
  } else {
    await supabaseAdmin.from('tree_species').update(update).eq('user_id', userId)
  }

  return Response.json({ tier, reason, catalog_row: catalogRow })
}
