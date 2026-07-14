/**
 * Garments — the workspace home and the first thing users see. Garments are managed here; the
 * editor only opens on Open/Continue. Shows a premium onboarding when empty, otherwise the
 * My-Garments grid with search, sort, and per-card actions.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode, type SVGProps } from 'react'
import { useNavigate } from 'react-router-dom'
import { SuitePage } from '../_shared/SuitePage'
import { uid } from '../../data/utils'
import { useAuth } from '../../auth/auth'
import { useToast } from '../../components/ui/Toast'
import { useT } from '@/i18n'
import {
  listGarments,
  createGarment,
  renameGarment,
  duplicateGarment,
  deleteGarment,
  toggleFavorite,
  type GarmentSummary,
} from '../../garment-model/garmentLibrary'
import { makeEmptyGarment } from '../../garment-model/garmentGeneration'
import { analyzeGarment } from '../../garment-model/analysis/analyzeGarment'
import { readGarmentFile } from '../../garment-model/analysis/fileReader'
import { filesFromDataTransfer, keepGarmentFiles } from '../../garment-model/analysis/dropFiles'
import './garments.css'

type SortKey = 'newest' | 'oldest' | 'alpha' | 'favorites'
const SORTS: { key: SortKey }[] = [{ key: 'newest' }, { key: 'oldest' }, { key: 'alpha' }, { key: 'favorites' }]

const IcoMore = (p: SVGProps<SVGSVGElement>) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" {...p}>
    <circle cx="5" cy="12" r="1.9" />
    <circle cx="12" cy="12" r="1.9" />
    <circle cx="19" cy="12" r="1.9" />
  </svg>
)
const IcoStar = (p: SVGProps<SVGSVGElement>) => (
  <svg width="16" height="16" viewBox="0 0 24 24" strokeWidth={1.6} strokeLinejoin="round" {...p}>
    <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9L12 3.5Z" />
  </svg>
)

function timeAgo(ms: number, t: ReturnType<typeof useT>): string {
  const s = Math.max(1, Math.floor((Date.now() - ms) / 1000))
  if (s < 60) return t('garments.time.now')
  const m = Math.floor(s / 60)
  if (m < 60) return t('garments.time.minutes', { n: m })
  const h = Math.floor(m / 60)
  if (h < 24) return t('garments.time.hours', { n: h })
  const d = Math.floor(h / 24)
  if (d < 30) return t('garments.time.days', { n: d })
  return new Date(ms).toLocaleDateString()
}
function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function GarmentsHome() {
  const navigate = useNavigate()
  const toast = useToast()
  const t = useT()
  const { user } = useAuth()
  const userId = user?.id

  const [garments, setGarments] = useState<GarmentSummary[]>(() => (userId ? listGarments(userId) : []))
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('newest')
  const [menuId, setMenuId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameText, setRenameText] = useState('')

  const refresh = useCallback(() => {
    if (userId) setGarments(listGarments(userId))
  }, [userId])

  // An open kebab menu closes on ANY outside click (search box, sort bar, page background) —
  // not only clicks inside the card grid.
  useEffect(() => {
    if (!menuId) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null
      if (!t?.closest('.gm-menu') && !t?.closest('.gm-kebab')) setMenuId(null)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menuId])

  // Create a garment = start an empty editable garment and open the editor directly (no wizard).
  // Inside the editor the user picks a creation method: Create with AI, Draw, or Import (Part 5).
  const createNew = useCallback(() => {
    if (!userId) return
    const summary = createGarment(userId, makeEmptyGarment(), { name: 'Untitled Garment', category: 'Custom', origin: 'blank' })
    navigate(`/suite/garment-lab/${summary.id}`)
  }, [userId, navigate])

  // Import = the Garment Analysis Engine. Pick one or MANY SVG/AI/PDF flats → each is analyzed
  // into an editable Smart Garment (body/sleeves/collar/buttons…). One file opens in the editor;
  // a batch fills the grid and reports a summary.
  const importInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const dragDepth = useRef(0)
  const importGarments = useCallback(
    async (files: File[]) => {
      if (!userId || files.length === 0) return
      setImporting(true)
      let created = 0
      let skipped = 0
      let single: { id: string; garment: import('../../garment-model/editableGarment').EditableGarment; report: import('../../garment-model/analysis/smartGarmentMapping').MapReport } | null = null
      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          setImportProgress({ current: i + 1, total: files.length })
          try {
            const read = await readGarmentFile(file)
            if (read.kind === 'unknown') {
              skipped++
              continue
            }
            const { garment, report } = await analyzeGarment({ text: read.text, bytes: read.bytes, filename: file.name })
            const summary = createGarment(userId, garment, { name: garment.name, category: garment.category, origin: 'upload' })
            created++
            single = { id: summary.id, garment, report }
          } catch {
            skipped++
          }
          // let the UI breathe between files so the progress + grid update
          await new Promise((r) => setTimeout(r, 0))
        }
        refresh()
        if (files.length === 1 && single) {
          const { garment, report } = single
          if (report.regionCount > 0) {
            const parts = Object.entries(report.types).map(([ty, n]) => `${n} ${ty}`).join(', ')
            const learned = report.matchedPrior ? t('garments.toast.learned') : ''
            toast(t('garments.toast.analyzed', { name: garment.name, count: report.regionCount, parts, learned }), 'success')
          } else {
            toast(t('garments.toast.importedNoRegions', { name: garment.name }), 'info')
          }
          navigate(`/suite/garment-lab/${single.id}`)
        } else {
          const base = created === 1 ? t('garments.toast.importedOne', { n: created }) : t('garments.toast.importedMany', { n: created })
          const suffix = skipped ? t('garments.toast.skippedSuffix', { n: skipped }) : ''
          toast(`${base}${suffix}.`, created ? 'success' : 'info')
        }
      } finally {
        setImporting(false)
        setImportProgress(null)
      }
    },
    [userId, navigate, refresh, toast, t],
  )

  // ---- Drag & drop: drop files OR a whole folder of garment flats anywhere on the page. ----
  const onDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault()
      dragDepth.current = 0
      setDragging(false)
      const all = await filesFromDataTransfer(e.dataTransfer)
      const garments = keepGarmentFiles(all)
      if (garments.length === 0) {
        toast(t('garments.toast.noFlats'), 'info')
        return
      }
      void importGarments(garments)
    },
    [importGarments, toast, t],
  )
  const onDragOver = useCallback((e: DragEvent) => {
    if (e.dataTransfer?.types?.includes('Files')) e.preventDefault()
  }, [])
  const onDragEnter = useCallback((e: DragEvent) => {
    if (!e.dataTransfer?.types?.includes('Files')) return
    dragDepth.current += 1
    setDragging(true)
  }, [])
  const onDragLeave = useCallback(() => {
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDragging(false)
  }, [])
  /** Wrap a page with the whole-page drop target + the drag overlay. */
  const withDrop = (content: ReactNode): ReactNode => (
    <div className="gm-dropwrap" onDragEnter={onDragEnter} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      {content}
      {dragging && (
        <div className="gm-drop-overlay" aria-hidden="true">
          <div className="gm-drop-overlay__card">
            <div className="gm-drop-overlay__glyph">🧥</div>
            <b>{t('garments.drop.title')}</b>
            <small>{t('garments.drop.subtitle')}</small>
          </div>
        </div>
      )}
    </div>
  )

  // Reload when auth hydrates after mount (else a user with garments could see the empty state).
  useEffect(() => {
    refresh()
  }, [refresh])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = garments.filter((g) => q === '' || g.name.toLowerCase().includes(q) || g.category.toLowerCase().includes(q))
    const sorted = [...filtered]
    if (sort === 'newest') sorted.sort((a, b) => b.updatedAt - a.updatedAt)
    else if (sort === 'oldest') sorted.sort((a, b) => a.updatedAt - b.updatedAt)
    else if (sort === 'alpha') sorted.sort((a, b) => a.name.localeCompare(b.name))
    else if (sort === 'favorites') sorted.sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.updatedAt - a.updatedAt)
    return sorted
  }, [garments, query, sort])

  // Clicking a garment opens it in the Design Studio to DESIGN it (graphics, colour, prints) —
  // that is what "open a garment" means for most people. Editing the underlying structure
  // (regions, panels) is the advanced path and lives in the Garment Lab, one menu click away.
  // Always open a garment as a FRESH design (blank canvas) — never the previously-saved one. A new
  // design id per open keys it as its own new file (reachable across reloads); the garment is just
  // the reusable base.
  const open = (id: string) => navigate(`/suite/studio?garment=${id}&design=${uid('des')}`)
  const editStructure = (id: string) => navigate(`/suite/garment-lab/${id}`)

  const commitRename = (id: string) => {
    if (userId) renameGarment(userId, id, renameText)
    setRenamingId(null)
    refresh()
  }

  if (!userId) {
    return (
      <SuitePage eyebrow={t('garments.eyebrow')} title={t('garments.title')} subtitle={t('garments.signInSubtitle')}>
        <div />
      </SuitePage>
    )
  }

  // ---- Empty state: premium onboarding ----
  if (garments.length === 0) {
    return withDrop(
      <SuitePage eyebrow={t('garments.eyebrow')} title={t('garments.title')}>
        <div className="gm-onboard">
          <div className="gm-onboard__glyph" aria-hidden="true">🧥</div>
          <h2>{t('garments.onboard.welcome')}</h2>
          <p className="gm-onboard__lead">{t('garments.onboard.lead')}</p>
          <ul className="gm-onboard__list">
            <li>{t('garments.onboard.itemSleeves')}</li>
            <li>{t('garments.onboard.itemPockets')}</li>
            <li>{t('garments.onboard.itemCollars')}</li>
            <li>{t('garments.onboard.itemCuffs')}</li>
            <li>{t('garments.onboard.itemDetail')}</li>
          </ul>
          <button type="button" className="s-btn s-btn--accent gm-onboard__cta" onClick={createNew}>
            {t('garments.onboard.cta')}
          </button>
          <p className="gm-onboard__hint">{t('garments.onboard.hint')}</p>
        </div>
      </SuitePage>,
    )
  }

  // ---- My Garments ----
  return withDrop(
    <SuitePage
      eyebrow={t('garments.eyebrow')}
      title={t('garments.title')}
      subtitle={t('garments.subtitle')}
      actions={
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            ref={importInputRef}
            type="file"
            accept=".svg,.ai,.pdf"
            multiple
            hidden
            onChange={(e) => {
              const files = e.target.files ? Array.from(e.target.files) : []
              e.target.value = ''
              if (files.length) void importGarments(files)
            }}
          />
          <button
            type="button"
            className="s-btn s-btn--ghost"
            onClick={() => importInputRef.current?.click()}
            disabled={importing}
            title={t('garments.import.title')}
          >
            {importing
              ? importProgress
                ? t('garments.import.analyzingProgress', { current: importProgress.current, total: importProgress.total })
                : t('garments.import.analyzing')
              : t('garments.import.button')}
          </button>
          <button type="button" className="s-btn s-btn--accent" onClick={createNew}>
            {t('garments.create')}
          </button>
        </div>
      }
    >
      <div className="gm-tools">
        <input className="gm-search" type="search" placeholder={t('garments.searchPlaceholder')} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={t('garments.searchAria')} />
        <div className="gm-sorts">
          {SORTS.map((s) => (
            <button key={s.key} type="button" className={`gm-sort${sort === s.key ? ' is-active' : ''}`} onClick={() => setSort(s.key)}>
              {t(`garments.sort.${s.key}`)}
            </button>
          ))}
        </div>
      </div>

      <span className="gm-section">
        {query
          ? visible.length === 1
            ? t('garments.resultOne', { n: visible.length })
            : t('garments.resultMany', { n: visible.length })
          : t('garments.section.mine')}
      </span>

      <div className="gm-grid" onClick={() => setMenuId(null)}>
        {visible.map((g) => (
          <article key={g.id} className="gm-card">
            <div
              className="gm-card__thumb"
              role="button"
              tabIndex={0}
              onClick={() => open(g.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(g.id) } }}
              title={t('garments.card.designTitle')}
              aria-label={t('garments.card.designAria', { name: g.name })}
            >
              <img src={g.thumb} alt={g.name} />
              {g.origin === 'ai' && <span className="gm-badge">{t('garments.badge.ai')}</span>}
              {g.origin === 'photo' && <span className="gm-badge gm-badge--photo">{t('garments.badge.photo')}</span>}
              {g.origin === 'shop' && <span className="gm-badge gm-badge--shop">{t('garments.badge.shop')}</span>}
              {g.origin === 'upload' && <span className="gm-badge gm-badge--shop">{t('garments.badge.imported')}</span>}
              <button
                type="button"
                className={`gm-fav${g.favorite ? ' is-on' : ''}`}
                title={g.favorite ? t('garments.card.unfavorite') : t('garments.card.favorite')}
                aria-pressed={g.favorite}
                onClick={(e) => { e.stopPropagation(); toggleFavorite(userId, g.id); refresh() }}
              >
                <IcoStar fill={g.favorite ? 'currentColor' : 'none'} stroke="currentColor" />
              </button>
            </div>

            <div className="gm-card__body">
              <div className="gm-card__row">
                {renamingId === g.id ? (
                  <input
                    className="gm-rename"
                    autoFocus
                    value={renameText}
                    onChange={(e) => setRenameText(e.target.value)}
                    onBlur={() => commitRename(g.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitRename(g.id); if (e.key === 'Escape') setRenamingId(null) }}
                  />
                ) : (
                  <h3 className="gm-card__name" title={g.name}>{g.name}</h3>
                )}
                <div className="gm-menu-wrap">
                  <button type="button" className="gm-kebab" aria-label={t('garments.card.actionsAria')} onClick={(e) => { e.stopPropagation(); setMenuId(menuId === g.id ? null : g.id) }}>
                    <IcoMore />
                  </button>
                  {menuId === g.id && (
                    <div className="gm-menu" role="menu" onClick={(e) => e.stopPropagation()}>
                      <button type="button" role="menuitem" onClick={() => { setMenuId(null); open(g.id) }}>{t('garments.menu.design')}</button>
                      <button type="button" role="menuitem" onClick={() => { setMenuId(null); editStructure(g.id) }}>{t('garments.menu.editStructure')}</button>
                      <button type="button" role="menuitem" onClick={() => { setMenuId(null); setRenamingId(g.id); setRenameText(g.name) }}>{t('garments.menu.rename')}</button>
                      <button type="button" role="menuitem" onClick={() => {
                        setMenuId(null)
                        const dup = duplicateGarment(userId, g.id)
                        refresh()
                        // Honest feedback: only claim success when the duplicate actually exists.
                        if (dup) toast(t('garments.toast.duplicated', { name: dup.name }), 'success')
                        else toast(t('garments.toast.duplicateFail'), 'info')
                      }}>{t('garments.menu.duplicate')}</button>
                      <button type="button" role="menuitem" className="gm-menu__danger" onClick={() => {
                        setMenuId(null)
                        // Deleting destroys the garment AND its whole revision history — confirm first.
                        if (!window.confirm(t('garments.confirm.delete', { name: g.name }))) return
                        deleteGarment(userId, g.id)
                        refresh()
                        toast(t('garments.toast.deleted', { name: g.name }))
                      }}>{t('garments.menu.delete')}</button>
                    </div>
                  )}
                </div>
              </div>
              <div className="gm-card__meta">
                <span>{g.category}</span>
                <span>·</span>
                <span>{t('garments.card.regions', { n: g.regionCount })}</span>
              </div>
              <div className="gm-card__stamps">
                <span>{t('garments.card.edited', { when: timeAgo(g.updatedAt, t) })}</span>
                <span>{t('garments.card.created', { when: fmtDate(g.createdAt) })}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </SuitePage>,
  )
}
