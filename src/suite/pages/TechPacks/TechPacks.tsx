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
import { useT } from '@/i18n'
import { useStore } from '../../data/store'
import { useAuth } from '../../auth/auth'
import { useToast } from '../../components/ui/Toast'
import { uid, relativeTime } from '../../data/utils'
import { downloadTechPackPdf } from '../../lib/exporters'
import { downloadCsv } from '../../lib/download'
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

/* --- Filters -------------------------------------------------------------- */
type FilterKey = 'all' | TechPackStatus
const FILTERS: { key: FilterKey; labelKey: string }[] = [
  { key: 'all', labelKey: 'techPacks.filter.all' },
  { key: 'ready', labelKey: 'techPacks.status.ready' },
  { key: 'in_review', labelKey: 'techPacks.status.in_review' },
  { key: 'draft', labelKey: 'techPacks.status.draft' },
]

type ViewMode = 'grid' | 'list'

/** Newest-first, then a spread of names so "New Tech Pack" cycles variety. */
const NEW_PACK_NAME_KEYS = [
  'techPacks.newName.hoodie',
  'techPacks.newName.tee',
  'techPacks.newName.jacket',
  'techPacks.newName.pants',
  'techPacks.newName.cap',
]
const NEW_PACK_KINDS: GarmentKind[] = ['hoodie', 'tee', 'jacket', 'pants', 'cap']

/** Derived, view-only fields so the card/row markup stays declarative. */
function packCode(pack: TechPack, index: number): string {
  const short = pack.id.replace(/[^a-z0-9]/gi, '').slice(-4).toUpperCase() || String(index)
  return `TP-${short}`
}
function packSize(pack: TechPack, t: (k: string) => string): string {
  if (pack.status === 'draft') return `${t('techPacks.status.draft')} · ${(pack.pages * 0.18 + 0.4).toFixed(1)} MB`
  return `PDF · ${(pack.pages * 0.32 + 0.6).toFixed(1)} MB`
}

/* --- Status chip ---------------------------------------------------------- */
function StatusChip({ status }: { status: TechPackStatus }) {
  const t = useT()
  return (
    <span className={`tp-status tp-status--${STATUS_CHIP[status]}`}>
      <span className="tp-status__dot" />
      {t(`techPacks.status.${status}`)}
    </span>
  )
}

/* --- Row actions (download + more/delete menu) ---------------------------- */
type ActionProps = {
  pack: TechPack
  menuOpen: boolean
  onToggleMenu: () => void
  onCloseMenu: () => void
  onDownload: () => void
  onDelete: () => void
}

function CardActions({ pack, menuOpen, onToggleMenu, onCloseMenu, onDownload, onDelete }: ActionProps) {
  const t = useT()
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
        title={isDraft ? t('techPacks.download.draftTitle') : t('techPacks.download.title')}
      >
        <IcoUpload width="14" height="14" style={{ transform: 'rotate(180deg)' }} />
        {t('techPacks.download')}
      </button>
      <div className="tp-menu-wrap">
        <button
          className="tp-more"
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggleMenu()
          }}
          aria-label={t('techPacks.moreOptions')}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          title={t('techPacks.moreOptions')}
        >
          <IcoDots width="16" height="16" />
        </button>
        {menuOpen && (
          <PackMenu pack={pack} onClose={onCloseMenu} onDownload={onDownload} onDelete={onDelete} />
        )}
      </div>
    </div>
  )
}

function PackMenu({
  pack,
  onClose,
  onDownload,
  onDelete,
}: {
  pack: TechPack
  onClose: () => void
  onDownload: () => void
  onDelete: () => void
}) {
  const t = useT()
  const isDraft = pack.status === 'draft'
  return (
    <>
      {/* Transparent scrim closes the menu on any outside click — matches the
          rest of the suite (Manufacturers sort menu) so open menus never stick. */}
      <button
        type="button"
        className="tp-menu__scrim"
        aria-label={t('techPacks.closeMenu')}
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
      />
      <div className="tp-menu" role="menu" onClick={(e) => e.stopPropagation()}>
        <button
          className="tp-menu__item"
          type="button"
          role="menuitem"
          disabled={isDraft}
          onClick={onDownload}
        >
          <IcoUpload width="14" height="14" style={{ transform: 'rotate(180deg)' }} />
          {t('techPacks.download')}
        </button>
        <button
          className="tp-menu__item tp-menu__item--danger"
          type="button"
          role="menuitem"
          onClick={onDelete}
        >
          <IcoTrash width="14" height="14" />
          {t('techPacks.delete')}
        </button>
      </div>
    </>
  )
}

