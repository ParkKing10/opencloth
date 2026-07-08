import { useMemo, useState, type SVGProps } from 'react'
import {
  IcoPlus,
  IcoSearch,
  IcoGrid,
  IcoTechPack,
  IcoDots,
  IcoUpload,
  IcoCommand,
} from '../../components/ui/Icons'
import { GARMENT_GLYPHS } from '../../components/ui/Garments'
import { useStore } from '../../data/store'
import { useAuth } from '../../auth/auth'
import { useToast } from '../../components/ui/Toast'
import { uid, relativeTime } from '../../data/utils'
import type { TechPack, TechPackStatus, GarmentKind } from '../../data/types'
import { SuitePage } from '../_shared/SuitePage'
import './tp.css'

/* --- Local icon (no trash icon exists in the shared set) ------------------ */
function IcoTrash(p: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  )
}

/* --- Status presentation --------------------------------------------------
   The store status is 'draft' | 'in_review' | 'ready'. The premium chip CSS
   is keyed on 'draft' | 'review' | 'ready', so we translate for styling. */
type ChipKey = 'ready' | 'review' | 'draft'
const STATUS_CHIP: Record<TechPackStatus, ChipKey> = {
  ready: 'ready',
  in_review: 'review',
  draft: 'draft',
}
const STATUS_LABEL: Record<TechPackStatus, string> = {
  ready: 'Ready',
  in_review: 'In Review',
  draft: 'Draft',
}

/* --- Filters -------------------------------------------------------------- */
type FilterKey = 'all' | TechPackStatus
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'ready', label: 'Ready' },
  { key: 'in_review', label: 'In Review' },
  { key: 'draft', label: 'Draft' },
]

type ViewMode = 'grid' | 'list'

/** Newest-first, then a spread of names so "New Tech Pack" cycles variety. */
const NEW_PACK_NAMES = [
  'Untitled Hoodie',
  'Untitled Tee',
  'Untitled Jacket',
  'Untitled Pants',
  'Untitled Cap',
]
const NEW_PACK_KINDS: GarmentKind[] = ['hoodie', 'tee', 'jacket', 'pants', 'cap']

/** Derived, view-only fields so the card/row markup stays declarative. */
function packCode(pack: TechPack, index: number): string {
  const short = pack.id.replace(/[^a-z0-9]/gi, '').slice(-4).toUpperCase() || String(index)
  return `TP-${short}`
}
function packSize(pack: TechPack): string {
  if (pack.status === 'draft') return `Draft · ${(pack.pages * 0.18 + 0.4).toFixed(1)} MB`
  return `PDF · ${(pack.pages * 0.32 + 0.6).toFixed(1)} MB`
}

/* --- Status chip ---------------------------------------------------------- */
function StatusChip({ status }: { status: TechPackStatus }) {
  return (
    <span className={`tp-status tp-status--${STATUS_CHIP[status]}`}>
      <span className="tp-status__dot" />
      {STATUS_LABEL[status]}
    </span>
  )
}

/* --- Row actions (download + more/delete menu) ---------------------------- */
type ActionProps = {
  pack: TechPack
  menuOpen: boolean
  onToggleMenu: () => void
  onDownload: () => void
  onDelete: () => void
}

function CardActions({ pack, menuOpen, onToggleMenu, onDownload, onDelete }: ActionProps) {
  const isDraft = pack.status === 'draft'
  return (
    <div className="tp-card__foot">
      <button
        className="tp-download"
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onDownload()
        }}
        disabled={isDraft}
        title={isDraft ? 'Finish the draft to export a PDF' : 'Download the tech pack PDF'}
      >
        <IcoUpload width="14" height="14" style={{ transform: 'rotate(180deg)' }} />
        Download PDF
      </button>
      <div className="tp-menu-wrap">
        <button
          className="tp-more"
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggleMenu()
          }}
          aria-label="More options"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          title="More options"
        >
          <IcoDots width="16" height="16" />
        </button>
        {menuOpen && (
          <PackMenu pack={pack} onDownload={onDownload} onDelete={onDelete} />
        )}
      </div>
    </div>
  )
}

