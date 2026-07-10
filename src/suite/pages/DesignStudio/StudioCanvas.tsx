import { useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import { IcoChevron } from '../../components/ui/Icons'
import { GARMENT_GLYPHS, type GarmentKind } from '../../components/ui/Garments'
import { useToast } from '../../components/ui/Toast'
import { viewList } from '../../garments/import/detect'
import { EMPTY_VIEWS, type GarmentViews } from '../../garments/types'
import { CanvasObjects, type Overlays } from './CanvasObjects'
import type { Layer } from './LayersPanel'
import type { CanvasObject } from './objectModel'
import hoodieImg from '../../../assets/cards/hoodie.png'
import teeImg from '../../../assets/cards/tee.png'
import './canvas.css'

/** Photoreal garment backdrops where we have them; glyph fallback otherwise. */
const GARMENT_PHOTO: Partial<Record<GarmentKind, string>> = { hoodie: hoodieImg, tee: teeImg }

// Only the tools that actually do something. Selection/move is the default; pan (also Space)
// grabs the canvas. Rotation/resize happen via a selected object's own handles — no separate tool.
const TOOLS: { id: string; label: string }[] = [
  { id: 'move', label: 'Select & move' },
  { id: 'pan', label: 'Pan canvas (or hold Space)' },
]

const ZOOM_MIN = 0.4
const ZOOM_MAX = 3
/** Exponential sensitivity for wheel zooming. */
const ZOOM_WHEEL_SENSITIVITY = 0.0015
/** How long after the last wheel tick the world keeps its no-transition state. */
const INTERACT_SETTLE_MS = 160

type Pan = { x: number; y: number }

function clampZoom(z: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 10000) / 10000))
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

type Props = {
  garmentName: string
  garmentKind: GarmentKind
  /** The garment's REAL views — drives the dynamic view tabs and the 3D toggle. No fakes. */
  garmentViews?: GarmentViews
  /** The imported garment's real preview (from the Garment Library) — wins over the kind photo. */
  garmentImage?: string
  /** Per-view backdrops (keyed by view label, e.g. 'Front'/'Back') — the view tabs switch the
   *  stage AND the strip thumbnails between REAL views instead of sharing one preview. */
  garmentSvgByView?: Record<string, string> | null
  /** Inline vector markup for the garment — resolution-independent, crisp at any zoom. */
  garmentSvg?: string | null
  /** Show the gentle "what next" hints (when nothing is selected). */
  showHints?: boolean
  /** The design's name + save status live with the studio (auto-save owns them). */
  designName?: string
  onRenameDesign?: (name: string) => void
  saveState?: 'saved' | 'saving' | 'unsaved'
  // ---- editable canvas objects ----
  objects?: Layer[]
  hiddenMap?: Record<string, boolean>
  selectedObjIds?: string[]
  onSelectObj?: (id: string | null, additive?: boolean) => void
  onLiveObj?: (id: string, patch: Partial<CanvasObject>) => void
  onCommitObj?: () => void
  onEditText?: (id: string, text: string) => void
  onAddText?: () => void
  onAddImage?: (file: File) => void
}

