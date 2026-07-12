/**
 * Traced-from-PNG catalog. Real technical-flat PNGs (front + back combined) vectorised with potrace
 * into clean SVGs under /public/traced, listed in /traced/manifest.json. Each becomes a published
 * Garment Library entry that looks EXACTLY like the source flat (a genuine trace, not a photo guess)
 * and renders as crisp vector at any zoom. Served as files, so the catalog scales to hundreds without
 * bloating the bundle.
 */
import type { Garment, GarmentCategoryId } from './types'

const PREFIX = 'traced-'
export const isTracedGarmentId = (id: string): boolean => id.startsWith(PREFIX)

type ManifestEntry = { id: string; name: string; slug: string; category: string; w: number; h: number }

let cache: Garment[] | null = null

/** The traced garments, loaded once from the manifest. Empty (never throws) if the manifest is absent. */
export async function loadTracedGarments(): Promise<Garment[]> {
  if (cache) return cache
  try {
    const res = await fetch('/traced/manifest.json', { cache: 'no-cache' })
    if (!res.ok) return (cache = [])
    const entries = (await res.json()) as ManifestEntry[]
    cache = entries.map((e) => ({
      id: e.id,
      name: e.name,
      slug: e.slug,
      category: (e.category as GarmentCategoryId) || 'jacket',
      status: 'published' as const,
      vendor: 'THREADOS Traced',
      tags: ['traced'],
      thumbUrl: `/traced/${e.slug}.svg`,
      createdAt: 0,
      views: { front: false, back: false, combinedFrontBack: true, side: false, details: false, has3D: false },
      price: 0,
    }))
    return cache
  } catch {
    return (cache = [])
  }
}

/** Public URL of a traced garment's vector SVG (for the studio canvas / detail view). */
export function tracedGarmentSvgUrl(id: string): string {
  return `/traced/${id.slice(PREFIX.length)}.svg`
}
