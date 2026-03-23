import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { supabaseAdmin } from '@/lib/supabase-admin'
export const dynamic = 'force-dynamic'

/**
 * Fetch the best tree/species photo from Wikipedia for a given species name.
 * Uses MediaWiki search API + pageimages to get a high-res photo URL.
 * The result is stored in tree_species_catalog.image_url (shared for all users).
 */
async function fetchWikipediaImage(name) {
  // Try multiple search queries in order of specificity
  const searches = [
    name,
    `${name} tree`,
    `${name} (tree)`,
  ]

  for (const query of searches) {
    try {
      const url =
        `https://en.wikipedia.org/w/api.php?action=query` +
        `&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=3` +
        `&prop=pageimages&pithumbsize=1200&pilimit=3` +
        `&format=json`
      const res = await fetch(url, {
        headers: { 'User-Agent': 'ForestForTheTree/1.0 (contact@datasciai.com)' },
      })
      if (!res.ok) continue
      const data = await res.json()
      const pages = data?.query?.pages
      if (!pages) continue
      // Sort by search relevance (index field)
      const sorted = Object.values(pages).sort((a, b) => (a.index ?? 99) - (b.index ?? 99))
      for (const page of sorted) {
        if (page.thumbnail?.source) return page.thumbnail.source
      }
    } catch { continue }
  }

  // Fallback: try direct REST summary endpoint
  try {
    const slug = encodeURIComponent(name.replace(/ /g, '_'))
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${slug}`, {
      headers: { 'User-Agent': 'ForestForTheTree/1.0 (contact@datasciai.com)' },
    })
    if (res.ok) {
      const data = await res.json()
      if (data.originalimage?.source) return data.originalimage.source
      if (data.thumbnail?.source) return data.thumbnail.source
    }
  } catch { }

  return null
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug, name } = await req.json()
  if (!slug || !name) return Response.json({ error: 'slug and name required' }, { status: 400 })

  // Avoid re-fetching if already cached
  const { data: existing } = await supabaseAdmin
    .from('tree_species_catalog')
    .select('image_url')
    .eq('slug', slug)
    .maybeSingle()

  if (existing?.image_url) return Response.json({ image_url: existing.image_url })

  const image_url = await fetchWikipediaImage(name)

  if (image_url) {
    await supabaseAdmin
      .from('tree_species_catalog')
      .update({ image_url })
      .eq('slug', slug)
  }

  return Response.json({ image_url: image_url || null })
}
