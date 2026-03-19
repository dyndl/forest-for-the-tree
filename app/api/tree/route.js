import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { supabaseAdmin } from '@/lib/supabase'

const DEFAULT_SPECIES = {
  birth_year: 1990,
  current_tier: 1,
  species_name: 'Bonsai',
  species_slug: 'bonsai',
  species_emoji: '🌿',
}

/**
 * GET /api/tree — all tree visualization tables for the signed-in user (NextAuth email).
 * Ensures a starter tree_species row exists on first visit.
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.email

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
    species,
    branches: (br.data || []).map((b) => ({ ...b, fruits: b.tree_fruits || [] })),
    roots: rt.data || [],
    rings: rg.data || [],
    relationships: re.data || [],
    legacies: lg.data || [],
  })
}
