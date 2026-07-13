import { useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import { IcoChevron } from '../../components/ui/Icons'
import { GARMENT_GLYPHS, type GarmentKind } from '../../components/ui/Garments'
import { useToast } from '../../components/ui/Toast'
import { viewList } from '../../garments/import/detect'
import { EMPTY_VIEWS, type GarmentViews } from '../../garments/types'
import { CanvasObjects, type Overlays } from './CanvasObjects'
import { StudioRegionLayer, labelToViewId } from './StudioRegionLayer'
import type { EditableGarment } from '../../garment-model/editableGarment'
import type { Layer } from './LayersPanel'
import type { CanvasObject, ShapeGeom, ShapeKind } from './objectModel'
import './canvas.css'

type ToolDef = { id: string; label: string; hint: string; key?: string; soon?: boolean; note?: string; action?: 'text' | 'image' }
type ToolGroup = { name: string; tools: ToolDef[] }

// The professional tool palette, grouped by workflow. A working tool either switches the active
// canvas tool or fires an insert action; a "soon" tool is visible but clearly not yet functional —
// never dead UI: clicking one explains exactly what is coming. Rectangle/Ellipse draw REAL vector
// objects that behave like every other Studio object (layers, undo, selection, save, export…).
const TOOL_GROUPS: ToolGroup[] = [
  {
    name: 'Select',
    tools: [
      { id: 'move', label: 'Select', hint: 'Select & move — V', key: 'v' },
      { id: 'pan', label: 'Pan', hint: 'Pan the canvas (or hold Space) — H', key: 'h' },
    ],
  },
  {
    name: 'Vector',
    tools: [
      { id: 'rect', label: 'Rectangle', hint: 'Rectangle — drag on the garment · R', key: 'r' },
      { id: 'ellipse', label: 'Ellipse', hint: 'Ellipse — drag on the garment · O', key: 'o' },
      { id: 'pen', label: 'Pen', hint: 'Pen — bézier paths & anchor points', soon: true, note: 'The Pen tool — bézier curves, anchor-point editing, boolean & pathfinder ops — is coming soon. Rectangle and Ellipse already draw real, fully-editable vector objects.' },
    ],
  },
  {
    name: 'Content',
    tools: [
      { id: 'text', label: 'Text', hint: 'Add text — T', key: 't', action: 'text' },
      { id: 'image', label: 'Image', hint: 'Add an image or file', action: 'image' },
    ],
  },
  {
    name: 'Paint',
    tools: [
      { id: 'brush', label: 'Brush', hint: 'Paint — pencil, marker, fabric & texture brushes', soon: true, note: 'Painting — pencil, brush, marker, airbrush, fabric, denim & leather brushes, with pressure & tilt — is coming soon. It ships with the loom studios iPad app; see Connect App.' },
    ],
  },
  {
    name: 'Build',
    tools: [
      { id: 'build', label: 'Build', hint: 'Garment builder — pockets, hoods, collars, zips', soon: true, note: 'Garment building — add pocket, hood, collar, zipper, ribbing, waistband; duplicate & mirror panels with smart symmetry — is coming soon.' },
    ],
  },
]

/** Tools that change the canvas pointer behaviour (vs. one-shot insert actions). */
const CANVAS_TOOLS = new Set(['move', 'pan', 'rect', 'ellipse'])
/** Tools that draw a new vector object by dragging a box on the canvas. */
const DRAW_TOOLS = new Set(['rect', 'ellipse'])
/** Smallest drag (px) that counts as a deliberate box; a mere click makes a default-sized shape. */
const CREATE_MIN_DRAG = 6

const ALIGN_TOOLS: { edge: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'; label: string }[] = [
  { edge: 'left', label: 'Align left edges' },
  { edge: 'center', label: 'Align horizontal centers' },
  { edge: 'right', label: 'Align right edges' },
  { edge: 'top', label: 'Align top edges' },
  { edge: 'middle', label: 'Align vertical centers' },
  { edge: 'bottom', label: 'Align bottom edges' },
]

/** Compact align/distribute icons (24×24). */
function AlignGlyph({ edge }: { edge: string }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const }
  switch (edge) {
    case 'left':
      return <svg width="18" height="18" viewBox="0 0 24 24"><line x1="4" y1="4" x2="4" y2="20" {...p} /><rect x="6" y="7" width="13" height="3.4" rx="1" fill="currentColor" /><rect x="6" y="13.6" width="8" height="3.4" rx="1" fill="currentColor" /></svg>
    case 'center':
      return <svg width="18" height="18" viewBox="0 0 24 24"><line x1="12" y1="4" x2="12" y2="20" {...p} /><rect x="5.5" y="7" width="13" height="3.4" rx="1" fill="currentColor" /><rect x="8" y="13.6" width="8" height="3.4" rx="1" fill="currentColor" /></svg>
    case 'right':
      return <svg width="18" height="18" viewBox="0 0 24 24"><line x1="20" y1="4" x2="20" y2="20" {...p} /><rect x="5" y="7" width="13" height="3.4" rx="1" fill="currentColor" /><rect x="10" y="13.6" width="8" height="3.4" rx="1" fill="currentColor" /></svg>
    case 'top':
      return <svg width="18" height="18" viewBox="0 0 24 24"><line x1="4" y1="4" x2="20" y2="4" {...p} /><rect x="7" y="6" width="3.4" height="13" rx="1" fill="currentColor" /><rect x="13.6" y="6" width="3.4" height="8" rx="1" fill="currentColor" /></svg>
    case 'middle':
      return <svg width="18" height="18" viewBox="0 0 24 24"><line x1="4" y1="12" x2="20" y2="12" {...p} /><rect x="7" y="5.5" width="3.4" height="13" rx="1" fill="currentColor" /><rect x="13.6" y="8" width="3.4" height="8" rx="1" fill="currentColor" /></svg>
    case 'bottom':
      return <svg width="18" height="18" viewBox="0 0 24 24"><line x1="4" y1="20" x2="20" y2="20" {...p} /><rect x="7" y="5" width="3.4" height="13" rx="1" fill="currentColor" /><rect x="13.6" y="10" width="3.4" height="8" rx="1" fill="currentColor" /></svg>
    case 'dist-h':
      return <svg width="18" height="18" viewBox="0 0 24 24"><rect x="3" y="6" width="3.2" height="12" rx="1" fill="currentColor" /><rect x="10.4" y="6" width="3.2" height="12" rx="1" fill="currentColor" /><rect x="17.8" y="6" width="3.2" height="12" rx="1" fill="currentColor" /></svg>
    case 'dist-v':
      return <svg width="18" height="18" viewBox="0 0 24 24"><rect x="6" y="3" width="12" height="3.2" rx="1" fill="currentColor" /><rect x="6" y="10.4" width="12" height="3.2" rx="1" fill="currentColor" /><rect x="6" y="17.8" width="12" height="3.2" rx="1" fill="currentColor" /></svg>
    default:
      return null
  }
}

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
  /** An AI-edited garment image (Edit Garment mode) — when set it replaces the backdrop entirely. */
  garmentOverride?: string | null
  /** The garment's neck label (data URL), shown as a third tile in Garment Views. */
  neckLabel?: string | null
  /** Open the neck-label creator. When set, a "Neck Label" tile appears in Garment Views. */
  onNeckLabel?: () => void
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
  /** Design boards ("pages"). Front/Back garment views are the first pages; extra pages are blank
   *  boards. Shown in the bottom Pages strip (the old top versions bar is gone). */
  pages?: { id: string; name: string }[]
  activePageId?: string
  onSwitchPage?: (id: string) => void
  onAddPage?: () => void
  onDeletePage?: (id: string) => void
  // ---- editable canvas objects ----
  objects?: Layer[]
  hiddenMap?: Record<string, boolean>
  selectedObjIds?: string[]
  onSelectObj?: (id: string | null, additive?: boolean) => void
  /** Marquee (rubber-band) selection result — the ids enclosed by the drag box. */
  onMarqueeSelect?: (ids: string[], additive: boolean) => void
  onLiveObj?: (id: string, patch: Partial<CanvasObject>) => void
  onCommitObj?: () => void
  onEditText?: (id: string, text: string) => void
  onAddText?: () => void
  onAddImage?: (file: File) => void
  /** Draw a new vector object from a drag on the canvas (Rectangle / Ellipse tools). */
  onCreateObject?: (shape: ShapeKind, geom: ShapeGeom) => void
  // ---- editable garment regions (select + move parts directly on the garment) ----
  /** The garment with its region tree + overrides (displayGarment). When present, its parts are
   *  selectable + draggable on the canvas via a transparent hit-layer over the backdrop. */
  regionGarment?: EditableGarment | null
  selectedRegionId?: string | null
  onSelectRegion?: (id: string | null) => void
  onMoveRegion?: (id: string, dx: number, dy: number) => void
  /** Right-click on the canvas — objectId is the object under the cursor, or null for empty. */
  onContextMenu?: (x: number, y: number, objectId: string | null) => void
  /** Number of objects currently selected — drives the contextual align toolbar. */
  objectSelectionCount?: number
  onAlign?: (edge: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void
  onDistribute?: (axis: 'h' | 'v') => void
}

