/**
 * Garments — the workspace home and the first thing users see. Garments are managed here; the
 * editor only opens on Open/Continue. Shows a premium onboarding when empty, otherwise the
 * My-Garments grid with search, sort, and per-card actions.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode, type SVGProps } from 'react'
import { useNavigate } from 'react-router-dom'
import { SuitePage } from '../_shared/SuitePage'
import { useAuth } from '../../auth/auth'
import { useToast } from '../../components/ui/Toast'
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
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'newest', label: 'Newest' },
  { key: 'oldest', label: 'Oldest' },
  { key: 'alpha', label: 'Alphabetical' },
  { key: 'favorites', label: 'Favorites' },
]

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

function timeAgo(ms: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ms) / 1000))
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(ms).toLocaleDateString()
}
function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function GarmentsHome() {
  const navigate = useNavigate()
  const toast = useToast()
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
            const parts = Object.entries(report.types).map(([t, n]) => `${n} ${t}`).join(', ')
            const learned = report.matchedPrior ? ' · recognised from a similar garment' : ''
            toast(`Analyzed “${garment.name}” — ${report.regionCount} regions (${parts})${learned}.`, 'success')
          } else {
            toast(`Imported “${garment.name}” — no clear regions detected, edit it in the Studio.`, 'info')
          }
          navigate(`/suite/garment-lab/${single.id}`)
        } else {
          toast(`Imported ${created} garment${created === 1 ? '' : 's'}${skipped ? ` · ${skipped} skipped` : ''}.`, created ? 'success' : 'info')
        }
      } finally {
        setImporting(false)
        setImportProgress(null)
      }
    },
    [userId, navigate, refresh, toast],
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
        toast('No SVG / AI / PDF garment flats found in that drop.', 'info')
        return
      }
      void importGarments(garments)
    },
    [importGarments, toast],
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
            <b>Drop garment flats or a folder</b>
            <small>SVG · AI · PDF — each is analyzed into an editable garment</small>
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
  const open = (id: string) => navigate(`/suite/design?garment=${id}`)
  const editStructure = (id: string) => navigate(`/suite/garment-lab/${id}`)

  const commitRename = (id: string) => {
    if (userId) renameGarment(userId, id, renameText)
    setRenamingId(null)
    refresh()
  }

  if (!userId) {
    return (
      <SuitePage eyebrow="Workspace" title="Garments" subtitle="Sign in to build your garment collection.">
        <div />
      </SuitePage>
    )
  }

  // ---- Empty state: premium onboarding ----
  if (garments.length === 0) {
    return withDrop(
      <SuitePage eyebrow="Workspace" title="Garments">
        <div className="gm-onboard">
          <div className="gm-onboard__glyph" aria-hidden="true">🧥</div>
          <h2>Welcome to THREADOS Garments</h2>
          <p className="gm-onboard__lead">Every garment you create becomes fully editable.</p>
          <ul className="gm-onboard__list">
            <li>Change sleeves</li>
            <li>Move pockets</li>
            <li>Replace collars</li>
            <li>Resize cuffs</li>
            <li>Edit every detail — powered by AI</li>
          </ul>
          <button type="button" className="s-btn s-btn--accent gm-onboard__cta" onClick={createNew}>
            Create your first Garment
          </button>
          <p className="gm-onboard__hint">…or drag a folder of SVG / AI / PDF flats anywhere here to import them all.</p>
        </div>
      </SuitePage>,
    )
  }

  // ---- My Garments ----
  return withDrop(
    <SuitePage
      eyebrow="Workspace"
      title="Garments"
      subtitle="Your garment collection. Open one to edit its structure, or create a new garment."
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
            title="Analyze one or many Illustrator SVG / AI / PDF flats into editable garments"
          >
            {importing
              ? importProgress
                ? `Analyzing ${importProgress.current}/${importProgress.total}…`
                : 'Analyzing…'
              : 'Import garments'}
          </button>
          <button type="button" className="s-btn s-btn--accent" onClick={createNew}>
            Create garment
          </button>
        </div>
      }
    >
      <div className="gm-tools">
        <input className="gm-search" type="search" placeholder="Search garments…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search garments" />
        <div className="gm-sorts">
          {SORTS.map((s) => (
            <button key={s.key} type="button" className={`gm-sort${sort === s.key ? ' is-active' : ''}`} onClick={() => setSort(s.key)}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <span className="gm-section">{query ? `${visible.length} result${visible.length === 1 ? '' : 's'}` : 'My Garments'}</span>

      <div className="gm-grid" onClick={() => setMenuId(null)}>
        {visible.map((g) => (
          <article key={g.id} className="gm-card">
            <div
              className="gm-card__thumb"
              role="button"
              tabIndex={0}
              onClick={() => open(g.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(g.id) } }}
              title="Design this garment"
              aria-label={`Design ${g.name}`}
            >
              <img src={g.thumb} alt={g.name} />
              {g.origin === 'ai' && <span className="gm-badge">AI</span>}
              {g.origin === 'photo' && <span className="gm-badge gm-badge--photo">PHOTO</span>}
              {g.origin === 'shop' && <span className="gm-badge gm-badge--shop">SHOP</span>}
              {g.origin === 'upload' && <span className="gm-badge gm-badge--shop">IMPORTED</span>}
              <button
                type="button"
                className={`gm-fav${g.favorite ? ' is-on' : ''}`}
                title={g.favorite ? 'Unfavorite' : 'Favorite'}
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
                  <button type="button" className="gm-kebab" aria-label="Garment actions" onClick={(e) => { e.stopPropagation(); setMenuId(menuId === g.id ? null : g.id) }}>
                    <IcoMore />
                  </button>
                  {menuId === g.id && (
                    <div className="gm-menu" role="menu" onClick={(e) => e.stopPropagation()}>
                      <button type="button" role="menuitem" onClick={() => { setMenuId(null); open(g.id) }}>Design</button>
                      <button type="button" role="menuitem" onClick={() => { setMenuId(null); editStructure(g.id) }}>Edit structure</button>
                      <button type="button" role="menuitem" onClick={() => { setMenuId(null); setRenamingId(g.id); setRenameText(g.name) }}>Rename</button>
                      <button type="button" role="menuitem" onClick={() => {
                        setMenuId(null)
                        const dup = duplicateGarment(userId, g.id)
                        refresh()
                        // Honest feedback: only claim success when the duplicate actually exists.
                        if (dup) toast(`Duplicated as “${dup.name}”.`, 'success')
                        else toast('Could not duplicate this garment.', 'info')
                      }}>Duplicate</button>
                      <button type="button" role="menuitem" className="gm-menu__danger" onClick={() => {
                        setMenuId(null)
                        // Deleting destroys the garment AND its whole revision history — confirm first.
                        if (!window.confirm(`Delete “${g.name}”? This removes the garment and its entire edit history. This cannot be undone.`)) return
                        deleteGarment(userId, g.id)
                        refresh()
                        toast(`Deleted “${g.name}”.`)
                      }}>Delete</button>
                    </div>
                  )}
                </div>
              </div>
              <div className="gm-card__meta">
                <span>{g.category}</span>
                <span>·</span>
                <span>{g.regionCount} regions</span>
              </div>
              <div className="gm-card__stamps">
                <span>Edited {timeAgo(g.updatedAt)}</span>
                <span>Created {fmtDate(g.createdAt)}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </SuitePage>,
  )
}
