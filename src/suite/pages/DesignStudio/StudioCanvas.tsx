import { useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import { IcoChevron } from '../../components/ui/Icons'
import { GARMENT_GLYPHS, type GarmentKind } from '../../components/ui/Garments'
import { useToast } from '../../components/ui/Toast'
import { downloadBlob, slugify, svgElementToPngBlob } from '../../lib/download'
import { downloadTechPackPdf } from '../../lib/exporters'
import './canvas.css'

const TOOLS = ['move', 'rotate', 'pan', 'node', 'frame', 'measure', 'crop']
const VIEWS = ['Front', 'Angle', 'Side', 'Hood']
const FLATS = ['Front', 'Back', 'Side', 'Details']
const CANVAS_TOOLS = ['orbit', 'zoom', 'fit', 'grid', 'measure', 'light']

const ZOOM_MIN = 0.4
const ZOOM_MAX = 3
/** Multiplicative step used by the toolbar zoom in/out buttons. */
const ZOOM_BTN_STEP = 1.2
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

const SIZE_ROWS: [string, string[]][] = [
  ['Chest', ['58', '60', '62', '64', '66']],
  ['Length', ['70', '72', '74', '76', '78']],
  ['Shoulder', ['56', '58', '60', '62', '64']],
  ['Sleeve', ['60', '61', '62', '63', '64']],
]

type Props = {
  garmentName: string
  garmentKind: GarmentKind
  garmentFit: string
  /** Show the gentle "what next" hints (when nothing is selected). */
  showHints?: boolean
  /** The design's name + save status live with the studio (auto-save owns them). */
  designName?: string
  onRenameDesign?: (name: string) => void
  saveState?: 'saved' | 'saving' | 'unsaved'
}

export function StudioCanvas({
  garmentName,
  garmentKind,
  garmentFit,
  showHints,
  designName: designNameProp,
  onRenameDesign,
  saveState,
}: Props) {
  const toast = useToast()
  const [mode, setMode] = useState<'3D' | '2D'>('3D')
  const [view, setView] = useState('Front')
  const [tool, setTool] = useState('move')
  const [bottomTab, setBottomTab] = useState<'Tech Pack' | 'Size Chart'>('Tech Pack')
  // The bottom strip collapses so the stage can be the whole studio.
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
  const [showGrid, setShowGrid] = useState(true)
  const [showSafeArea, setShowSafeArea] = useState(true)
  const [isRendering, setIsRendering] = useState(false)
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

  function renameDesign() {
    const next = window.prompt('Rename this design', designName)
    if (next == null) return
    const trimmed = next.trim()
    if (!trimmed || trimmed === designName) return
    if (onRenameDesign) onRenameDesign(trimmed)
    else setLocalName(trimmed)
    toast(`Renamed to “${trimmed}”.`, 'success')
  }

  async function renderPng() {
    if (isRendering) return
    const svg = stageRef.current?.querySelector('svg')
    if (!svg) {
      toast('Nothing to render yet.', 'info')
      return
    }
    setIsRendering(true)
    try {
      const blob = await svgElementToPngBlob(svg)
      downloadBlob(blob, `${slugify(designName)}.png`)
      toast(`Rendered “${designName}” to PNG.`, 'accent')
    } catch {
      toast('Render failed — could not rasterise the garment.', 'info')
    } finally {
      setIsRendering(false)
    }
  }

  function handleCanvasTool(t: string) {
    switch (t) {
      case 'zoom':
        applyView(clampZoom(zoomRef.current * ZOOM_BTN_STEP), panRef.current)
        toast('Zoomed in.')
        break
      case 'fit':
        applyView(1, { x: 0, y: 0 })
        toast('Fit to view.')
        break
      case 'grid':
        setShowGrid((g) => !g)
        toast(showGrid ? 'Grid hidden.' : 'Grid shown.')
        break
      case 'orbit':
        applyView(clampZoom(zoomRef.current / ZOOM_BTN_STEP), panRef.current)
        toast('Zoomed out.')
        break
      default:
        setTool(t)
        toast(`${t.charAt(0).toUpperCase() + t.slice(1)} tool`)
    }
  }

  function toggleSafeArea() {
    setShowSafeArea((s) => !s)
    toast(showSafeArea ? 'Safe area hidden.' : 'Safe area shown.')
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

  function openFlat(flat: string) {
    try {
      const filename = downloadTechPackPdf({
        name: `${designName} — ${flat}`,
        kind: garmentKind,
        fit: garmentFit,
        placement: flat,
      })
      toast(`Exported ${filename}`, 'accent')
    } catch {
      toast('Could not generate the flat. Please try again.', 'info')
    }
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
        <div className="ds-mode">
          {(['3D', '2D'] as const).map((m) => (
            <button key={m} className={mode === m ? 'is-active' : ''} type="button" onClick={() => setMode(m)}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Stage */}
      <div className="ds-stage">
        <div className="ds-toolrail">
          {TOOLS.map((t, i) => (
            <button
              key={t}
              type="button"
              className={tool === t ? 'is-active' : ''}
              aria-label={t}
              title={t.charAt(0).toUpperCase() + t.slice(1)}
              onClick={() => setTool(t)}
            >
              <ToolGlyph i={i} />
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
              <Glyph width="340" height="340" />
              <span className="ds-print">VISIONARY</span>
              {showSafeArea && (
                <>
                  <div className="cv-centerline" aria-hidden="true" />
                  <div className="cv-safe" aria-hidden="true">
                    <span className="cv-safe__label">SAFE PRINT AREA</span>
                    <div className="cv-safe__embroidery">
                      <span>EMBROIDERY</span>
                    </div>
                  </div>
                </>
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
          {showHints && (
            <div className="cv-hints" aria-hidden="true">
              <span>Select a layer to edit it</span>
              <i>or</i>
              <span>Ask THREADOS AI above</span>
              <i>or</i>
              <span>Drag an asset from the Library</span>
            </div>
          )}
        </div>

        <div className="ds-views">
          {VIEWS.map((v) => (
            <button
              key={v}
              type="button"
              className={`ds-view${view === v ? ' is-active' : ''}`}
              aria-label={`${v} view`}
              title={`${v} view`}
              onClick={() => {
                setView(v)
                toast(`${v} view`, 'default')
              }}
            >
              <Glyph width="34" height="34" />
            </button>
          ))}
        </div>

        <div className="ds-canvas-toolbar">
          <div className="ds-canvas-toolbar__group">
            {CANVAS_TOOLS.map((t, i) => (
              <button
                key={t}
                type="button"
                aria-label={t}
                title={t.charAt(0).toUpperCase() + t.slice(1)}
                onClick={() => handleCanvasTool(t)}
              >
                <ToolGlyph i={i} small />
              </button>
            ))}
            <button
              type="button"
              className={`cv-safe-toggle${showSafeArea ? ' is-active' : ''}`}
              aria-label="Safe area"
              aria-pressed={showSafeArea}
              title="Safe area"
              onClick={toggleSafeArea}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="4.5" y="4.5" width="15" height="15" rx="3" strokeDasharray="3 3" />
              </svg>
            </button>
          </div>
          <button
            className="ds-render"
            type="button"
            title="Render a PNG of the current garment"
            disabled={isRendering}
            onClick={renderPng}
          >
            {isRendering ? 'Rendering…' : 'Render'} <IcoChevron width="14" height="14" />
          </button>
        </div>
      </div>

      {/* Tech pack / size chart strip — collapsible for a pure-canvas studio */}
      {stripHidden ? (
        <button className="cv-strip-bar" type="button" onClick={toggleStrip} aria-expanded={false} title="Show tech pack panel">
          <span>Tech Pack · Size Chart</span>
          <IcoChevron width="14" height="14" style={{ transform: 'rotate(180deg)' }} />
        </button>
      ) : (
      <div className="ds-techpack">
        <div className="ds-techpack__tabs">
          {(['Tech Pack', 'Size Chart'] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={`ds-tp-tab${bottomTab === t ? ' is-active' : ''}`}
              onClick={() => setBottomTab(t)}
            >
              {t}
            </button>
          ))}
          <button
            className="cv-strip-hide"
            type="button"
            onClick={toggleStrip}
            aria-expanded
            aria-label="Hide tech pack panel"
            title="Hide panel — more room for the canvas"
          >
            <IcoChevron width="14" height="14" />
          </button>
        </div>

        {bottomTab === 'Tech Pack' ? (
          <div className="ds-flats">
            {FLATS.map((f) => (
              <button
                className="ds-flat"
                type="button"
                key={f}
                title={`Download ${f} flat as a PDF tech pack`}
                onClick={() => openFlat(f)}
              >
                <div className="ds-flat__art">
                  <Glyph width="66" height="66" />
                </div>
                <span>{f}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="ds-sizechart">
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>S</th>
                  <th>M</th>
                  <th>L</th>
                  <th>XL</th>
                  <th>XXL</th>
                </tr>
              </thead>
              <tbody>
                {SIZE_ROWS.map(([label, vals]) => (
                  <tr key={label}>
                    <td>{label}</td>
                    {vals.map((v) => (
                      <td key={v}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}
    </main>
  )
}

function ToolGlyph({ i, small }: { i: number; small?: boolean }) {
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
  const glyphs = [
    <path key="0" d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3" />,
    <path key="1" d="M4 12a8 8 0 1 1 3 6M4 12v-4M4 12h4" />,
    <path key="2" d="M12 3v18M3 12h18" />,
    <><circle key="a" cx="6" cy="6" r="2" /><circle key="b" cx="18" cy="18" r="2" /><path key="c" d="M8 6h8a2 2 0 0 1 2 2v8" /></>,
    <rect key="3" x="4" y="4" width="16" height="16" rx="2" />,
    <path key="4" d="M4 4v16M4 4h16M8 8v4M12 8v8M16 8v4" />,
    <path key="5" d="M6 6h12v12H6zM3 9h3M18 9h3M3 15h3M18 15h3" />,
  ]
  return <svg {...base}>{glyphs[i % glyphs.length]}</svg>
}
