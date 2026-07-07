import { useMemo, useState } from 'react'
import {
  IcoPlus,
  IcoSearch,
  IcoGrid,
  IcoTechPack,
  IcoDots,
  IcoUpload,
  IcoCommand,
} from '../../components/ui/Icons'
import { GARMENT_GLYPHS, type GarmentKind } from '../../components/ui/Garments'
import { SuitePage } from '../_shared/SuitePage'
import './tp.css'

/* --- Domain model --------------------------------------------------------- */
type PackStatus = 'ready' | 'review' | 'draft'

interface TechPack {
  id: string
  name: string
  code: string
  kind: GarmentKind
  status: PackStatus
  /** Light "flat sketch on paper" preview tile vs. dark technical tile. */
  lightTile?: boolean
  maker: string | null
  country: string | null
  flag: string
  updated: string
  pages: number
  size: string
}

const PACKS: TechPack[] = [
  {
    id: 'tp-1042',
    name: 'Vintage Washed Hoodie',
    code: 'TP-1042 · SS26',
    kind: 'hoodie',
    status: 'ready',
    lightTile: true,
    maker: 'Anadolu Knitwear',
    country: 'Istanbul, Turkey',
    flag: '🇹🇷',
    updated: 'Updated 2h ago',
    pages: 14,
    size: 'PDF · 4.2 MB',
  },
  {
    id: 'tp-1039',
    name: 'Oversized Street Tee',
    code: 'TP-1039 · SS26',
    kind: 'tee',
    status: 'review',
    maker: 'Porto Textile Co.',
    country: 'Porto, Portugal',
    flag: '🇵🇹',
    updated: 'Updated 5h ago',
    pages: 9,
    size: 'PDF · 2.8 MB',
  },
  {
    id: 'tp-1036',
    name: 'Cargo Pocket Jacket',
    code: 'TP-1036 · FW26',
    kind: 'jacket',
    status: 'ready',
    maker: 'Saigon Garment Group',
    country: 'Ho Chi Minh, Vietnam',
    flag: '🇻🇳',
    updated: 'Updated 1d ago',
    pages: 22,
    size: 'PDF · 7.1 MB',
  },
  {
    id: 'tp-1031',
    name: 'Baggy Cargo Pants',
    code: 'TP-1031 · FW26',
    kind: 'pants',
    status: 'draft',
    maker: null,
    country: null,
    flag: '📄',
    updated: 'Updated 1d ago',
    pages: 6,
    size: 'Draft · 1.4 MB',
  },
  {
    id: 'tp-1028',
    name: 'Structured Dad Cap',
    code: 'TP-1028 · SS26',
    kind: 'cap',
    status: 'ready',
    lightTile: true,
    maker: 'Dongguan Headwear',
    country: 'Dongguan, China',
    flag: '🇨🇳',
    updated: 'Updated 2d ago',
    pages: 8,
    size: 'PDF · 2.1 MB',
  },
  {
    id: 'tp-1024',
    name: 'Boxy Cropped Hoodie',
    code: 'TP-1024 · SS26',
    kind: 'hoodie',
    status: 'review',
    maker: 'Lisbon Knit Studio',
    country: 'Lisbon, Portugal',
    flag: '🇵🇹',
    updated: 'Updated 3d ago',
    pages: 12,
    size: 'PDF · 3.6 MB',
  },
  {
    id: 'tp-1019',
    name: 'Heavyweight Pocket Tee',
    code: 'TP-1019 · SS26',
    kind: 'tee',
    status: 'ready',
    maker: 'Tirupur Apparel Mills',
    country: 'Tirupur, India',
    flag: '🇮🇳',
    updated: 'Updated 4d ago',
    pages: 10,
    size: 'PDF · 3.0 MB',
  },
  {
    id: 'tp-1015',
    name: 'Quilted Bomber Jacket',
    code: 'TP-1015 · FW26',
    kind: 'jacket',
    status: 'draft',
    maker: null,
    country: null,
    flag: '📄',
    updated: 'Updated 5d ago',
    pages: 5,
    size: 'Draft · 0.9 MB',
  },
  {
    id: 'tp-1011',
    name: 'Pleated Wide Trousers',
    code: 'TP-1011 · FW26',
    kind: 'pants',
    status: 'review',
    maker: 'Bangkok Fashion House',
    country: 'Bangkok, Thailand',
    flag: '🇹🇭',
    updated: 'Updated 6d ago',
    pages: 16,
    size: 'PDF · 5.4 MB',
  },
  {
    id: 'tp-1007',
    name: 'Terry Zip Hoodie',
    code: 'TP-1007 · SS26',
    kind: 'hoodie',
    status: 'ready',
    lightTile: true,
    maker: 'Anadolu Knitwear',
    country: 'Istanbul, Turkey',
    flag: '🇹🇷',
    updated: 'Updated 1w ago',
    pages: 13,
    size: 'PDF · 4.0 MB',
  },
  {
    id: 'tp-1003',
    name: 'Panelled Trucker Cap',
    code: 'TP-1003 · SS26',
    kind: 'cap',
    status: 'review',
    maker: 'Guangzhou Cap Works',
    country: 'Guangzhou, China',
    flag: '🇨🇳',
    updated: 'Updated 1w ago',
    pages: 7,
    size: 'PDF · 1.9 MB',
  },
  {
    id: 'tp-0998',
    name: 'Ringspun Longsleeve Tee',
    code: 'TP-0998 · SS26',
    kind: 'tee',
    status: 'ready',
    maker: 'Porto Textile Co.',
    country: 'Porto, Portugal',
    flag: '🇵🇹',
    updated: 'Updated 2w ago',
    pages: 11,
    size: 'PDF · 3.3 MB',
  },
]

