import { useMemo, useState } from 'react'
import type { Garment, GarmentCategoryId } from '../types'
import { CATEGORIES, categoryLabel } from '../types'
import { GarmentCard } from './GarmentCard'

type Props = {
  garments: Garment[]
  loading: boolean
  admin?: boolean
  onOpen: (g: Garment) => void
  onDelete?: (g: Garment) => void
}

type Filter = 'all' | GarmentCategoryId

export function GarmentCatalog({ garments, loading, admin, onOpen, onDelete }: Props) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  // only offer category chips that actually have garments
  const presentCategories = useMemo(() => {
    const counts = new Map<GarmentCategoryId, number>()
    for (const g of garments) counts.set(g.category, (counts.get(g.category) ?? 0) + 1)
    return CATEGORIES.filter((c) => counts.has(c.id)).map((c) => ({ ...c, count: counts.get(c.id) ?? 0 }))
  }, [garments])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return garments.filter((g) => {
      if (filter !== 'all' && g.category !== filter) return false
      if (needle) {
        const hay = `${g.name} ${g.vendor} ${g.tags.join(' ')} ${categoryLabel(g.category)}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
  }, [garments, query, filter])

  return (
    <div className="gl">
      <div className="gl__toolbar">
        <input
          className="gl__search"
          type="search"
          placeholder="Search garments…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search garments"
        />
        <div className="gl__chips" role="tablist" aria-label="Filter by category">
          <button
            type="button"
            className={`gl__chip${filter === 'all' ? ' is-active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All <span className="gl__chip-n">{garments.length}</span>
          </button>
          {presentCategories.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`gl__chip${filter === c.id ? ' is-active' : ''}`}
              onClick={() => setFilter(c.id)}
            >
              {c.label} <span className="gl__chip-n">{c.count}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="gl__grid" aria-busy="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="gl-card gl-card--skeleton">
              <div className="gl-card__thumb" />
              <div className="gl-card__body">
                <span className="gl-card__name gl-card__name--sk" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="gl__empty">
          {garments.length === 0 ? (
            <>
              <strong>No garments yet</strong>
              <span>Upload a garment pack to build the library.</span>
            </>
          ) : (
            <>
              <strong>No matches</strong>
              <span>Try a different search or category.</span>
            </>
          )}
        </div>
      ) : (
        <div className="gl__grid">
          {filtered.map((g) => (
            <GarmentCard key={g.id} garment={g} admin={admin} onOpen={onOpen} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