/* --- Card ----------------------------------------------------------------- */
function PackCard({
  pack,
  index,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
  onDownload,
  onDelete,
}: {
  pack: TechPack
  index: number
  menuOpen: boolean
  onToggleMenu: () => void
  onCloseMenu: () => void
  onDownload: () => void
  onDelete: () => void
}) {
  const t = useT()
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
              {packCode(pack, index)} · {t('techPacks.updated', { time: relativeTime(pack.updatedAt) })}
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
                <span className="tp-maker__place">{t('techPacks.matchedManufacturer')}</span>
              </>
            ) : (
              <>
                <span className="tp-maker__name tp-maker__unmatched">{t('techPacks.noManufacturer')}</span>
                <span className="tp-maker__place">{t('techPacks.matchFactory')}</span>
              </>
            )}
          </span>
        </div>

        <div className="tp-card__meta">
          <span>{t('techPacks.updated', { time: relativeTime(pack.updatedAt) })}</span>
          <span className="tp-card__meta-sep" aria-hidden="true" />
          <span>
            {t('techPacks.pages', { n: pack.pages })} · {packSize(pack, t)}
          </span>
        </div>
      </div>

      <CardActions
        pack={pack}
        menuOpen={menuOpen}
        onToggleMenu={onToggleMenu}
        onCloseMenu={onCloseMenu}
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
  onCloseMenu,
  onDownload,
  onDelete,
}: {
  pack: TechPack
  index: number
  menuOpen: boolean
  onToggleMenu: () => void
  onCloseMenu: () => void
  onDownload: () => void
  onDelete: () => void
}) {
  const t = useT()
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
            {packCode(pack, index)} · {t('techPacks.pages', { n: pack.pages })} · {packSize(pack, t)}
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
          <span className="tp-maker__unmatched">{t('techPacks.noManufacturer')}</span>
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
          title={isDraft ? t('techPacks.download.draftTitle') : t('techPacks.download.title')}
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
            aria-label={t('techPacks.moreOptions')}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title={t('techPacks.moreOptions')}
          >
            <IcoDots width="16" height="16" />
          </button>
          {menuOpen && (
            <PackMenu pack={pack} onClose={onCloseMenu} onDownload={onDownload} onDelete={onDelete} />
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
  const t = useT()

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
      toast(t('techPacks.toast.signIn'), 'info')
      return
    }
    const seed = data.techPacks.length
    const newPack: TechPack = {
      id: uid('t'),
      ownerId: user.id,
      name: t(NEW_PACK_NAME_KEYS[seed % NEW_PACK_NAME_KEYS.length]),
      kind: NEW_PACK_KINDS[seed % NEW_PACK_KINDS.length],
      status: 'draft',
      pages: 1,
      updatedAt: Date.now(),
    }
    mutate((d) => ({ ...d, techPacks: [newPack, ...d.techPacks] }))
    setFilter('all')
    setQuery('')
    toast(t('techPacks.toast.created'), 'success')
  }

  function downloadPack(pack: TechPack) {
    setOpenMenuId(null)
    if (pack.status === 'draft') {
      toast(t('techPacks.toast.finishDraft'), 'info')
      return
    }
    try {
      // Real effect: generate + download a multi-page PDF tech pack.
      downloadTechPackPdf({
        name: pack.name,
        kind: pack.kind,
        manufacturer: pack.manufacturer,
      })
      toast(t('techPacks.toast.downloaded', { name: pack.name }), 'success')
    } catch {
      toast(t('techPacks.toast.pdfError'), 'info')
    }
  }

  function exportList() {
    if (visible.length === 0) {
      toast(t('techPacks.toast.nothingExport'), 'info')
      return
    }
    try {
      // Real effect: download a CSV of the currently visible packs.
      const rows = visible.map((p, i) => ({
        code: packCode(p, i),
        name: p.name,
        kind: p.kind,
        status: t(`techPacks.status.${p.status}`),
        manufacturer: p.manufacturer ?? '',
        pages: p.pages,
        updated: new Date(p.updatedAt).toISOString(),
      }))
      downloadCsv(rows, 'threados-tech-packs.csv')
      toast(
        t(rows.length === 1 ? 'techPacks.toast.exportedOne' : 'techPacks.toast.exportedMany', {
          n: rows.length,
        }),
        'success',
      )
    } catch {
      toast(t('techPacks.toast.exportError'), 'info')
    }
  }

  function deletePack(pack: TechPack) {
    setOpenMenuId(null)
    mutate((d) => ({ ...d, techPacks: d.techPacks.filter((p) => p.id !== pack.id) }))
    toast(t('techPacks.toast.deleted', { name: pack.name }), 'default')
  }

  const hasAnyPacks = myPacks.length > 0
  const isFiltering = filter !== 'all' || query.trim().length > 0

  return (
    <SuitePage
      eyebrow={t('techPacks.eyebrow')}
      title={t('techPacks.title')}
      subtitle={t('techPacks.subtitle')}
      actions={
        <button className="s-btn s-btn--accent" type="button" onClick={createPack}>
          <IcoPlus width="16" height="16" /> {t('techPacks.new')}
        </button>
      }
    >
      {/* Count summary — reflects real, owned packs */}
      <section className="tp-summary" aria-label={t('techPacks.summary.aria')}>
        <div className="tp-summary__cell">
          <span className="tp-summary__value">{counts.all}</span>
          <span className="tp-summary__label">{t('techPacks.summary.total')}</span>
        </div>
        <div className="tp-summary__cell">
          <span className="tp-summary__value">
            <span className="tp-summary__dot" style={{ background: 'var(--s-good)' }} />
            {counts.ready}
          </span>
          <span className="tp-summary__label">{t('techPacks.summary.ready')}</span>
        </div>
        <div className="tp-summary__cell">
          <span className="tp-summary__value">
            <span className="tp-summary__dot" style={{ background: 'var(--s-warn)' }} />
            {counts.in_review}
          </span>
          <span className="tp-summary__label">{t('techPacks.summary.inReview')}</span>
        </div>
        <div className="tp-summary__cell">
          <span className="tp-summary__value">
            <span className="tp-summary__dot" style={{ background: 'var(--s-text-3)' }} />
            {counts.draft}
          </span>
          <span className="tp-summary__label">{t('techPacks.summary.drafts')}</span>
        </div>
      </section>

      {/* Toolbar */}
      <section className="tp-toolbar">
        <div className="s-tabs" role="tablist" aria-label={t('techPacks.filterAria')}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              className={`s-tab${filter === f.key ? ' is-active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {t(f.labelKey)}
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
              placeholder={t('techPacks.search.placeholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={t('techPacks.search.aria')}
            />
            <span className="tp-search__kbd" aria-hidden="true">
              <IcoCommand width="11" height="11" />K
            </span>
          </div>

          <button
            className="tp-export"
            type="button"
            onClick={exportList}
            disabled={visible.length === 0}
            title={t('techPacks.export.title')}
          >
            <IcoUpload width="14" height="14" />
            {t('techPacks.export.label')}
          </button>

          <div className="tp-view" role="group" aria-label={t('techPacks.view.aria')}>
            <button
              type="button"
              className={`tp-view__btn${view === 'grid' ? ' is-active' : ''}`}
              onClick={() => setView('grid')}
              aria-label={t('techPacks.view.grid')}
              aria-pressed={view === 'grid'}
              title={t('techPacks.view.grid')}
            >
              <IcoGrid width="16" height="16" />
            </button>
            <button
              type="button"
              className={`tp-view__btn${view === 'list' ? ' is-active' : ''}`}
              onClick={() => setView('list')}
              aria-label={t('techPacks.view.list')}
              aria-pressed={view === 'list'}
              title={t('techPacks.view.list')}
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
                <h3>{t('techPacks.empty.foundTitle')}</h3>
                <p>{t('techPacks.empty.foundBody')}</p>
                {isFiltering && (
                  <button
                    className="s-btn tp-empty__cta"
                    type="button"
                    onClick={() => {
                      setFilter('all')
                      setQuery('')
                    }}
                  >
                    {t('techPacks.empty.clear')}
                  </button>
                )}
              </>
            ) : (
              <>
                <h3>{t('techPacks.empty.title')}</h3>
                <p>{t('techPacks.empty.body')}</p>
                <button className="s-btn s-btn--accent tp-empty__cta" type="button" onClick={createPack}>
                  <IcoPlus width="16" height="16" /> {t('techPacks.new')}
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
              onCloseMenu={() => setOpenMenuId(null)}
              onDownload={() => downloadPack(pack)}
              onDelete={() => deletePack(pack)}
            />
          ))}
        </section>
      ) : (
        <section className="tp-list">
          <div className="tp-list__head">
            <span>{t('techPacks.col.techPack')}</span>
            <span>{t('techPacks.col.status')}</span>
            <span>{t('techPacks.col.manufacturer')}</span>
            <span>{t('techPacks.col.updated')}</span>
            <span />
          </div>
          {visible.map((pack, i) => (
            <PackRow
              key={pack.id}
              pack={pack}
              index={i}
              menuOpen={openMenuId === pack.id}
              onToggleMenu={() => toggleMenu(pack.id)}
              onCloseMenu={() => setOpenMenuId(null)}
              onDownload={() => downloadPack(pack)}
              onDelete={() => deletePack(pack)}
            />
          ))}
        </section>
      )}
    </SuitePage>
  )
}
