import { describe, it, expect } from 'vitest'
import { filterAssets, recentAssets } from './assetFilter'
import type { Asset } from './assetStore'

// Minimal factory — filter/sort only read metadata fields, so blob/thumb can be empty.
function asset(over: Partial<Asset>): Asset {
  return {
    id: over.id ?? Math.random().toString(36),
    userId: 'u1',
    filename: 'file.png',
    type: 'image/png',
    kind: 'raster',
    width: 100,
    height: 100,
    size: 10,
    createdAt: 0,
    lastUsedAt: 0,
    favorite: false,
    blob: undefined as unknown as Blob,
    thumb: undefined as unknown as Blob,
    ...over,
  }
}

const base: Asset[] = [
  asset({ id: 'a', filename: 'Logo.svg', type: 'image/svg+xml', kind: 'vector', createdAt: 100 }),
  asset({ id: 'b', filename: 'Photo.jpg', type: 'image/jpeg', kind: 'raster', createdAt: 300 }),
  asset({ id: 'c', filename: 'Badge.png', type: 'image/png', kind: 'raster', createdAt: 200, favorite: true }),
]

describe('filterAssets', () => {
  it('floats favorites to the top regardless of sort', () => {
    const out = filterAssets(base, { query: '', filter: 'all', sort: 'newest' })
    expect(out[0].id).toBe('c') // favorite first
  })

  it('sorts non-favorites newest-first by default', () => {
    const out = filterAssets(base, { query: '', filter: 'all', sort: 'newest' })
    expect(out.map((a) => a.id)).toEqual(['c', 'b', 'a'])
  })

  it('sorts oldest-first when asked', () => {
    const nofav = base.map((a) => ({ ...a, favorite: false }))
    const out = filterAssets(nofav, { query: '', filter: 'all', sort: 'oldest' })
    expect(out.map((a) => a.id)).toEqual(['a', 'c', 'b'])
  })

  it('filters vectors vs images', () => {
    expect(filterAssets(base, { query: '', filter: 'vectors', sort: 'newest' }).map((a) => a.id)).toEqual(['a'])
    expect(filterAssets(base, { query: '', filter: 'images', sort: 'newest' }).map((a) => a.id).sort()).toEqual(['b', 'c'])
  })

  it('filters by exact type (PNG, SVG)', () => {
    expect(filterAssets(base, { query: '', filter: 'png', sort: 'newest' }).map((a) => a.id)).toEqual(['c'])
    expect(filterAssets(base, { query: '', filter: 'svg', sort: 'newest' }).map((a) => a.id)).toEqual(['a'])
  })

  it('live-searches by filename, case-insensitive', () => {
    expect(filterAssets(base, { query: 'logo', filter: 'all', sort: 'newest' }).map((a) => a.id)).toEqual(['a'])
    expect(filterAssets(base, { query: 'zzz', filter: 'all', sort: 'newest' })).toHaveLength(0)
  })
})

describe('recentAssets', () => {
  it('returns only used assets, most-recent first', () => {
    const used = [
      asset({ id: 'x', lastUsedAt: 0 }),
      asset({ id: 'y', lastUsedAt: 500 }),
      asset({ id: 'z', lastUsedAt: 900 }),
    ]
    expect(recentAssets(used).map((a) => a.id)).toEqual(['z', 'y'])
  })

  it('respects the limit', () => {
    const used = Array.from({ length: 12 }, (_, i) => asset({ id: `u${i}`, lastUsedAt: i + 1 }))
    expect(recentAssets(used, 5)).toHaveLength(5)
  })
})