function PackMenu({
  pack,
  onDownload,
  onDelete,
}: {
  pack: TechPack
  onDownload: () => void
  onDelete: () => void
}) {
  const isDraft = pack.status === 'draft'
  return (
    <div className="tp-menu" role="menu" onClick={(e) => e.stopPropagation()}>
      <button
        className="tp-menu__item"
        type="button"
        role="menuitem"
        disabled={isDraft}
        onClick={onDownload}
      >
        <IcoUpload width="14" height="14" style={{ transform: 'rotate(180deg)' }} />
        Download PDF
      </button>
      <button
        className="tp-menu__item tp-menu__item--danger"
        type="button"
        role="menuitem"
        onClick={onDelete}
      >
        <IcoTrash width="14" height="14" />
        Delete tech pack
      </button>
    </div>
  )
}

/* --- Card ----------------------------------------------------------------- */
function PackCard({
  pack,
  index,
  menuOpen,
  onToggleMenu,
  onDownload,
  onDelete,
}: {
  pack: TechPack
  index: number
  menuOpen: boolean
  onToggleMenu: () => void
  onDownload: () => void
  onDelete: () => void
}) {
  const Glyph = GARMENT_GLYPHS[pack.kind]
  return (
    <article className="tp-card" tabIndex={0}>
      <div className="tp-card__preview">
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
            <p className="tp-card__code">
              {packCode(pack, index)} · Updated {relativeTime(pack.updatedAt)}
            </p>
          </div>
        </div>

        <div className="tp-maker">
          <span className="tp-maker__flag" aria-hidden="true">
            <IcoTechPack width="14" height="14" />
          </span>
          <span className="tp-maker__text">
            {pack.manufacturer ? (
              <>
                <span className="tp-maker__name">{pack.manufacturer}</span>
                <span className="tp-maker__place">Matched manufacturer</span>
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
          <span>Updated {relativeTime(pack.updatedAt)}</span>
          <span className="tp-card__meta-sep" aria-hidden="true" />
          <span>
            {pack.pages} pages · {packSize(pack)}
          </span>
        </div>
      </div>

      <CardActions
        pack={pack}
        menuOpen={menuOpen}
        onToggleMenu={onToggleMenu}
        onDownload={onDownload}
        onDelete={onDelete}
      />
    </article>
  )
}

/* --- List row ------------------------------------------------------------- */
function PackRow({
  pack,
  index,
  menuOpen,
  onToggleMenu,
  onDownload,
  onDelete,
}: {
  pack: TechPack
  index: number
  menuOpen: boolean
  onToggleMenu: () => void
  onDownload: () => void
  onDelete: () => void
}) {
  const Glyph = GARMENT_GLYPHS[pack.kind]
  const isDraft = pack.status === 'draft'
  return (
    <div className="tp-row" tabIndex={0}>
      <div className="tp-row__file">
        <span className="tp-row__thumb" aria-hidden="true">
          <Glyph width="26" height="26" />
        </span>
        <span className="tp-row__names">
          <span className="tp-row__name">{pack.name}</span>
          <span className="tp-row__code">
            {packCode(pack, index)} · {pack.pages} pages · {packSize(pack)}
          </span>
        </span>
      </div>

      <div className="tp-row__status">
        <StatusChip status={pack.status} />
      </div>

      <div className="tp-row__maker">
        {pack.manufacturer ? (
          <span>{pack.manufacturer}</span>
        ) : (
          <span className="tp-maker__unmatched">No manufacturer yet</span>
        )}
      </div>

      <div className="tp-row__updated">{relativeTime(pack.updatedAt)}</div>

      <div className="tp-row__actions">
        <button
          className="tp-row__dl"
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDownload()
          }}
          disabled={isDraft}
          title={isDraft ? 'Finish the draft to export a PDF' : 'Download the tech pack PDF'}
        >
          <IcoUpload width="13" height="13" style={{ transform: 'rotate(180deg)' }} />
          PDF
        </button>
        <div className="tp-menu-wrap">
          <button
            className="tp-row__more"
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onToggleMenu()
            }}
            aria-label="More options"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title="More options"
          >
            <IcoDots width="16" height="16" />
          </button>
          {menuOpen && (
            <PackMenu pack={pack} onDownload={onDownload} onDelete={onDelete} />
          )}
        </div>
      </div>
    </div>
  )
}