export function StudioCanvas({
  garmentName,
  garmentKind,
  garmentViews = EMPTY_VIEWS,
  garmentImage,
  garmentOverride,
  garmentSvg,
  garmentSvgByView,
  neckLabel,
  onNeckLabel,
  designName: designNameProp,
  onRenameDesign,
  saveState,
  pages,
  activePageId,
  onSwitchPage,
  onAddPage,
  onDeletePage,
  objects,
  hiddenMap,
  selectedObjIds,
  onSelectObj,
  onMarqueeSelect,
  onLiveObj,
  onCommitObj,
  onEditText,
  onAddText,
  onAddImage,
  onCreateObject,
  regionGarment,
  selectedRegionId,
  onSelectRegion,
  onMoveRegion,
  onContextMenu,
  objectSelectionCount = 0,
  onAlign,
  onDistribute,
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
  // Neck Label is a view too: when true the stage shows the generated label instead of the garment.
  const [showLabel, setShowLabel] = useState(false)
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
  // Marquee (rubber-band) selection: drag on empty canvas to select every object it encloses.
  const marqueeRef = useRef<{ pointerId: number; startX: number; startY: number; shift: boolean; moved: boolean } | null>(null)
  const [marquee, setMarquee] = useState<{ left: number; top: number; width: number; height: number } | null>(null)
  // Drawing (Rectangle / Ellipse): drag a box on the canvas to create a real vector object.
  const createRef = useRef<{ pointerId: number; startX: number; startY: number } | null>(null)
  const [createBox, setCreateBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null)
  const isDrawTool = DRAW_TOOLS.has(tool)

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

  // Tool keyboard shortcuts (Illustrator/Figma-style single keys), ignored while typing or when a
  // modifier is held (so ⌘-shortcuts elsewhere are untouched).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return
      const def = TOOL_GROUPS.flatMap((g) => g.tools).find((t) => t.key === e.key.toLowerCase())
      if (!def) return
      e.preventDefault()
      if (def.action === 'text') onAddText?.()
      else if (CANVAS_TOOLS.has(def.id)) setTool(def.id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onAddText])

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
    setShowLabel(false)
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
    // Draw tools (Rectangle / Ellipse): a left press begins a create-drag. While a draw tool is
    // active, objects don't intercept the press (see cv-viewport--draw), so you can draw anywhere.
    if (e.button === 0 && !panIntent && isDrawTool && onCreateObject) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        /* capture is best-effort */
      }
      createRef.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY }
      return
    }
    // Empty-canvas left press (objects/regions stopPropagation their own presses): start a marquee.
    // A plain click that never moves past the threshold still deselects (handled on pointer-up).
    if (e.button === 0 && !panIntent && onMarqueeSelect) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        /* capture is best-effort */
      }
      marqueeRef.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, shift: e.shiftKey, moved: false }
      return
    }
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

  const MARQUEE_THRESHOLD = 4

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const cr = createRef.current
    if (cr && e.pointerId === cr.pointerId) {
      const vp = viewportRef.current?.getBoundingClientRect()
      if (!vp) return
      setCreateBox({
        left: Math.min(cr.startX, e.clientX) - vp.left,
        top: Math.min(cr.startY, e.clientY) - vp.top,
        width: Math.abs(e.clientX - cr.startX),
        height: Math.abs(e.clientY - cr.startY),
      })
      return
    }
    const mq = marqueeRef.current
    if (mq && e.pointerId === mq.pointerId) {
      const dx = e.clientX - mq.startX
      const dy = e.clientY - mq.startY
      if (!mq.moved && Math.abs(dx) < MARQUEE_THRESHOLD && Math.abs(dy) < MARQUEE_THRESHOLD) return
      mq.moved = true
      const vp = viewportRef.current?.getBoundingClientRect()
      if (!vp) return
      setMarquee({
        left: Math.min(mq.startX, e.clientX) - vp.left,
        top: Math.min(mq.startY, e.clientY) - vp.top,
        width: Math.abs(dx),
        height: Math.abs(dy),
      })
      return
    }
    const drag = dragRef.current
    if (!drag || e.pointerId !== drag.pointerId) return
    applyView(zoomRef.current, {
      x: drag.originX + (e.clientX - drag.startX),
      y: drag.originY + (e.clientY - drag.startY),
    })
  }

  /** Map the drawn box to print-area fractions and create the vector object, then re-arm Select. */
  function finishCreate(cr: { startX: number; startY: number }, endX: number, endY: number) {
    if (!onCreateObject || !DRAW_TOOLS.has(tool)) return
    const cb = worldRef.current?.querySelector('.co-box')?.getBoundingClientRect()
    if (!cb || cb.width < 1 || cb.height < 1) return
    let wpx = Math.abs(endX - cr.startX)
    let hpx = Math.abs(endY - cr.startY)
    let cx = (cr.startX + endX) / 2
    let cy = (cr.startY + endY) / 2
    // A mere click (no real drag) → a sensible default-sized shape centred on the click.
    if (wpx < CREATE_MIN_DRAG && hpx < CREATE_MIN_DRAG) {
      wpx = cb.width * 0.28
      hpx = wpx
      cx = cr.startX
      cy = cr.startY
    }
    const unit = (v: number) => Math.max(0, Math.min(1, v))
    onCreateObject(tool as ShapeKind, {
      x: unit((cx - cb.left) / cb.width),
      y: unit((cy - cb.top) / cb.height),
      width: wpx / cb.width,
      aspect: hpx / wpx,
    })
    setTool('move') // re-arm Select so the new object can be manipulated immediately
  }

  function endPan(e: ReactPointerEvent<HTMLDivElement>) {
    const cr = createRef.current
    if (cr && e.pointerId === cr.pointerId) {
      createRef.current = null
      setCreateBox(null)
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
      finishCreate(cr, e.clientX, e.clientY)
      return
    }
    const mq = marqueeRef.current
    if (mq && e.pointerId === mq.pointerId) {
      marqueeRef.current = null
      setMarquee(null)
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
      if (!mq.moved) {
        // A plain empty-canvas click still deselects.
        if (!mq.shift) onSelectObj?.(null)
        return
      }
      // Select every visible object whose on-screen box intersects the marquee.
      const left = Math.min(mq.startX, e.clientX)
      const top = Math.min(mq.startY, e.clientY)
      const right = Math.max(mq.startX, e.clientX)
      const bottom = Math.max(mq.startY, e.clientY)
      const hits: string[] = []
      worldRef.current?.querySelectorAll<HTMLElement>('.co-obj[data-id]').forEach((el) => {
        const b = el.getBoundingClientRect()
        if (b.left < right && b.right > left && b.top < bottom && b.bottom > top) {
          const id = el.getAttribute('data-id')
          if (id) hits.push(id)
        }
      })
      onMarqueeSelect?.(hits, mq.shift)
      return
    }
    const drag = dragRef.current
    if (!drag || e.pointerId !== drag.pointerId) return
    dragRef.current = null
    setIsPanning(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }

  /** Click a palette tool: soon → explain, actions → insert, canvas tools → arm. Never dead UI. */
  function onToolClick(t: ToolDef) {
    if (t.soon) {
      toast(t.note ?? 'This tool is coming soon.', 'info')
      return
    }
    if (t.action === 'text') {
      onAddText?.()
      return
    }
    if (t.action === 'image') {
      fileInputRef.current?.click()
      return
    }
    if (CANVAS_TOOLS.has(t.id)) setTool(t.id)
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
          {/* The current view/page now lives in the bottom Pages strip, so no top-right view chip. */}

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
        <div className="ds-toolrail" role="toolbar" aria-label="Studio tools" aria-orientation="vertical">
          {TOOL_GROUPS.map((group, gi) => (
            <div className="ds-toolrail__group" key={group.name} role="group" aria-label={group.name}>
              {gi > 0 && <span className="ds-toolrail__sep" aria-hidden />}
              {group.tools.map((t) => {
                const active = CANVAS_TOOLS.has(t.id) && tool === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`ds-tool${active ? ' is-active' : ''}${t.soon ? ' is-soon' : ''}`}
                    aria-label={t.soon ? `${t.label} (coming soon)` : t.label}
                    aria-pressed={active}
                    title={t.soon ? `${t.hint} · Coming soon` : t.hint}
                    onClick={() => onToolClick(t)}
                  >
                    <ToolGlyph tool={t.id} />
                    {t.soon && <span className="ds-tool__soon" aria-hidden />}
                  </button>
                )
              })}
            </div>
          ))}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/svg+xml,image/webp,image/jpeg"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onAddImage?.(f)
              e.target.value = ''
            }}
          />
        </div>

        <div
          ref={viewportRef}
          className={`ds-viewport cv-viewport${tool === 'pan' || spaceHeld ? ' cv-viewport--pan' : ''}${isPanning ? ' cv-viewport--panning' : ''}${isDrawTool ? ' cv-viewport--draw' : ''}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endPan}
          onPointerCancel={endPan}
          onDoubleClick={handleDoubleClick}
          onContextMenu={(e) => {
            if (!onContextMenu) return
            const objEl = (e.target as HTMLElement).closest<HTMLElement>('.co-obj[data-id]')
            e.preventDefault()
            onContextMenu(e.clientX, e.clientY, objEl?.getAttribute('data-id') ?? null)
          }}
        >
          {showGrid && <div className="ds-viewport__grid" aria-hidden="true" />}
          {marquee && (
            <div
              className="cv-marquee"
              aria-hidden="true"
              style={{ left: marquee.left, top: marquee.top, width: marquee.width, height: marquee.height }}
            />
          )}
          {createBox && (
            <div
              className="cv-create"
              aria-hidden="true"
              style={{ left: createBox.left, top: createBox.top, width: createBox.width, height: createBox.height }}
            />
          )}
          {objectSelectionCount >= 2 && onAlign && (
            <div className="cv-align" role="toolbar" aria-label="Align & distribute">
              {ALIGN_TOOLS.map((t) => (
                <button key={t.edge} type="button" title={t.label} aria-label={t.label} onClick={() => onAlign(t.edge)}>
                  <AlignGlyph edge={t.edge} />
                </button>
              ))}
              {objectSelectionCount >= 3 && onDistribute && (
                <>
                  <span className="cv-align__sep" />
                  <button type="button" title="Distribute horizontally" aria-label="Distribute horizontally" onClick={() => onDistribute('h')}>
                    <AlignGlyph edge="dist-h" />
                  </button>
                  <button type="button" title="Distribute vertically" aria-label="Distribute vertically" onClick={() => onDistribute('v')}>
                    <AlignGlyph edge="dist-v" />
                  </button>
                </>
              )}
            </div>
          )}
          <div
            ref={worldRef}
            className={`cv-world${isInteracting || isPanning ? ' is-interacting' : ''}`}
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
          >
            <div className="ds-garment-3d" ref={stageRef}>
              {showLabel && neckLabel ? (
                <img className="ds-garment-photo ds-necklabel-view" src={neckLabel} alt={`${garmentName} — neck label`} draggable={false} />
              ) : garmentOverride ? (
                <img className="ds-garment-photo" src={garmentOverride} alt={`${garmentName} — AI edit`} draggable={false} />
              ) : garmentSvgByView?.[activeView] || garmentSvg ? (
                <div
                  className="ds-garment-vector"
                  role="img"
                  aria-label={`${garmentName}${garmentSvgByView?.[activeView] ? ` — ${activeView}` : ''}`}
                  dangerouslySetInnerHTML={{ __html: garmentSvgByView?.[activeView] ?? (garmentSvg as string) }}
                />
              ) : garmentImage ? (
                <img className="ds-garment-photo" src={garmentImage} alt={garmentName} draggable={false} />
              ) : (
                <Glyph width="340" height="340" />
              )}
              {regionGarment && onSelectRegion && onMoveRegion && (
                <StudioRegionLayer
                  garment={regionGarment}
                  view={labelToViewId(activeView, regionGarment)}
                  selectedId={selectedRegionId ?? null}
                  interactive={tool !== 'pan' && !spaceHeld}
                  onSelect={onSelectRegion}
                  onMoveRegion={onMoveRegion}
                />
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

      {/* Pages — the garment's Front/Back views are the first pages; extra pages are blank boards; the
          Neck Label is always the last page. (Replaces the old "Garment Views" strip + top versions bar.) */}
      {(hasMultipleViews || !!onAddPage) &&
        (stripHidden ? (
          <button className="cv-strip-bar" type="button" onClick={toggleStrip} aria-expanded={false} title="Show pages">
            <span>Pages</span>
            <IcoChevron width="14" height="14" style={{ transform: 'rotate(180deg)' }} />
          </button>
        ) : (
          <div className="ds-techpack">
            <div className="ds-techpack__tabs">
              <span className="ds-tp-title">Pages</span>
              <button
                className="cv-strip-hide"
                type="button"
                onClick={toggleStrip}
                aria-expanded
                aria-label="Hide pages"
                title="Hide panel — more room for the canvas"
              >
                <IcoChevron width="14" height="14" />
              </button>
            </div>

            <div className="ds-flats">
              {/* Garment views = the first pages (Page 1, Page 2 …) */}
              {viewTabs.map((v, i) => {
                const onBase = !pages || pages.length === 0 || !activePageId || activePageId === pages[0].id
                return (
                  <button
                    className={`ds-flat${onBase && activeView === v && !showLabel ? ' is-active' : ''}`}
                    type="button"
                    key={v}
                    title={`Page ${i + 1} · ${v}`}
                    onClick={() => { if (pages && pages[0]) onSwitchPage?.(pages[0].id); setActiveView(v); setShowLabel(false) }}
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
                    <span>Page {i + 1}</span>
                  </button>
                )
              })}
              {/* Extra pages = blank design boards */}
              {(pages ?? []).slice(1).map((p, j) => (
                <button
                  className={`ds-flat${activePageId === p.id && !showLabel ? ' is-active' : ''}`}
                  type="button"
                  key={p.id}
                  title={`Page ${viewTabs.length + j + 1}`}
                  onClick={() => { onSwitchPage?.(p.id); setShowLabel(false) }}
                >
                  <div className="ds-flat__art">
                    <Glyph width="52" height="52" />
                    {onDeletePage && (
                      <span
                        className="ds-flat__edit"
                        role="button"
                        tabIndex={0}
                        title="Delete page"
                        onClick={(e) => { e.stopPropagation(); onDeletePage(p.id) }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onDeletePage(p.id) } }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                      </span>
                    )}
                  </div>
                  <span>Page {viewTabs.length + j + 1}</span>
                </button>
              ))}
              {/* Add a new blank page */}
              {onAddPage && (
                <button className="ds-flat ds-flat--label" type="button" title="Add a blank page" onClick={onAddPage}>
                  <div className="ds-flat__art"><span className="ds-flat__add" aria-hidden="true">+</span></div>
                  <span>New Page</span>
                </button>
              )}
              {/* Neck Label — always the last page */}
              {onNeckLabel && (
                <button
                  className={`ds-flat ds-flat--label${neckLabel ? ' has-label' : ''}${showLabel ? ' is-active' : ''}`}
                  type="button"
                  title={neckLabel ? 'View the neck label' : 'Create a neck label with AI'}
                  onClick={() => (neckLabel ? setShowLabel(true) : onNeckLabel())}
                >
                  <div className="ds-flat__art">
                    {neckLabel ? (
                      <img className="ds-flat__img" src={neckLabel} alt="Neck label" draggable={false} />
                    ) : (
                      <span className="ds-flat__add" aria-hidden="true">+</span>
                    )}
                    {neckLabel && (
                      <span
                        className="ds-flat__edit"
                        role="button"
                        tabIndex={0}
                        title="Regenerate the neck label"
                        onClick={(e) => { e.stopPropagation(); onNeckLabel() }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onNeckLabel() } }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                      </span>
                    )}
                  </div>
                  <span>Neck Label</span>
                </button>
              )}
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
    // vector primitives
    rect: <rect x="4" y="6" width="16" height="12" rx="1.6" />,
    ellipse: <ellipse cx="12" cy="12" rx="8.5" ry="6.5" />,
    // pen nib
    pen: <><path d="M5 19l1.7-5.4 7.6-7.6a1.8 1.8 0 0 1 2.6 0l1.5 1.5a1.8 1.8 0 0 1 0 2.6l-7.6 7.6L5 19Z" /><path d="M13.2 7.8l3 3" /><path d="M5 19l3.2-3.2" /></>,
    // add text
    text: <path d="M5 7V5h14v2M12 5v14M9 19h6" />,
    // image
    image: <><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><circle cx="9" cy="10" r="1.8" /><path d="M4 17l5-4 4 3 3-2 4 3" /></>,
    // paintbrush
    brush: <><path d="M15.5 4.5l4 4-8 8-4-4 8-8Z" /><path d="M7.5 12.5 4 20l7.5-3.5" /></>,
    // garment builder (add component)
    build: <><rect x="4" y="4" width="16" height="16" rx="2.4" /><path d="M12 8.5v7M8.5 12h7" /></>,
  }
  return <svg {...base}>{glyphs[tool] ?? glyphs.move}</svg>
}
