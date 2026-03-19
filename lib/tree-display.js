/**
 * Resolve which catalog row applies for a numeric game tier (greatest catalog.tier <= currentTier).
 */
export function resolveCatalogRow(catalog, currentTier) {
  if (!catalog?.length) return null
  const eligible = catalog.filter((c) => c.tier <= currentTier).sort((a, b) => b.tier - a.tier)
  return eligible[0] || [...catalog].sort((a, b) => a.tier - b.tier)[0]
}

/** Safe filename stem for /public/species/{key}.jpg */
export function sanitizeImageKey(s) {
  if (typeof s !== 'string') return null
  const t = s.trim().toLowerCase()
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(t)) return null
  return t
}

/**
 * Image variants for one catalog species (same tree type / milestone slug only).
 * Keys in tree_gallery_by_slug are catalog slugs, e.g. "bristlecone" -> ["bristlecone","bristlecone-dusk"]
 */
export function galleryPoolForSpecies(milestoneSlug, galleryBySlug) {
  const base = sanitizeImageKey(milestoneSlug) || 'bonsai'
  const raw = galleryBySlug?.[milestoneSlug]
  if (!Array.isArray(raw) || raw.length === 0) return [base]
  const cleaned = [...new Set(raw.map(sanitizeImageKey).filter(Boolean))]
  return cleaned.length ? cleaned : [base]
}

/**
 * sticky: canonical species_slug from DB (matches catalog for tier).
 * rotate_load: random from gallery pool for this milestone slug only.
 */
export function pickDisplaySlug({ mode, speciesSlug, milestoneSlug, galleryBySlug }) {
  const fallback = sanitizeImageKey(speciesSlug) || sanitizeImageKey(milestoneSlug) || 'bonsai'
  if (mode !== 'rotate_load') return fallback
  const pool = galleryPoolForSpecies(milestoneSlug, galleryBySlug)
  return pool[Math.floor(Math.random() * pool.length)]
}
