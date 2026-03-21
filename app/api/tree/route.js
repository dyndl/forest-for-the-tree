import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { galleryPoolForSpecies, pickDisplaySlug, resolveCatalogRow } from '@/lib/tree-display'

const DEFAULT_SPECIES = {
  birth_year: 1990,
  current_tier: 1,
  species_name: 'Bonsai',
  species_slug: 'bonsai',
  species_emoji: '🌿',
}

/**
 * GET /api/tree — tree data + display_slug (same-species gallery for rotate mode).
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.email

  const [{ data: catalog, error: catErr }, ctxRes] = await Promise.all([
    supabaseAdmin
      .from('tree_species_catalog')
      .select('tier,name,emoji,slug,tier_group,group_name')
      .order('tier', { ascending: true }),
    supabaseAdmin
      .from('user_context')
      .select('tree_bg_mode, tree_gallery_by_slug')
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  if (catErr) {
    return Response.json({ error: catErr.message }, { status: 500 })
  }

  const catalogRows = catalog || []
  const ctx = ctxRes.data || {}
  const mode = ctx.tree_bg_mode === 'rotate_load' ? 'rotate_load' : 'sticky'
  const galleryBySlug =
    ctx.tree_gallery_by_slug && typeof ctx.tree_gallery_by_slug === 'object' ? ctx.tree_gallery_by_slug : {}

  let { data: species, error: speciesError } = await supabaseAdmin
    .from('tree_species')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (speciesError) {
    return Response.json({ error: speciesError.message }, { status: 500 })
  }

  if (!species) {
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('tree_species')
      .insert({ user_id: userId, ...DEFAULT_SPECIES })
      .select('*')
      .single()

    if (insertError) {
      return Response.json({ error: insertError.message }, { status: 500 })
    }
    species = inserted
  }

  const milestone = resolveCatalogRow(catalogRows, species.current_tier)
  const milestoneTier = milestone?.tier ?? species.current_tier
  const milestoneSlug = milestone?.slug ?? species.species_slug

  const display_slug = pickDisplaySlug({
    mode,
    speciesSlug: species.species_slug,
    milestoneSlug,
    galleryBySlug,
  })

  const gallery_pool = galleryPoolForSpecies(milestoneSlug, galleryBySlug)
  const past_milestones = milestone
    ? catalogRows.filter((c) => c.tier <= milestone.tier).sort((a, b) => a.tier - b.tier)
    : []

  const speciesOut = { ...species, display_slug }

  const [br, rt, rg, re, lg] = await Promise.all([
    supabaseAdmin.from('tree_branches').select('*, tree_fruits(*)').eq('user_id', userId),
    supabaseAdmin.from('tree_roots').select('*').eq('user_id', userId),
    supabaseAdmin.from('tree_rings').select('*').eq('user_id', userId).order('year', { ascending: false }),
    supabaseAdmin.from('tree_relationships').select('*').eq('user_id', userId),
    supabaseAdmin.from('tree_legacies').select('*').eq('user_id', userId),
  ])

  const errors = [br.error, rt.error, rg.error, re.error, lg.error].filter(Boolean)
  if (errors.length) {
    return Response.json({ error: errors[0].message }, { status: 500 })
  }

  return Response.json({
    species: speciesOut,
    tree_bg_mode: mode,
    milestone_tier: milestoneTier,
    milestone_slug: milestoneSlug,
    gallery_pool,
    tree_gallery_by_slug: galleryBySlug,
    past_milestones,
    branches: (br.data || []).map((b) => ({ ...b, fruits: b.tree_fruits || [] })),
    roots: rt.data || [],
    rings: rg.data || [],
    relationships: re.data || [],
    legacies: lg.data || [],
  })
}
