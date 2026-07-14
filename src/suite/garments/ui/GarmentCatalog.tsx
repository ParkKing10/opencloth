import { useMemo, useState } from 'react'
import { useT } from '@/i18n'
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
  const t = useT()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  // Only offer category chips that actually have garments — built-in categories first (in their
  // curated order), then any admin-created custom categories present, each with its label.
  const presentCategories = useMemo(() => {
    const counts = new Map<GarmentCategoryId, number>()
    for (const g of garments) counts.set(g.category, (counts.get(g.category) ?? 0) + 1)
    const known = CATEGORIES.filter((c) => counts.has(c.id)).map((c) => ({ id: c.id, label: c.label, count: counts.get(c.id) ?? 0 }))
    const knownIds = new Set(CATEGORIES.map((c) => c.id))
    const custom = [...counts.keys()]
      .filter((id) => !knownIds.has(id))
      .map((id) => ({ id, label: categoryLabel(id), count: counts.get(id) ?? 0 }))
    return [...known, ...custom]
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
          placeholder={t('garmentUi.catalog.searchPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={t('garmentUi.catalog.searchAria')}
        />
        <div className="gl__chips" role="tablist" aria-label={t('garmentUi.catalog.filterAria')}>
          <button
            type="button"
            className={`gl__chip${filter === 'all' ? ' is-active' : ''}`}
            onClick={() => setFilter('all')}
          >
            {t('garmentUi.catalog.all')} <span className="gl__chip-n">{garments.length}</span>
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
              <strong>{t('garmentUi.catalog.emptyTitle')}</strong>
              <span>{t('garmentUi.catalog.emptyBody')}</span>
            </>
          ) : (
            <>
              <strong>{t('garmentUi.catalog.noMatchTitle')}</strong>
              <span>{t('garmentUi.catalog.noMatchBody')}</span>
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