const STATUS_LABEL: Record<PackStatus, string> = {
  ready: 'Ready',
  review: 'In Review',
  draft: 'Draft',
}

type FilterKey = 'all' | PackStatus
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'ready', label: 'Ready' },
  { key: 'review', label: 'In Review' },
  { key: 'draft', label: 'Draft' },
]

type ViewMode = 'grid' | 'list'

function StatusChip({ status }: { status: PackStatus }) {
  return (
    <span className={`tp-status tp-status--${status}`}>
      <span className="tp-status__dot" />
      {STATUS_LABEL[status]}
    </span>
  )
}

/* --- Cards ---------------------------------------------------------------- */
function PackCard({ pack }: { pack: TechPack }) {
  const Glyph = GARMENT_GLYPHS[pack.kind]
  return (
    <article className={`tp-card${pack.lightTile ? ' tp-card--light' : ''}`} tabIndex={0}>
      <div className={`tp-card__preview${pack.lightTile ? ' tp-card__preview--light' : ''}`}>
        <div className="tp-card__preview-top">
          <StatusChip status={pack.status} />
          <span className="tp-card__pages">
            <IcoTechPack width="12" height="12" /> {pack.pages}
          </span>
        </div>
        <Glyph className="tp-card__glyph" width="76" height="76" />
      </div>

      <div className="tp-card__body">
        <div className="tp-card__title-row">
          <div>
            <h3 className="tp-card__name">{pack.name}</h3>
            <p className="tp-card__code">{pack.code}</p>
          </div>
        </div>

        <div className="tp-maker">
          <span className="tp-maker__flag" aria-hidden="true">
            {pack.flag}
          </span>
          <span className="tp-maker__text">
            {pack.maker ? (
              <>
                <span className="tp-maker__name">{pack.maker}</span>
                <span className="tp-maker__place">{pack.country}</span>
              </>
            ) : (
              <>
                <span className="tp-maker__name tp-maker__unmatched">No manufacturer yet</span>
                <span className="tp-maker__place">Match a factory to produce</span>
              </>
            )}
          </span>
        </div>

        <div className="tp-card__meta">
          <span>{pack.updated}</span>
          <span className="tp-card__meta-sep" aria-hidden="true" />
          <span>
            {pack.pages} pages · {pack.size}
          </span>
        </div>
      </div>

      <div className="tp-card__foot">
        <button
          className="tp-download"
          type="button"
          onClick={(e) => e.stopPropagation()}
          disabled={pack.status === 'draft'}
        >
          <IcoUpload width="14" height="14" style={{ transform: 'rotate(180deg)' }} />
          Download PDF
        </button>
        <button
          className="tp-more"
          type="button"
          onClick={(e) => e.stopPropagation()}
          aria-label="More options"
        >
          <IcoDots width="16" height="16" />
        </button>
      </div>
    </article>
  )
}

/* --- List rows ------------------------------------------------------------ */
function PackRow({ pack }: { pack: TechPack }) {
  const Glyph = GARMENT_GLYPHS[pack.kind]
  return (
    <div className="tp-row" tabIndex={0}>
      <div className="tp-row__file">
        <span className="tp-row__thumb" aria-hidden="true">
          <Glyph width="26" height="26" />
        </span>
        <span className="tp-row__names">
          <span className="tp-row__name">{pack.name}</span>
          <span className="tp-row__code">
            {pack.code} · {pack.pages} pages · {pack.size}
          </span>
        </span>
      </div>

      <div className="tp-row__status">
        <StatusChip status={pack.status} />
      </div>

      <div className="tp-row__maker">
        {pack.maker ? (
          <>
            <span aria-hidden="true">{pack.flag}</span>
            <span>
              {pack.maker} — {pack.country}
            </span>
          </>
        ) : (
          <span className="tp-maker__unmatched">No manufacturer yet</span>
        )}
      </div>

      <div className="tp-row__updated">{pack.updated.replace('Updated ', '')}</div>

      <div className="tp-row__actions">
        <button
          className="tp-row__dl"
          type="button"
          onClick={(e) => e.stopPropagation()}
          disabled={pack.status === 'draft'}
        >
          <IcoUpload width="13" height="13" style={{ transform: 'rotate(180deg)' }} />
          PDF
        </button>
        <button
          className="tp-row__more"
          type="button"
          onClick={(e) => e.stopPropagation()}
          aria-label="More options"
        >
          <IcoDots width="16" height="16" />
        </button>
      </div>
    </div>
  )
}