/* --- Page ----------------------------------------------------------------- */
export function TechPacks() {
  const { data, mutate } = useStore()
  const { user } = useAuth()
  const toast = useToast()

  const [filter, setFilter] = useState<FilterKey>('all')
  const [view, setView] = useState<ViewMode>('grid')
  const [query, setQuery] = useState('')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  /* Scope to the signed-in creator; fall back to all if we somehow have no user. */
  const myPacks = useMemo<TechPack[]>(() => {
    const owned = user ? data.techPacks.filter((p) => p.ownerId === user.id) : data.techPacks
    return [...owned].sort((a, b) => b.updatedAt - a.updatedAt)
  }, [data.techPacks, user])

  const counts = useMemo(
    () => ({
      all: myPacks.length,
      ready: myPacks.filter((p) => p.status === 'ready').length,
      in_review: myPacks.filter((p) => p.status === 'in_review').length,
      draft: myPacks.filter((p) => p.status === 'draft').length,
    }),
    [myPacks],
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return myPacks.filter((p) => {
      if (filter !== 'all' && p.status !== filter) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        (p.manufacturer?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [myPacks, filter, query])

  function toggleMenu(id: string) {
    setOpenMenuId((current) => (current === id ? null : id))
  }

  function createPack() {
    if (!user) {
      toast('Sign in to create a tech pack.', 'info')
      return
    }
    const seed = data.techPacks.length
    const newPack: TechPack = {
      id: uid('t'),
      ownerId: user.id,
      name: NEW_PACK_NAMES[seed % NEW_PACK_NAMES.length],
      kind: NEW_PACK_KINDS[seed % NEW_PACK_KINDS.length],
      status: 'draft',
      pages: 1,
      updatedAt: Date.now(),
    }
    mutate((d) => ({ ...d, techPacks: [newPack, ...d.techPacks] }))
    setFilter('all')
    setQuery('')
    toast('New draft tech pack created.', 'success')
  }

  function downloadPack(pack: TechPack) {
    setOpenMenuId(null)
    if (pack.status === 'draft') {
      toast('Finish this draft before exporting a PDF.', 'info')
      return
    }
    toast(`Preparing “${pack.name}” PDF…`, 'accent')
  }

  function deletePack(pack: TechPack) {
    setOpenMenuId(null)
    mutate((d) => ({ ...d, techPacks: d.techPacks.filter((p) => p.id !== pack.id) }))
    toast(`“${pack.name}” deleted.`, 'default')
  }

  const hasAnyPacks = myPacks.length > 0
  const isFiltering = filter !== 'all' || query.trim().length > 0

  return (
    <SuitePage
      eyebrow="Library"
      title="Tech Packs"
      subtitle="Production-ready specs for every garment — preview, status, matched manufacturer and PDF export."
      actions={
        <button className="s-btn s-btn--accent" type="button" onClick={createPack}>
          <IcoPlus width="16" height="16" /> New Tech Pack
        </button>
      }
    >
      {/* Count summary — reflects real, owned packs */}
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
            {counts.in_review}
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
              title="Grid view"
            >
              <IcoGrid width="16" height="16" />
            </button>
            <button
              type="button"
              className={`tp-view__btn${view === 'list' ? ' is-active' : ''}`}
              onClick={() => setView('list')}
              aria-label="List view"
              aria-pressed={view === 'list'}
              title="List view"
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
              {hasAnyPacks ? <IcoSearch width="24" height="24" /> : <IcoTechPack width="24" height="24" />}
            </div>
            {hasAnyPacks ? (
              <>
                <h3>No tech packs found</h3>
                <p>Try a different search term or filter.</p>
                {isFiltering && (
                  <button
                    className="s-btn tp-empty__cta"
                    type="button"
                    onClick={() => {
                      setFilter('all')
                      setQuery('')
                    }}
                  >
                    Clear filters
                  </button>
                )}
              </>
            ) : (
              <>
                <h3>No tech packs yet</h3>
                <p>Create your first spec sheet — status, pages and a matched manufacturer, all in one place.</p>
                <button className="s-btn s-btn--accent tp-empty__cta" type="button" onClick={createPack}>
                  <IcoPlus width="16" height="16" /> New Tech Pack
                </button>
              </>
            )}
          </div>
        </div>
      ) : view === 'grid' ? (
        <section className="tp-grid">
          {visible.map((pack, i) => (
            <PackCard
              key={pack.id}
              pack={pack}
              index={i}
              menuOpen={openMenuId === pack.id}
              onToggleMenu={() => toggleMenu(pack.id)}
              onDownload={() => downloadPack(pack)}
              onDelete={() => deletePack(pack)}
            />
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
          {visible.map((pack, i) => (
            <PackRow
              key={pack.id}
              pack={pack}
              index={i}
              menuOpen={openMenuId === pack.id}
              onToggleMenu={() => toggleMenu(pack.id)}
              onDownload={() => downloadPack(pack)}
              onDelete={() => deletePack(pack)}
            />
          ))}
        </section>
      )}
    </SuitePage>
  )
}
