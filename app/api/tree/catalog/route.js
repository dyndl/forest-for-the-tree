import { supabaseAdmin } from '@/lib/supabase'

/** Public species catalog for Life tree settings (no user data). */
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('tree_species_catalog')
    .select('tier,name,emoji,slug,tier_group,group_name')
    .order('tier', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ catalog: data || [] })
}