/* --- Page ----------------------------------------------------------------- */
export function TechPacks() {
  const [filter, setFilter] = useState<FilterKey>('all')
  const [view, setView] = useState<ViewMode>('grid')
  const [query, setQuery] = useState('')

  const counts = useMemo(
    () => ({
      all: PACKS.length,
      ready: PACKS.filter((p) => p.status === 'ready').length,
      review: PACKS.filter((p) => p.status === 'review').length,
      draft: PACKS.filter((p) => p.status === 'draft').length,
    }),
    [],
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return PACKS.filter((p) => {
      const matchesFilter = filter === 'all' || p.status === filter
      if (!matchesFilter) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.maker?.toLowerCase().includes(q) ?? false) ||
        (p.country?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [filter, query])

  return (
    <SuitePage
      eyebrow="Library"
      title="Tech Packs"
      subtitle="Production-ready specs for every garment — preview, status, matched manufacturer and PDF export."
      actions={
        <button className="s-btn s-btn--accent" type="button">
          <IcoPlus width="16" height="16" /> New Tech Pack
        </button>
      }
    >
      {/* Count summary */}
      <section className="tp-summary" aria-label="Tech pack summary">
        <div className="tp-summary__cell">
          <span className="tp-summary__value">{counts.all}</span>
          <span className="tp-summary__label">Total packs</span>
        </div>
        <div className="tp-summary__cell">
          <span className="tp-summary__value">
            <span className="tp-summary__dot" style={{ background: 'var(--s-good)' }} />
            {counts.ready}
          </span>
          <span className="tp-summary__label">Ready to produce</span>
        </div>
        <div className="tp-summary__cell">
          <span className="tp-summary__value">
            <span className="tp-summary__dot" style={{ background: 'var(--s-warn)' }} />
            {counts.review}
          </span>
          <span className="tp-summary__label">In review</span>
        </div>
        <div className="tp-summary__cell">
          <span className="tp-summary__value">
            <span className="tp-summary__dot" style={{ background: 'var(--s-text-3)' }} />
            {counts.draft}
          </span>
          <span className="tp-summary__label">Drafts</span>
        </div>
      </section>

      {/* Toolbar */}
      <section className="tp-toolbar">
        <div className="s-tabs" role="tablist" aria-label="Filter tech packs">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              className={`s-tab${filter === f.key ? ' is-active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="tp-toolbar__right">
          <div className="tp-search">
            <span className="tp-search__ico">
              <IcoSearch width="16" height="16" />
            </span>
            <input
              className="tp-search__input"
              type="search"
              placeholder="Search packs, styles, factories…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search tech packs"
            />
            <span className="tp-search__kbd" aria-hidden="true">
              <IcoCommand width="11" height="11" />K
            </span>
          </div>

          <div className="tp-view" role="group" aria-label="View mode">
            <button
              type="button"
              className={`tp-view__btn${view === 'grid' ? ' is-active' : ''}`}
              onClick={() => setView('grid')}
              aria-label="Grid view"
              aria-pressed={view === 'grid'}
            >
              <IcoGrid width="16" height="16" />
            </button>
            <button
              type="button"
              className={`tp-view__btn${view === 'list' ? ' is-active' : ''}`}
              onClick={() => setView('list')}
              aria-label="List view"
              aria-pressed={view === 'list'}
            >
              <IcoTechPack width="16" height="16" />
            </button>
          </div>
        </div>
      </section>

      {/* Body */}
      {visible.length === 0 ? (
        <div className="tp-empty">
          <div>
            <div className="tp-empty__ico">
              <IcoSearch width="24" height="24" />
            </div>
            <h3>No tech packs found</h3>
            <p>Try a different search term or filter.</p>
          </div>
        </div>
      ) : view === 'grid' ? (
        <section className="tp-grid">
          {visible.map((pack) => (
            <PackCard key={pack.id} pack={pack} />
          ))}
        </section>
      ) : (
        <section className="tp-list">
          <div className="tp-list__head">
            <span>Tech pack</span>
            <span>Status</span>
            <span>Manufacturer</span>
            <span>Updated</span>
            <span />
          </div>
          {visible.map((pack) => (
            <PackRow key={pack.id} pack={pack} />
          ))}
        </section>
      )}
    </SuitePage>
  )
}
