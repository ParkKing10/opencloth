/**
 * Pure search / filter / sort helpers for the asset library. Kept free of React so the
 * behaviour (favorites-first, type filters, recency) is unit-testable in isolation.
 */
import type { Asset } from './assetStore'

export type AssetFilter = 'all' | 'png' | 'svg' | 'images' | 'vectors'
export type AssetSort = 'newest' | 'oldest'

export const FILTER_LABELS: Record<AssetFilter, string> = {
  all: 'All',
  images: 'Images',
  vectors: 'Vectors',
  png: 'PNG',
  svg: 'SVG',
}

function matchesFilter(asset: Asset, filter: AssetFilter): boolean {
  switch (filter) {
    case 'all':
      return true
    case 'images':
      return asset.kind === 'raster'
    case 'vectors':
      return asset.kind === 'vector'
    case 'svg':
      return asset.type === 'image/svg+xml'
    case 'png':
      return asset.type === 'image/png'
    default:
      return true
  }
}

export type FilterArgs = { query: string; filter: AssetFilter; sort: AssetSort }

/** Apply search + type filter + sort, then float favorites to the top (stable within each group). */
export function filterAssets(assets: Asset[], { query, filter, sort }: FilterArgs): Asset[] {
  const q = query.trim().toLowerCase()
  const filtered = assets.filter((a) => matchesFilter(a, filter) && (q === '' || a.filename.toLowerCase().includes(q)))
  const sorted = [...filtered].sort((a, b) => (sort === 'newest' ? b.createdAt - a.createdAt : a.createdAt - b.createdAt))
  const favorites = sorted.filter((a) => a.favorite)
  const rest = sorted.filter((a) => !a.favorite)
  return [...favorites, ...rest]
}

/** Assets that have actually been used, most-recent first. */
export function recentAssets(assets: Asset[], limit = 8): Asset[] {
  return assets
    .filter((a) => a.lastUsedAt > 0)
    .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
    .slice(0, limit)
}