export function StudioCanvas({
  garmentName,
  garmentKind,
  garmentViews = EMPTY_VIEWS,
  garmentImage,
  garmentSvg,
  garmentSvgByView,
  designName: designNameProp,
  onRenameDesign,
  saveState,
  objects,
  hiddenMap,
  selectedObjIds,
  onSelectObj,
  onLiveObj,
  onCommitObj,
  onEditText,
  onAddText,
  onAddImage,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()
  // 3D is a REAL capability, not a default. Without a real 3D file the toggle never shows.
  const [mode, setMode] = useState<'3D' | '2D'>('2D')
  const [tool, setTool] = useState('move')
  // Print-zone overlays — optional, all hidden by default.
  const [overlays, setOverlays] = useState<Overlays>({ safe: false, bleed: false, print: false })
  const [overlaysOpen, setOverlaysOpen] = useState(false)
  const toggleOverlay = (k: keyof Overlays) => setOverlays((o) => ({ ...o, [k]: !o[k] }))
  // The active garment view. With per-view backdrops (garmentSvgByView) the tabs genuinely switch
  // the stage between Front/Back; without them the tabs highlight over the single shared preview.
  const [activeView, setActiveView] = useState('')
  // The Garment Views strip collapses so the stage can be the whole studio.
  const [stripHidden, setStripHidden] = useState<boolean>(() => {
    try {
      return localStorage.getItem('threados-strip-hidden') === '1'
    } catch {
      return false
    }
  })
  const toggleStrip = () => {
    setStripHidden((v) => {
      try {
        localStorage.setItem('threados-strip-hidden', v ? '0' : '1')
      } catch {
        /* ignore */
      }
      return !v
    })
  }
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState<Pan>({ x: 0, y: 0 })
  // The grid is a neutral editor backdrop. No fake print-area / embroidery overlays — those
  // implied garment data we don't have. An imported garment loads as just its preview.
  const showGrid = true
  const [spaceHeld, setSpaceHeld] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  // True while actively wheeling — suppresses the world transform transition.
  const [isInteracting, setIsInteracting] = useState(false)
  // Design title: owned by the studio when provided (auto-save), local fallback otherwise.
  const [localName, setLocalName] = useState(garmentName)
  const designName = designNameProp ?? localName

  // Ref to the wrapper so we can grab the live <svg> and rasterise it to PNG.
  const stageRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  // Mirrors of zoom/pan so window/wheel listeners never read stale closures.
  const zoomRef = useRef(1)
  const panRef = useRef<Pan>({ x: 0, y: 0 })
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null)
  const interactTimerRef = useRef<number | null>(null)

  // Single entry point for view changes keeps refs and state in lockstep.
  function applyView(nextZoom: number, nextPan: Pan) {
    zoomRef.current = nextZoom
    panRef.current = nextPan
    setZoom(nextZoom)
    setPan(nextPan)
  }

  function markInteracting() {
    setIsInteracting(true)
    if (interactTimerRef.current != null) window.clearTimeout(interactTimerRef.current)
    interactTimerRef.current = window.setTimeout(() => setIsInteracting(false), INTERACT_SETTLE_MS)
  }

  useEffect(() => {
    setLocalName(garmentName)
  }, [garmentName])

  // Wheel zoom, attached non-passively so the page never scrolls under the canvas.
  // Zoom-to-cursor: the world point under the pointer stays put via pan compensation.
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    function handleWheel(e: WheelEvent) {
      e.preventDefault()
      if (!el) return
      const rect = el.getBoundingClientRect()
      // Cursor offset from the viewport centre — the world's untransformed origin.
      const mx = e.clientX - (rect.left + rect.width / 2)
      const my = e.clientY - (rect.top + rect.height / 2)
      const current = zoomRef.current
      const next = clampZoom(current * Math.exp(-e.deltaY * ZOOM_WHEEL_SENSITIVITY))
      if (next !== current) {
        const ratio = next / current
        const p = panRef.current
        applyView(next, { x: mx - (mx - p.x) * ratio, y: my - (my - p.y) * ratio })
      }
      markInteracting()
    }
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
    // applyView/markInteracting only touch refs and stable state setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Space-to-pan, ignored while typing in form fields.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.code !== 'Space' || isTypingTarget(e.target)) return
      e.preventDefault()
      setSpaceHeld(true)
    }
    function handleKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space') setSpaceHeld(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  // Reap the interaction-settle timer on unmount.
  useEffect(() => {
    return () => {
      if (interactTimerRef.current != null) window.clearTimeout(interactTimerRef.current)
    }
  }, [])

  const Glyph = GARMENT_GLYPHS[garmentKind]

  // Only the views this garment REALLY has — never Front/Back/Side/Details by default.
  const detectedViews = viewList(garmentViews)
  const viewTabs = detectedViews.length > 0 ? detectedViews : ['Preview']
  const hasMultipleViews = viewTabs.length > 1
  // Every view card shows the garment's REAL preview — generic icons are empty-state only.
  const viewPreview = garmentImage

  // Highlight the first real view whenever the garment changes.
  useEffect(() => {
    setActiveView(viewList(garmentViews)[0] ?? 'Preview')
  }, [garmentName, garmentViews])

  function renameDesign() {
    const next = window.prompt('Rename this design', designName)
    if (next == null) return
    const trimmed = next.trim()
    if (!trimmed || trimmed === designName) return
    if (onRenameDesign) onRenameDesign(trimmed)
    else setLocalName(trimmed)
    toast(`Renamed to “${trimmed}”.`, 'success')
  }

  // Snap back to 100% while keeping the viewport-centre point stable.
  function resetZoom() {
    const z = zoomRef.current
    if (z === 1) return
    const p = panRef.current
    applyView(1, { x: p.x / z, y: p.y / z })
    toast('Zoom reset to 100%.')
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    const panIntent = e.button === 1 || (e.button === 0 && (tool === 'pan' || spaceHeld))
    // A left-click on empty canvas (objects stopPropagation) deselects.
    if (e.button === 0 && !panIntent && onSelectObj) onSelectObj(null)
    if (!panIntent) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: panRef.current.x,
      originY: panRef.current.y,
    }
    setIsPanning(true)
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || e.pointerId !== drag.pointerId) return
    applyView(zoomRef.current, {
      x: drag.originX + (e.clientX - drag.startX),
      y: drag.originY + (e.clientY - drag.startY),
    })
  }

  function endPan(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || e.pointerId !== drag.pointerId) return
    dragRef.current = null
    setIsPanning(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }

  // Double-clicking empty canvas (not the garment) fits the view.
  function handleDoubleClick(e: ReactMouseEvent<HTMLDivElement>) {
    if (worldRef.current && worldRef.current.contains(e.target as Node)) return
    applyView(1, { x: 0, y: 0 })
    toast('Fit to view.')
  }

  return (
    <main className="ds-canvas">
      {/* Title bar */}
      <div className="ds-canvas__bar">
        <button className="ds-name" type="button" title="Rename this design" onClick={renameDesign}>
          {designName} <IcoChevron width="15" height="15" />
        </button>
        <span className="ds-saved">
          <span
            className="s-dot"
            style={{
              background:
                saveState === 'saving' ? 'var(--s-warn)' : saveState === 'unsaved' ? 'var(--s-text-4)' : 'var(--s-good)',
            }}
          />{' '}
          {saveState === 'saving' ? 'Saving…' : saveState === 'unsaved' ? 'Edited' : 'Saved'}
        </span>
        <div className="ds-bar-right">
          {/* Single-view garments show the view as a small label instead of a whole bottom strip. */}
          {!hasMultipleViews && <span className="ds-view-chip">View · {viewTabs[0]}</span>}

          {/* Optional print-zone guides — all off by default. */}
          <div className="ds-ov">
            <button
              type="button"
              className={`ds-ov__btn${overlays.safe || overlays.bleed || overlays.print ? ' is-on' : ''}`}
              aria-expanded={overlaysOpen}
              title="Show print guides"
              onClick={() => setOverlaysOpen((v) => !v)}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
                <rect x="4" y="4" width="16" height="16" rx="1.5" strokeDasharray="3 2.5" />
              </svg>
              Guides
            </button>
            {overlaysOpen && (
              <div className="ds-ov__pop" role="dialog" aria-label="Print guides">
                {(['print', 'safe', 'bleed'] as const).map((k) => (
                  <label className="ds-ov__row" key={k}>
                    <input type="checkbox" checked={overlays[k]} onChange={() => toggleOverlay(k)} />
                    <span>{k === 'print' ? 'Print area' : k === 'safe' ? 'Safe area' : 'Bleed'}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* The 3D toggle exists only when a real 3D model was imported — never faked. */}
          {garmentViews.has3D && (
            <div className="ds-mode">
              {(['3D', '2D'] as const).map((m) => (
                <button key={m} className={mode === m ? 'is-active' : ''} type="button" onClick={() => setMode(m)}>
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stage */}
      <div className="ds-stage">
        <div className="ds-toolrail">
          {onAddText && (
            <button type="button" className="ds-toolrail__add" aria-label="Add text" title="Add text" onClick={onAddText}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M5 7V5h14v2M12 5v14M9 19h6" />
              </svg>
            </button>
          )}
          {onAddImage && (
            <>
              <button
                type="button"
                className="ds-toolrail__add"
                aria-label="Add image"
                title="Add image or file"
                onClick={() => fileInputRef.current?.click()}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
                  <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
                  <circle cx="9" cy="10" r="1.8" />
                  <path d="M4 17l5-4 4 3 3-2 4 3" />
                </svg>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/svg+xml,image/webp,image/jpeg"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) onAddImage(f)
                  e.target.value = ''
                }}
              />
            </>
          )}
          {(onAddText || onAddImage) && <span className="ds-toolrail__sep" />}
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={tool === t.id ? 'is-active' : ''}
              aria-label={t.label}
              title={t.label}
              onClick={() => setTool(t.id)}
            >
              <ToolGlyph tool={t.id} />
            </button>
          ))}
        </div>

        <div
          ref={viewportRef}
          className={`ds-viewport cv-viewport${tool === 'pan' || spaceHeld ? ' cv-viewport--pan' : ''}${isPanning ? ' cv-viewport--panning' : ''}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endPan}
          onPointerCancel={endPan}
          onDoubleClick={handleDoubleClick}
        >
          {showGrid && <div className="ds-viewport__grid" aria-hidden="true" />}
          <div
            ref={worldRef}
            className={`cv-world${isInteracting || isPanning ? ' is-interacting' : ''}`}
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
          >
            <div className="ds-garment-3d" ref={stageRef}>
              {garmentSvgByView?.[activeView] || garmentSvg ? (
                <div
                  className="ds-garment-vector"
                  role="img"
                  aria-label={`${garmentName}${garmentSvgByView?.[activeView] ? ` — ${activeView}` : ''}`}
                  dangerouslySetInnerHTML={{ __html: garmentSvgByView?.[activeView] ?? (garmentSvg as string) }}
                />
              ) : garmentImage ? (
                <img className="ds-garment-photo" src={garmentImage} alt={garmentName} draggable={false} />
              ) : GARMENT_PHOTO[garmentKind] ? (
                <img className="ds-garment-photo" src={GARMENT_PHOTO[garmentKind]} alt={garmentName} draggable={false} />
              ) : (
                <Glyph width="340" height="340" />
              )}
              {objects && onSelectObj && onLiveObj && onCommitObj && onEditText && (
                <CanvasObjects
                  objects={objects}
                  hidden={hiddenMap ?? {}}
                  selectedIds={selectedObjIds ?? []}
                  onSelect={onSelectObj}
                  onLive={onLiveObj}
                  onCommit={onCommitObj}
                  onEditText={onEditText}
                  overlays={overlays}
                />
              )}
            </div>
          </div>
          <button
            type="button"
            className="cv-zoom-chip"
            title="Reset zoom to 100%"
            aria-label={`Zoom ${Math.round(zoom * 100)} percent — click to reset to 100%`}
            onClick={resetZoom}
          >
            {Math.round(zoom * 100)}%
          </button>
        </div>
      </div>

      {/* Garment Views — only when the garment has more than one real view. A single view
          shows as a small chip in the title bar instead, so we never waste space here.
          Not a Tech Pack: real tech-pack generation is a later milestone. */}
      {hasMultipleViews &&
        (stripHidden ? (
          <button className="cv-strip-bar" type="button" onClick={toggleStrip} aria-expanded={false} title="Show garment views">
            <span>Garment Views</span>
            <IcoChevron width="14" height="14" style={{ transform: 'rotate(180deg)' }} />
          </button>
        ) : (
          <div className="ds-techpack">
            <div className="ds-techpack__tabs">
              <span className="ds-tp-title">Garment Views</span>
              <button
                className="cv-strip-hide"
                type="button"
                onClick={toggleStrip}
                aria-expanded
                aria-label="Hide garment views"
                title="Hide panel — more room for the canvas"
              >
                <IcoChevron width="14" height="14" />
              </button>
            </div>

            <div className="ds-flats">
              {viewTabs.map((v) => (
                <button
                  className={`ds-flat${activeView === v ? ' is-active' : ''}`}
                  type="button"
                  key={v}
                  title={`${v} view`}
                  onClick={() => setActiveView(v)}
                >
                  <div className="ds-flat__art">
                    {garmentSvgByView?.[v] ? (
                      <img
                        className="ds-flat__img"
                        src={`data:image/svg+xml,${encodeURIComponent(garmentSvgByView[v])}`}
                        alt={`${garmentName} — ${v}`}
                        draggable={false}
                      />
                    ) : viewPreview ? (
                      <img className="ds-flat__img" src={viewPreview} alt={`${garmentName} — ${v}`} draggable={false} />
                    ) : (
                      <Glyph width="66" height="66" />
                    )}
                  </div>
                  <span>{v}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
    </main>
  )
}

function ToolGlyph({ tool, small }: { tool: string; small?: boolean }) {
  const sz = small ? 16 : 18
  const base = {
    width: sz,
    height: sz,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  const glyphs: Record<string, JSX.Element> = {
    // arrow cursor (select & move)
    move: <path d="M5 3l14 7-6 2-2 6L5 3Z" />,
    // hand (pan)
    pan: <path d="M8 12V6a1.5 1.5 0 0 1 3 0v5m0-1V5a1.5 1.5 0 0 1 3 0v6m0-1V6.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-1a5 5 0 0 1-4-2.2L5 15a1.6 1.6 0 0 1 2.6-1.8L8.5 14" />,
  }
  return <svg {...base}>{glyphs[tool] ?? glyphs.move}</svg>
}
