import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  IcoDesign,
  IcoSearch,
  IcoDots,
  IcoUpload,
  IcoArrowRight,
  IcoBell,
  IcoHelp,
  IcoSun,
  IcoMoon,
  IcoSparkle,
} from '../../components/ui/Icons'
import { GARMENT_GLYPHS, type GarmentKind } from '../../components/ui/Garments'
import loomLogo from '../../../assets/loom-logo.png'
import { useGarments } from '../../garments/useGarments'
import { loadGarmentDisplay, getGarment } from '../../garments/garmentClient'
import { isBuiltinGarmentId, builtinTemplateId } from '../../garments/builtinGarments'
import { buildFromTemplate } from '../../garment-model/garmentFactory'
import { createGarment, getGarment as getEditableSummary } from '../../garment-model/garmentLibrary'
import { categoryLabel, EMPTY_VIEWS, type Garment as LibGarment, type GarmentCategoryId, type GarmentRepresentation, type GarmentViews } from '../../garments/types'
import { useToast } from '../../components/ui/Toast'
import { useSuiteTheme } from '../../theme'
import { useStore } from '../../data/store'
import { useAuth } from '../../auth/auth'
import { uid } from '../../data/utils'
import { saveDesignThumb } from '../../data/designThumbs'
import { putGarmentImage, getGarmentImage, delGarmentImage } from './garmentImageStore'
import { captureDesignThumbnail } from '../../export/real/capture'
import type { RealExportProject } from '../../export/real/exportProject'
import { computeReadiness } from '../../export/readiness'
import { BrandKitPanel } from '../../drive/ui/BrandKitPanel'
import { AssetLibrary, ASSET_DRAG_TYPE } from '../../assets/ui/AssetLibrary'
import { getAsset, touchAsset } from '../../assets/assetStore'
import { blobToDataUrl } from '../../assets/assetThumb'
import { loadBrandKit, recordChoice, saveBrandKit, type BrandKit } from '../../drive/brandKit'
import { StudioCanvas } from './StudioCanvas'
import { CommandBar, type StudioMode } from './CommandBar'
import { LayersPanel, type Layer, type GarmentRegionLayer } from './LayersPanel'
import { ContextPanel, defaultFieldsFor, type ContextField } from './ContextPanel'
import { ObjectInspector } from './ObjectInspector'
import {
  makeGraphicLayer,
  makeImageLayer,
  makeShapeLayer,
  makeTextLayer,
  patchObject,
  type CanvasObject,
  type ShapeGeom,
  type ShapeKind,
} from './objectModel'
import { type PropField } from './GarmentInspector'
import { GarmentInfoPanel } from './GarmentInfoPanel'
import { RegionInspector } from '../GarmentLab/RegionInspector'
import { ContextMenu, type MenuItem } from './ContextMenu'
import { CommandPalette, type Command } from './CommandPalette'
import { NewDesignWizard, type WizardResult } from './NewDesignWizard'
import { SessionStartDialog } from './SessionStartDialog'
import { ThreadosAIModal, type AiMode } from './ThreadosAIModal'
import { conceptName, type Concept } from '../../ai/conceptEngine'
import { CreativeDirector } from './CreativeDirector'
import { buildDirector, type DirectorSuggestion } from './directorModel'
import { CampaignModal } from './CampaignModal'
import { ConnectAppDialog } from './ConnectAppDialog'
import { SaveDesignDialog, type SaveChoice } from './SaveDesignDialog'
import { loadDoc, saveDoc, loadLastGarment, saveLastGarment, type ProductSpecs, type ProjectInfo, type DesignVersionDoc } from './designDoc'
import { NeckLabelModal } from './NeckLabelModal'
// M9 bridge: open the Design Studio scoped to a garment coming from the Garments workspace.
import { loadHistory } from '../../garment-model/garmentDocumentStore'
import { currentGarment } from '../../garment-model/garmentRevision'
import { garmentThumbnailSvg } from '../../garment-model/garmentThumbnail'
import { flattenRegions } from '../../garment-model/regionTree'
import { translateD } from '../../garment-model/pathTransform'
import { COLOR_SWATCHES } from '../../garment-model/garmentColors'
import type { EditableGarment } from '../../garment-model/editableGarment'
import { ProductSpecsEditor } from './ProductSpecsEditor'
import { GraphicsPanel } from './GraphicsPanel'
import { ElementsPanel } from './ElementsPanel'
import { GarmentSwitchDialog } from './GarmentSwitchDialog'
import { InspirationPanel } from './InspirationPanel'
import {
  INITIAL_CONFIG,
  deriveReadiness,
  objectNote,
  type ObjectNote,
  type StudioAction,
  type StudioConfig,
  type StudioContext,
} from './studioModel'
import './design-studio.css'

// The export system pulls in jsPDF + JSZip; load it as its own chunk on demand
// so the manufacturing-export weight never lands in the initial bundle.
const ExportMenu = lazy(() => import('../../export/ui/ExportMenu').then((m) => ({ default: m.ExportMenu })))

/** The Library — six human categories, every one opens a real panel. */
const RAIL = ['AI', 'Layers', 'Graphics', 'Elements', 'Brand Kit', 'Assets', 'Inspiration']

type Cat = 'All' | 'Tops' | 'Bottoms' | 'Outerwear' | 'Accessories'
const CATS: Cat[] = ['All', 'Tops', 'Bottoms', 'Outerwear', 'Accessories']

/** A studio garment blank — the base the creator designs on. Sourced from the Garment Library. */
type Garment = {
  id?: string
  name: string
  kind: GarmentKind
  cat: Cat
  fit: string
  category?: GarmentCategoryId
  thumbUrl?: string
  /** Brand/vendor from the imported garment (real field). */
  brand?: string
  /** The real views this blank has — drives the canvas view tabs + 3D toggle. No fakes. */
  views: GarmentViews
}

// Project a library category onto the canvas kind (photo/glyph fallback) + the meta filter chip.
const CATEGORY_KIND: Record<GarmentCategoryId, GarmentKind> = {
  hoodie: 'hoodie', sweatshirt: 'hoodie', knitwear: 'hoodie',
  tee: 'tee', dress: 'tee', other: 'tee',
  jacket: 'jacket', bomber: 'jacket', blazer: 'jacket',
  pants: 'pants', shorts: 'pants', skirt: 'pants',
  cap: 'cap', accessory: 'cap',
}
const CATEGORY_CAT: Record<GarmentCategoryId, Cat> = {
  hoodie: 'Tops', tee: 'Tops', sweatshirt: 'Tops', knitwear: 'Tops', dress: 'Tops', other: 'Tops',
  pants: 'Bottoms', shorts: 'Bottoms', skirt: 'Bottoms',
  jacket: 'Outerwear', bomber: 'Outerwear', blazer: 'Outerwear',
  cap: 'Accessories', accessory: 'Accessories',
}

/** Project a Garment Library garment onto the studio's blank model. */
function libToStudio(g: LibGarment): Garment {
  return {
    id: g.id,
    name: g.name,
    kind: CATEGORY_KIND[g.category] ?? 'tee',
    cat: CATEGORY_CAT[g.category] ?? 'Tops',
    fit: '',
    category: g.category,
    thumbUrl: g.thumbUrl,
    brand: g.vendor || undefined,
    views: g.views ?? EMPTY_VIEWS,
  }
}

// Layer model lives with the panel (Figma-grade: lock, color labels, groups).

/** A single undoable snapshot of the editable canvas state. */
type Snapshot = {
  layers: Layer[]
  hidden: Record<string, boolean>
  /** AI garment backdrop applied to THIS page (data URL). Per-page: applying a garment while on
   *  Page 2 sets it on Page 2, not Page 1. Persisted per-version in IndexedDB (see garmentEditKey). */
  garmentEdit?: string
  /** Garment-region overrides (hide a sleeve, recolour the body, rename/lock/move a part) —
   *  undoable + saved with the design. Every map is sparse: an override equal to the base is dropped. */
  regionHidden?: Record<string, boolean>
  regionFills?: Record<string, string>
  regionNames?: Record<string, string>
  regionLocked?: Record<string, boolean>
  /** Spatial move of a region, in the garment's SVG viewBox units. */
  regionTransforms?: Record<string, { dx: number; dy: number }>
}

/** An editable version/board of the design — its own snapshot under the same garment. */
type DesignVersion = { id: string; name: string; snapshot: Snapshot }

/** Deep-copy a snapshot so a duplicated version never shares mutable arrays/objects with its source. */
// A freshly selected imported garment starts with ZERO design layers — no demo VISIONARY
// text, no fake prints or materials. Real layers appear only when the user adds them.
const INITIAL_SNAPSHOT: Snapshot = { layers: [], hidden: {} }

/** Where a placement command puts a graphic (canvas coords are 0–1 fractions). */
const PLACEMENT_SPOTS: Record<string, { x: number; y: number }> = {
  'left chest': { x: 0.63, y: 0.3 }, // wearer's left = viewer's right
  'right chest': { x: 0.37, y: 0.3 },
  'center chest': { x: 0.5, y: 0.34 },
  'centre chest': { x: 0.5, y: 0.34 },
  'full front': { x: 0.5, y: 0.46 },
  'back center': { x: 0.5, y: 0.4 },
  'center back': { x: 0.5, y: 0.4 },
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const freshId = () => `l-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

/** Expand a set of selected ids to include the members of any selected group. */
function expandSelection(ids: string[], all: Layer[]): Set<string> {
  const set = new Set(ids)
  all.forEach((l) => {
    if (l.groupId && set.has(l.groupId)) set.add(l.id)
  })
  return set
}

/** Clone layers with new ids, remapped group membership, and an optional positional offset. */
function cloneLayers(src: Layer[], offset: number): Layer[] {
  const idMap = new Map<string, string>()
  src.forEach((l) => idMap.set(l.id, freshId()))
  return src.map((l) => ({
    ...l,
    id: idMap.get(l.id) as string,
    locked: false,
    groupId: l.groupId && idMap.has(l.groupId) ? idMap.get(l.groupId) : undefined,
    obj: l.obj ? { ...l.obj, x: clamp01(l.obj.x + offset), y: clamp01(l.obj.y + offset) } : undefined,
  }))
}

/** Editable property fields, keyed by a stable id so edits target the right row. */
const INITIAL_FIELDS: Record<string, PropField[]> = {
  details: [
    { id: 'd-size', label: 'Size', value: 'M' },
    { id: 'd-fit', label: 'Fit', value: 'Oversized' },
    { id: 'd-length', label: 'Length', value: 'Regular' },
    { id: 'd-fabric', label: 'Fabric', value: 'French Terry 450 GSM' },
    { id: 'd-weight', label: 'Weight', value: '450 GSM' },
    { id: 'd-color', label: 'Color', value: '#2A2A2A', swatch: true },
  ],
  detailsAdvanced: [
    { id: 'da-composition', label: 'Composition', value: '80% Cotton / 20% Poly' },
    { id: 'da-knit', label: 'Knit / Construction', value: 'Loopback French Terry' },
    { id: 'da-shrinkage', label: 'Shrinkage', value: '≤ 5%' },
    { id: 'da-tolerance', label: 'Tolerance', value: '± 1.0 cm' },
    { id: 'da-supplier', label: 'Supplier', value: 'Atelier Norte' },
    { id: 'da-moq', label: 'MOQ', value: '50 units' },
  ],
  design: [
    { id: 'de-technique', label: 'Technique', value: 'Puff Print' },
    { id: 'de-placement', label: 'Placement', value: 'Front Center' },
    { id: 'de-size', label: 'Size', value: '28 cm' },
    { id: 'de-color', label: 'Color', value: '#F2F2F2', swatch: true },
  ],
  materials: [
    { id: 'm-body', label: 'Body', value: 'French Terry 450 GSM' },
    { id: 'm-ribbing', label: 'Ribbing', value: '2x2 Rib · Cotton' },
    { id: 'm-lining', label: 'Lining', value: 'None' },
    { id: 'm-thread', label: 'Thread', value: 'Tex 40 · Matte' },
  ],
  colors: [
    { id: 'c-base', label: 'Base', value: '#2A2A2A', swatch: true },
    { id: 'c-print', label: 'Print', value: '#F2F2F2', swatch: true },
    { id: 'c-rib', label: 'Rib', value: '#1E1E1E', swatch: true },
    { id: 'c-stitch', label: 'Stitch', value: '#D1F94F', swatch: true },
  ],
}


export function DesignStudio() {
  const navigate = useNavigate()
  const toast = useToast()
  const { theme, toggle: toggleTheme } = useSuiteTheme()
  const { user } = useAuth()
  const { data, mutate } = useStore()
  const [rail, setRail] = useState('AI')

  // A Design belongs to a garment blank: its id is derived from the active garment
  // (see `designId` below, after the catalog resolves), so one stable design per garment.
  const [designName, setDesignName] = useState('Hoodie')
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'unsaved'>('unsaved')
  // loom studios AI — the command bar routes described-graphic prompts here (open + seed prompt + mode).
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiMode] = useState<AiMode>('graphic')
  // Neck Label — the garment's AI-generated woven care/brand tag (persists in the doc as a 3rd view).
  const [neckLabelOpen, setNeckLabelOpen] = useState(false)
  const [neckLabel, setNeckLabel] = useState<string | null>(null)
  const neckLabelRef = useRef<string | null>(null)
  // Creative Director — proactive, real suggestions after a graphic lands.
  const [director, setDirector] = useState<{ objectId: string; suggestions: DirectorSuggestion[] } | null>(null)
  // Campaign Generator — the finished garment → on-model campaign photography.
  const [campaignOpen, setCampaignOpen] = useState(false)

  // Save dialog: name + which collection the design belongs to (created inline if needed).
  const [saveOpen, setSaveOpen] = useState(false)
  const [collectionId, setCollectionId] = useState<string | undefined>(undefined)
  // User-provided product specs (material/fit/weight/…). Empty by default; never inferred.
  const [specs, setSpecs] = useState<ProductSpecs>({})
  // Manufacturing project info (brand/designer/collection/…) entered in the Export wizard.
  const [projectInfo, setProjectInfo] = useState<ProjectInfo>({})

  // Topbar utilities (mirrors the suite topbar)
  const [notifOpen, setNotifOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const unread = useMemo(() => data.notifications.filter((n) => !n.read).length, [data.notifications])

  // New-design wizard: guide the first steps instead of an empty editor. It is opened by the
  // session gate (or straight away when there is nothing to continue) — see the entry effect below.
  const [wizardOpen, setWizardOpen] = useState<boolean>(false)

  // Session gate: on a fresh entry (not opened from a specific garment) we ask "continue or new?"
  // instead of silently reopening the last design.
  const [sessionGateOpen, setSessionGateOpen] = useState(false)
  // Pending garment switch awaiting the user's choice (open new vs. carry the design over).
  const [garmentSwitchTarget, setGarmentSwitchTarget] = useState<Garment | null>(null)
  const [lastDesignName, setLastDesignName] = useState('')

  // Workspace layout: collapsible inspector (persisted). Layers live in their own Library tab now.
  const [rightHidden, setRightHidden] = useState<boolean>(() => {
    try {
      // right inspector is closed by default (canvas-first); an explicit choice persists.
      // Fresh key so older sessions' stored preference doesn't override the new default.
      const raw = localStorage.getItem('threados-inspector-hidden')
      return raw === null ? true : raw === '1'
    } catch {
      return true
    }
  })
  const [leftHidden, setLeftHidden] = useState<boolean>(() => {
    try {
      return localStorage.getItem('threados-left-hidden') === '1'
    } catch {
      return false
    }
  })
  // Library rail is horizontally resizable — persisted width overrides the --library-w default.
  const [libraryW, setLibraryW] = useState<number | null>(() => {
    try {
      const raw = localStorage.getItem('threados-library-w')
      return raw ? Math.max(200, parseInt(raw, 10) || 0) : null
    } catch {
      return null
    }
  })
  const toggleRight = useCallback(() => {
    setRightHidden((v) => {
      try {
        localStorage.setItem('threados-inspector-hidden', v ? '0' : '1')
      } catch {
        /* ignore */
      }
      return !v
    })
  }, [])

  const toggleLeft = useCallback(() => {
    setLeftHidden((v) => {
      try {
        localStorage.setItem('threados-left-hidden', v ? '0' : '1')
      } catch {
        /* ignore */
      }
      return !v
    })
  }, [])

  /** Drag the library's right edge to resize its width (tracks the cursor exactly). */
  const startLibraryResize = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const lib = (e.currentTarget.closest('.ds-body') as HTMLElement | null)?.querySelector('.ds-left')
    if (!lib) return
    const leftX = lib.getBoundingClientRect().left
    const compute = (clientX: number) => Math.min(560, Math.max(200, Math.round(clientX - leftX)))
    let last = compute(e.clientX)
    const onMove = (ev: PointerEvent) => {
      last = compute(ev.clientX)
      setLibraryW(last)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      try {
        localStorage.setItem('threados-library-w', String(last))
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [])
  const [cat, setCat] = useState<Cat>('All')
  const [query, setQuery] = useState('')
  const [activeName, setActiveName] = useState('Hoodie')

  // Undo/redo history: `past` and `future` are real snapshot stacks, `present` is live.
  const [past, setPast] = useState<Snapshot[]>([])
  const [present, setPresent] = useState<Snapshot>(INITIAL_SNAPSHOT)
  const [future, setFuture] = useState<Snapshot[]>([])

  // The AI garment backdrop belongs to the ACTIVE page (present mirrors the active version), so
  // applying a garment lands on whatever page you're on — not always Page 1.
  const garmentEditUrl = present.garmentEdit ?? null

  // Versions/boards: `present` always mirrors the ACTIVE version's live state, so every existing
  // edit/undo/save path works unchanged. Switching a version swaps `present` (and resets undo).
  // Seed a stable base "Page 1" so the Pages strip is never empty — even for the placeholder
  // garment that has no saved doc (the load effect below overrides this once a real garment opens).
  const baseVersionRef = useRef<DesignVersion | null>(null)
  if (!baseVersionRef.current) {
    baseVersionRef.current = { id: uid('ver'), name: 'Page 1', snapshot: INITIAL_SNAPSHOT }
  }
  const [versions, setVersions] = useState<DesignVersion[]>([baseVersionRef.current])
  const [activeVersionId, setActiveVersionId] = useState(baseVersionRef.current.id)
  const versionsRef = useRef<DesignVersion[]>([baseVersionRef.current])
  const activeVersionIdRef = useRef(baseVersionRef.current.id)
  const lastQuotaWarnRef = useRef(0)
  useEffect(() => {
    versionsRef.current = versions
  }, [versions])
  useEffect(() => {
    activeVersionIdRef.current = activeVersionId
  }, [activeVersionId])

  // Editable property fields — clicking a field really changes its displayed value.
  const [fields, setFields] = useState<Record<string, PropField[]>>(INITIAL_FIELDS)
  const [showCatalogHint, setShowCatalogHint] = useState(false)

  // Beginner vs Pro presentation, and the manufacturing config that drives readiness.
  // Pro is the default and only mode now — every production field is always expanded.
  const mode: StudioMode = 'pro'
  const [connectOpen, setConnectOpen] = useState(false)
  const [config, setConfig] = useState<StudioConfig>(INITIAL_CONFIG)

  // Brand Memory: load the kit once, record real choices, flush debounced.
  const kitRef = useRef<BrandKit | null>(null)
  const flushTimer = useRef<number | null>(null)

  useEffect(() => {
    let on = true
    void loadBrandKit().then((k) => {
      if (on) kitRef.current = k
    })
    return () => {
      on = false
      if (flushTimer.current) window.clearTimeout(flushTimer.current)
    }
  }, [])

  /** Remember a real design choice (fit, weight, fabric…) — Brand Memory. */
  const rememberChoice = useCallback((dimension: string, value: string) => {
    const cur = kitRef.current
    if (!cur || !cur.memoryEnabled) return
    kitRef.current = recordChoice(cur, dimension, value)
    if (flushTimer.current) window.clearTimeout(flushTimer.current)
    flushTimer.current = window.setTimeout(() => {
      if (kitRef.current) void saveBrandKit(kitRef.current)
    }, 1500)
  }, [])

  /** Which memory dimension a property field feeds (if any). */
  const MEMORY_DIMS: Record<string, string> = useMemo(
    () => ({ 'd-fit': 'fit', 'd-weight': 'weight', 'd-fabric': 'fabric', 'd-color': 'color', 'de-technique': 'technique' }),
    [],
  )

  const { layers, hidden } = present
  const canUndo = past.length > 0
  const canRedo = future.length > 0

  // Which garment the live canvas belongs to, and always-fresh name/collection mirrors —
  // so document saves are keyed correctly and never read stale closure values.
  const loadedGarmentRef = useRef<string | null>(null)
  // The design DOCUMENT key. Normally === the garment id, but opening a garment "fresh" (from the
  // Garments Studio) uses a brand-new key so it starts blank and never overwrites the garment's
  // existing designs. The garment STRUCTURE still loads from the garment id.
  const docKeyRef = useRef<string | null>(null)
  const freshConsumedRef = useRef(false)
  const designNameRef = useRef('Hoodie')
  const collectionIdRef = useRef<string | undefined>(undefined)
  const specsRef = useRef<ProductSpecs>({})
  const projectInfoRef = useRef<ProjectInfo>({})

  /**
   * Persist the given canvas snapshot to the current garment's document. Called ONLY from
   * real edit sinks (commit / undo / redo / drag-end / rename / save / spec edit) — never from
   * a load — so loading a garment can never echo an empty canvas back over a saved design.
   */
  const saveCurrentDoc = useCallback((snap: Snapshot, name?: string, col?: string) => {
    // Save under the DESIGN doc key (a fresh-opened design has its own key, separate from the
    // garment's other designs), falling back to the garment id for normally-opened designs.
    const gid = docKeyRef.current ?? loadedGarmentRef.current
    if (!gid) return
    // Persist every version, with the ACTIVE one reflecting the snapshot being saved.
    // The AI garment backdrop lives PER PAGE. Its multi-MB base64 image is offloaded to IndexedDB
    // (inlining it in the localStorage doc blew the ~5MB quota); the version doc keeps only a
    // lightweight key `${gid}:${versionId}`.
    const gKey = (vid: string) => `${gid}:${vid}`
    const snapToVersionDoc = (v: DesignVersion, s: Snapshot): DesignVersionDoc => ({
      id: v.id,
      name: v.name,
      layers: s.layers,
      hidden: s.hidden,
      garmentEditKey: s.garmentEdit ? gKey(v.id) : undefined,
      regionHidden: s.regionHidden,
      regionFills: s.regionFills,
      regionNames: s.regionNames,
      regionLocked: s.regionLocked,
      regionTransforms: s.regionTransforms,
    })
    const hasVersions = versionsRef.current.length > 0
    const versionDocs = hasVersions
      ? versionsRef.current.map((v) => snapToVersionDoc(v, v.id === activeVersionIdRef.current ? snap : v.snapshot))
      : undefined
    // Only the active page's snapshot changed this save — persist just its image (others were
    // written while they were active).
    const activeVid = activeVersionIdRef.current
    if (activeVid) {
      if (snap.garmentEdit) void putGarmentImage(gKey(activeVid), snap.garmentEdit)
      else void delGarmentImage(gKey(activeVid))
    }
    // When versions exist they are the source of truth; keep the top-level layers/hidden EMPTY (not a
    // duplicate of the active version) so image payloads aren't stored twice — halving quota pressure.
    const ok = saveDoc(gid, {
      layers: hasVersions ? [] : snap.layers,
      hidden: hasVersions ? {} : snap.hidden,
      regionHidden: hasVersions ? undefined : snap.regionHidden,
      regionFills: hasVersions ? undefined : snap.regionFills,
      regionNames: hasVersions ? undefined : snap.regionNames,
      regionLocked: hasVersions ? undefined : snap.regionLocked,
      regionTransforms: hasVersions ? undefined : snap.regionTransforms,
      designName: name ?? designNameRef.current,
      collectionId: col ?? collectionIdRef.current,
      specs: specsRef.current,
      projectInfo: projectInfoRef.current,
      // The garment backdrop is now per-page (see each version's garmentEditKey), not top-level.
      garmentEdit: undefined,
      garmentEditKey: undefined,
      neckLabel: neckLabelRef.current ?? undefined,
      versions: versionDocs,
      activeVersionId: activeVersionIdRef.current || undefined,
      updatedAt: Date.now(),
    })
    // A silent drop would lose work while the UI still says "Saved" — surface it honestly instead.
    if (!ok) {
      setSaveState('unsaved')
      const now = Date.now()
      if (now - lastQuotaWarnRef.current > 15_000) {
        lastQuotaWarnRef.current = now
        toast('Storage is full — recent changes may not be saved. Export your work, or remove heavy images/versions.', 'info')
      }
    }
  }, [toast])

  // Apply a generated neck label to the garment — persists in the doc, marks the design dirty.
  const applyNeckLabel = useCallback((dataUrl: string) => {
    setNeckLabel(dataUrl)
    neckLabelRef.current = dataUrl
    saveCurrentDoc(presentRef.current)
    setSaveState('unsaved')
    toast('Neck label added to the garment.', 'success')
  }, [saveCurrentDoc, toast])

  /**
   * Patch the user product specs and persist immediately (design is never blocked by specs).
   * Builds the next specs from specsRef (kept in lockstep with the loaded garment) rather than
   * React state, so a spec edit right after a garment switch can never merge the previous
   * garment's stale specs into the new garment's document.
   */
  const patchSpec = useCallback(
    (patch: Partial<ProductSpecs>) => {
      const next = { ...specsRef.current, ...patch }
      specsRef.current = next
      setSpecs(next)
      saveCurrentDoc(presentRef.current)
    },
    [saveCurrentDoc],
  )

  /** Patch manufacturing project info and persist immediately (Export wizard, auto-save). */
  const patchProjectInfo = useCallback(
    (patch: Partial<ProjectInfo>) => {
      const next = { ...projectInfoRef.current, ...patch }
      projectInfoRef.current = next
      setProjectInfo(next)
      saveCurrentDoc(presentRef.current)
    },
    [saveCurrentDoc],
  )

  /**
   * Commit a new snapshot, pushing the current one onto the undo stack + persisting it.
   * Region overrides are carried over unless the caller changes them, so a layer edit
   * never silently drops a garment recolour (and vice versa).
   */
  const commit = useCallback(
    (next: Snapshot) => {
      // Read carried-over region overrides from the SAME source the insert helpers use for layers
      // (presentRef), so a commit that fires in the tick after a version switch — before the state
      // re-render — can never pair the just-loaded version's layers with the previous version's
      // region overrides.
      const base = presentRef.current
      const merged: Snapshot = {
        garmentEdit: base.garmentEdit,
        regionHidden: base.regionHidden,
        regionFills: base.regionFills,
        regionNames: base.regionNames,
        regionLocked: base.regionLocked,
        regionTransforms: base.regionTransforms,
        ...next,
      }
      setPast((prev) => [...prev, base])
      setPresent(merged)
      setFuture([])
      saveCurrentDoc(merged)
    },
    [saveCurrentDoc],
  )

  // Apply an AI garment backdrop to the CURRENT page (present mirrors the active version), so it
  // lands on the page you're viewing — never always Page 1. Undoable + saved via commit.
  const applyGarmentToPage = useCallback(
    (dataUrl: string) => {
      commit({ ...presentRef.current, garmentEdit: dataUrl })
      toast('Garment applied to this page — start designing on top.', 'success')
    },
    [commit, toast],
  )

  // ---- Versions / boards: multiple editable variations of the same garment in one file ----
  /** Fold the given snapshot into the active version's stored snapshot; returns the updated list. */
  const syncActiveVersion = useCallback((snap: Snapshot): DesignVersion[] => {
    const next = versionsRef.current.map((v) => (v.id === activeVersionIdRef.current ? { ...v, snapshot: snap } : v))
    versionsRef.current = next
    setVersions(next)
    return next
  }, [])

  /** Make `snap` the live editable state under version `id`, resetting undo for a clean session. */
  const loadVersion = useCallback((snap: Snapshot, id: string) => {
    setPast([])
    setFuture([])
    setPresent(snap)
    presentRef.current = snap
    setActiveVersionId(id)
    activeVersionIdRef.current = id
    setSelectedIds([])
  }, [])

  const switchVersion = useCallback(
    (targetId: string) => {
      if (targetId === activeVersionIdRef.current) return
      syncActiveVersion(presentRef.current)
      const target = versionsRef.current.find((v) => v.id === targetId)
      if (!target) return
      loadVersion(target.snapshot, targetId)
      saveCurrentDoc(target.snapshot)
    },
    [syncActiveVersion, loadVersion, saveCurrentDoc],
  )

  // Add a new BLANK page (an empty design board on the same garment). Pages replaced "versions".
  const addVersion = useCallback(() => {
    const synced = syncActiveVersion(presentRef.current)
    const newId = uid('ver')
    const name = `Page ${synced.length + 1}`
    const blank: Snapshot = { layers: [], hidden: {} }
    const next = [...synced, { id: newId, name, snapshot: blank }]
    versionsRef.current = next
    setVersions(next)
    loadVersion(blank, newId)
    saveCurrentDoc(blank)
    toast('Blank page added.', 'success')
  }, [syncActiveVersion, loadVersion, saveCurrentDoc, toast])

  const deleteVersion = useCallback(
    (id: string) => {
      if (versionsRef.current.length <= 1) {
        toast('A design needs at least one version.', 'info')
        return
      }
      const remaining = versionsRef.current.filter((v) => v.id !== id)
      versionsRef.current = remaining
      setVersions(remaining)
      // Drop this page's garment image from IndexedDB so deleted pages don't leak storage.
      const gid = loadedGarmentRef.current
      if (gid) void delGarmentImage(`${gid}:${id}`)
      if (id === activeVersionIdRef.current) {
        loadVersion(remaining[0].snapshot, remaining[0].id)
        saveCurrentDoc(remaining[0].snapshot)
      } else {
        saveCurrentDoc(presentRef.current)
      }
      toast('Version deleted.', 'success')
    },
    [loadVersion, saveCurrentDoc, toast],
  )

  // Live mirror so object drags read the freshest state without stale closures.
  const presentRef = useRef(present)
  useEffect(() => {
    presentRef.current = present
  }, [present])
  useEffect(() => {
    designNameRef.current = designName
  }, [designName])
  useEffect(() => {
    collectionIdRef.current = collectionId
  }, [collectionId])
  useEffect(() => {
    specsRef.current = specs
  }, [specs])
  useEffect(() => {
    projectInfoRef.current = projectInfo
  }, [projectInfo])

  // ---- Editable canvas objects (text / image / graphic) ----
  const objectLayers = useMemo(() => present.layers.filter((l) => l.obj), [present.layers])

  const addTextObject = useCallback(() => {
    const l = makeTextLayer()
    commit({ layers: [l, ...presentRef.current.layers], hidden: presentRef.current.hidden })
    setSelectedIds([l.id])
    toast('Text added — double-click on the garment to edit it.', 'success')
  }, [commit, toast])

  const addGraphicObject = useCallback(
    (glyph: string) => {
      const l = makeGraphicLayer(glyph)
      commit({ layers: [l, ...presentRef.current.layers], hidden: presentRef.current.hidden })
      setSelectedIds([l.id])
      toast(`${glyph} added.`, 'success')
    },
    [commit, toast],
  )

  // Drawing tools (Rectangle / Ellipse): the canvas hands back the drawn geometry; we mint a real
  // vector object that lands on its own layer — so undo, selection, save, export and the inspector
  // all work for it exactly like text or images, with no special-casing.
  const addShapeObject = useCallback(
    (shape: ShapeKind, geom: ShapeGeom) => {
      const l = makeShapeLayer(shape, geom)
      commit({ layers: [l, ...presentRef.current.layers], hidden: presentRef.current.hidden })
      setSelectedIds([l.id])
      toast(`${shape === 'rect' ? 'Rectangle' : 'Ellipse'} added — set its fill, stroke and corners in the inspector.`, 'success')
    },
    [commit, toast],
  )

  // loom studios AI → canvas: a generated concept becomes a normal image object (its SVG data URL as
  // the source), centred and selected. Mirrors placeAsset, so it inherits layers/undo/save/inspector.
  const addGeneratedConcept = useCallback(
    (concept: Concept) => {
      const base = makeImageLayer(conceptName(concept.prompt), concept.dataUrl)
      const layer: Layer = { ...base, name: conceptName(concept.prompt), obj: { ...base.obj!, x: 0.5, y: 0.5, width: 0.42 } }
      commit({ layers: [layer, ...presentRef.current.layers], hidden: presentRef.current.hidden })
      setSelectedIds([layer.id])
      toast(`“${layer.name}” added to your design.`, 'success')
      // The Creative Director keeps designing with the user, from the real placed object.
      const suggestions = buildDirector(layer.obj!, { prompt: concept.prompt, objectType: 'image' })
      setDirector(suggestions.length ? { objectId: layer.id, suggestions } : null)
    },
    [commit, toast],
  )

  /** Apply a Creative Director suggestion — every action is real and undoable. */
  function applyDirector(s: DirectorSuggestion) {
    if (!director) return
    const a = s.action
    if (a.kind === 'generate') {
      setAiPrompt(a.prompt)
      setRail('AI')
      setDirector(null)
      return
    }
    // Guard every mutating branch: if the target object is gone (deleted / garment switched), drop
    // the card instead of committing a no-op that would push a phantom undo entry + re-save the doc.
    const cur = presentRef.current.layers.find((l) => l.id === director.objectId)?.obj
    if (!cur) {
      setDirector(null)
      return
    }
    if (a.kind === 'scale') setObjectProp(director.objectId, { width: Math.max(0.06, Math.min(1.4, cur.width * a.factor)) })
    else if (a.kind === 'center') setObjectProp(director.objectId, { x: 0.5, y: 0.45 })
    else if (a.kind === 'blend') setObjectProp(director.objectId, { blendMode: a.blendMode })
    const rest = director.suggestions.filter((x) => x.id !== s.id)
    setDirector(rest.length ? { ...director, suggestions: rest } : null)
  }

  // Drop the Creative Director card whenever its target object no longer exists (delete / undo / redo).
  useEffect(() => {
    if (director && !present.layers.some((l) => l.id === director.objectId)) setDirector(null)
  }, [present.layers, director])

  function dismissDirectorSuggestion(id: string) {
    if (!director) return
    const rest = director.suggestions.filter((x) => x.id !== id)
    setDirector(rest.length ? { ...director, suggestions: rest } : null)
  }

  const addImageObject = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/')) {
        toast('Please choose an image file.', 'info')
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        const l = makeImageLayer(file.name, String(reader.result))
        commit({ layers: [l, ...presentRef.current.layers], hidden: presentRef.current.hidden })
        setSelectedIds([l.id])
        toast('Image added to your design.', 'success')
      }
      reader.onerror = () => toast('Could not read that file.', 'info')
      reader.readAsDataURL(file)
    },
    [commit, toast],
  )

  // Drag: push one history entry on the first move, then update live (no spam).
  const dragStartedRef = useRef(false)
  const liveObject = useCallback((id: string, patch: Partial<CanvasObject>) => {
    const base = presentRef.current
    const next: Snapshot = { ...base, layers: patchObject(base.layers, id, patch) }
    if (!dragStartedRef.current) {
      setPast((prev) => [...prev, base])
      setFuture([])
      dragStartedRef.current = true
    }
    presentRef.current = next
    setPresent(next)
  }, [])
  const commitObject = useCallback(() => {
    // A drag/resize/rotate ended — presentRef holds the final state; persist it.
    if (dragStartedRef.current) saveCurrentDoc(presentRef.current)
    dragStartedRef.current = false
  }, [saveCurrentDoc])

  const editObjectText = useCallback(
    (id: string, text: string) => {
      const base = presentRef.current
      commit({
        layers: base.layers.map((l) =>
          l.id === id && l.obj ? { ...l, obj: { ...l.obj, text }, name: text.slice(0, 22) || 'Text' } : l,
        ),
        hidden: base.hidden,
      })
    },
    [commit],
  )

  /** Patch a selected object's property from the inspector (committed). */
  const setObjectProp = useCallback(
    (id: string, patch: Partial<CanvasObject>) => {
      const base = presentRef.current
      commit({ layers: patchObject(base.layers, id, patch), hidden: base.hidden })
    },
    [commit],
  )

  /** Replace an image object's source, keeping its position/size/rotation intact. */
  const replaceImage = useCallback(
    (id: string) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/png,image/svg+xml,image/webp,image/jpeg'
      input.onchange = () => {
        const f = input.files?.[0]
        if (!f || !f.type.startsWith('image/')) return
        const reader = new FileReader()
        reader.onload = () => {
          setObjectProp(id, { src: String(reader.result) })
          toast('Image replaced.', 'success')
        }
        reader.readAsDataURL(f)
      }
      input.click()
    },
    [setObjectProp, toast],
  )

  // ---- Object operations (all go through commit → undoable + autosaved) ----
  const clipboardRef = useRef<Layer[]>([])
  const liveSelectedRef = useRef<string[]>([])

  /** Change a layer's stacking order (front = index 0 = drawn on top). */
  const arrangeLayer = useCallback(
    (id: string, op: 'front' | 'back' | 'forward' | 'backward') => {
      const base = presentRef.current
      const arr = [...base.layers]
      const i = arr.findIndex((l) => l.id === id)
      if (i < 0) return
      const [item] = arr.splice(i, 1)
      const j = op === 'front' ? 0 : op === 'back' ? arr.length : op === 'forward' ? Math.max(0, i - 1) : Math.min(arr.length, i + 1)
      arr.splice(j, 0, item)
      commit({ layers: arr, hidden: base.hidden })
    },
    [commit],
  )

  const duplicateSelection = useCallback(() => {
    const base = presentRef.current
    const sel = expandSelection(liveSelectedRef.current, base.layers)
    if (sel.size === 0) return
    const clones = cloneLayers(base.layers.filter((l) => sel.has(l.id)), 0.03)
    commit({ layers: [...clones, ...base.layers], hidden: base.hidden })
    setSelectedIds(clones.filter((c) => !c.groupId).map((c) => c.id))
    toast(`Duplicated ${clones.filter((c) => !c.groupId).length} layer${clones.filter((c) => !c.groupId).length === 1 ? '' : 's'}.`, 'success')
  }, [commit, toast])

  const copySelection = useCallback(() => {
    const base = presentRef.current
    const sel = expandSelection(liveSelectedRef.current, base.layers)
    clipboardRef.current = base.layers.filter((l) => sel.has(l.id))
  }, [])

  const paste = useCallback(() => {
    if (clipboardRef.current.length === 0) return
    const base = presentRef.current
    const clones = cloneLayers(clipboardRef.current, 0.04)
    commit({ layers: [...clones, ...base.layers], hidden: base.hidden })
    setSelectedIds(clones.filter((c) => !c.groupId).map((c) => c.id))
    toast('Pasted.', 'success')
  }, [commit, toast])

  const selectAllObjects = useCallback(() => {
    setSelectedIds(presentRef.current.layers.filter((l) => l.obj && !l.locked).map((l) => l.id))
  }, [])

  /** Move every selected (unlocked) object by a normalized delta. */
  const nudgeSelection = useCallback(
    (dx: number, dy: number) => {
      const base = presentRef.current
      const sel = expandSelection(liveSelectedRef.current, base.layers)
      if (sel.size === 0) return
      const next = base.layers.map((l) =>
        sel.has(l.id) && l.obj && !l.locked ? { ...l, obj: { ...l.obj, x: clamp01(l.obj.x + dx), y: clamp01(l.obj.y + dy) } } : l,
      )
      commit({ layers: next, hidden: base.hidden })
    },
    [commit],
  )

  const groupSelection = useCallback(() => {
    const base = presentRef.current
    const members = liveSelectedRef.current
      .map((id) => base.layers.find((l) => l.id === id))
      .filter((l): l is Layer => !!l && l.type !== 'Group' && !l.groupId)
    if (members.length < 2) {
      toast('Select at least two layers to group.', 'info')
      return
    }
    const gid = `${freshId()}g`
    const group: Layer = { id: gid, name: `Group ${base.layers.filter((l) => l.type === 'Group').length + 1}`, type: 'Group' }
    const memberIds = new Set(members.map((m) => m.id))
    const firstIdx = base.layers.findIndex((l) => memberIds.has(l.id))
    const rest = base.layers.filter((l) => !memberIds.has(l.id))
    const updated = members.map((m) => ({ ...m, groupId: gid }))
    commit({ layers: [...rest.slice(0, firstIdx), group, ...updated, ...rest.slice(firstIdx)], hidden: base.hidden })
    setSelectedIds([gid])
    toast(`Grouped ${members.length} layers.`, 'success')
  }, [commit, toast])

  const ungroupSelection = useCallback(() => {
    const base = presentRef.current
    const gids = new Set(liveSelectedRef.current.filter((id) => base.layers.find((l) => l.id === id)?.type === 'Group'))
    if (gids.size === 0) return
    const next = base.layers
      .filter((l) => !gids.has(l.id))
      .map((l) => (l.groupId && gids.has(l.groupId) ? { ...l, groupId: undefined } : l))
    commit({ layers: next, hidden: base.hidden })
  }, [commit])

  /** Delete the current selection (skips locked layers; a group takes its unlocked members). */
  const deleteSelection = useCallback(() => {
    const base = presentRef.current
    const removable = new Set(
      liveSelectedRef.current.filter((id) => {
        const l = base.layers.find((x) => x.id === id)
        return l && !l.locked && !(l.groupId && base.layers.find((g) => g.id === l.groupId)?.locked)
      }),
    )
    base.layers.forEach((l) => {
      if (l.groupId && removable.has(l.groupId) && !l.locked) removable.add(l.id)
    })
    if (removable.size === 0) return
    const nextHidden = { ...base.hidden }
    removable.forEach((id) => delete nextHidden[id])
    commit({ layers: base.layers.filter((l) => !removable.has(l.id)), hidden: nextHidden })
    setSelectedIds([])
    toast(`Removed ${removable.size} ${removable.size === 1 ? 'layer' : 'layers'}.`)
  }, [commit, toast])

  /** Cut = copy then delete. */
  const cutSelection = useCallback(() => {
    copySelection()
    deleteSelection()
  }, [copySelection, deleteSelection])

  /** Lock/unlock the whole selection (locks if any member is unlocked). */
  const toggleLockSelection = useCallback(() => {
    const base = presentRef.current
    const sel = new Set(liveSelectedRef.current)
    if (sel.size === 0) return
    const lockAll = base.layers.some((l) => sel.has(l.id) && !l.locked)
    commit({ layers: base.layers.map((l) => (sel.has(l.id) ? { ...l, locked: lockAll } : l)), hidden: base.hidden })
  }, [commit])

  /** Show/hide the whole selection (hides if any member is visible). */
  const toggleHideSelection = useCallback(() => {
    const base = presentRef.current
    const sel = liveSelectedRef.current
    if (sel.length === 0) return
    const hideAll = sel.some((id) => !base.hidden[id])
    const nextHidden = { ...base.hidden }
    sel.forEach((id) => (hideAll ? (nextHidden[id] = true) : delete nextHidden[id]))
    commit({ layers: base.layers, hidden: nextHidden })
  }, [commit])

  /** Flip the selected objects horizontally / vertically. */
  const flipSelection = useCallback(
    (axis: 'h' | 'v') => {
      const base = presentRef.current
      const sel = expandSelection(liveSelectedRef.current, base.layers)
      const key = axis === 'h' ? 'flipH' : 'flipV'
      commit({
        layers: base.layers.map((l) => (sel.has(l.id) && l.obj ? { ...l, obj: { ...l.obj, [key]: !l.obj[key] } } : l)),
        hidden: base.hidden,
      })
    },
    [commit],
  )

  // ---- Align & distribute — operate on real rendered bounds (works without a stored height) ----
  /** Live screen rects of the selected, editable, visible objects + the print-area frame. */
  const selectionRects = useCallback(() => {
    const box = document.querySelector('.co-box')?.getBoundingClientRect()
    if (!box || box.width === 0) return null
    const base = presentRef.current
    const ids = [...expandSelection(liveSelectedRef.current, base.layers)].filter((id) => {
      const l = base.layers.find((x) => x.id === id)
      return l?.obj && !l.locked && !base.hidden[id]
    })
    const rects = ids
      .map((id) => {
        const el = document.querySelector<HTMLElement>(`.co-obj[data-id="${id}"]`)
        return el ? { id, r: el.getBoundingClientRect() } : null
      })
      .filter((x): x is { id: string; r: DOMRect } => !!x)
    return { box, rects }
  }, [])

  const alignSelection = useCallback(
    (edge: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
      const data = selectionRects()
      if (!data || data.rects.length === 0) return
      const { box, rects } = data
      // 2+ objects align to the selection's bounds; a single object aligns to the print area.
      const multi = rects.length > 1
      const b = {
        left: multi ? Math.min(...rects.map((x) => x.r.left)) : box.left,
        right: multi ? Math.max(...rects.map((x) => x.r.right)) : box.right,
        top: multi ? Math.min(...rects.map((x) => x.r.top)) : box.top,
        bottom: multi ? Math.max(...rects.map((x) => x.r.bottom)) : box.bottom,
      }
      const midX = (b.left + b.right) / 2
      const midY = (b.top + b.bottom) / 2
      const base = presentRef.current
      const patched = base.layers.map((l) => {
        const hit = rects.find((x) => x.id === l.id)
        if (!hit || !l.obj) return l
        const hw = hit.r.width / 2
        const hh = hit.r.height / 2
        let sx = hit.r.left + hw
        let sy = hit.r.top + hh
        if (edge === 'left') sx = b.left + hw
        else if (edge === 'right') sx = b.right - hw
        else if (edge === 'center') sx = midX
        else if (edge === 'top') sy = b.top + hh
        else if (edge === 'bottom') sy = b.bottom - hh
        else if (edge === 'middle') sy = midY
        return { ...l, obj: { ...l.obj, x: clamp01((sx - box.left) / box.width), y: clamp01((sy - box.top) / box.height) } }
      })
      commit({ layers: patched, hidden: base.hidden })
    },
    [commit, selectionRects],
  )

  const distributeSelection = useCallback(
    (axis: 'h' | 'v') => {
      const data = selectionRects()
      if (!data || data.rects.length < 3) {
        toast('Select 3 or more objects to distribute.', 'info')
        return
      }
      const { box } = data
      const items = data.rects
        .map((x) => ({
          id: x.id,
          start: axis === 'h' ? x.r.left : x.r.top,
          end: axis === 'h' ? x.r.right : x.r.bottom,
          size: axis === 'h' ? x.r.width : x.r.height,
        }))
        .sort((a, z) => a.start - z.start)
      const span = items[items.length - 1].end - items[0].start
      const totalSize = items.reduce((s, it) => s + it.size, 0)
      const gap = (span - totalSize) / (items.length - 1)
      let cursor = items[0].start
      const centerById: Record<string, number> = {}
      for (const it of items) {
        centerById[it.id] = cursor + it.size / 2
        cursor += it.size + gap
      }
      const base = presentRef.current
      const patched = base.layers.map((l) => {
        if (centerById[l.id] === undefined || !l.obj) return l
        const c = centerById[l.id]
        return axis === 'h'
          ? { ...l, obj: { ...l.obj, x: clamp01((c - box.left) / box.width) } }
          : { ...l, obj: { ...l.obj, y: clamp01((c - box.top) / box.height) } }
      })
      commit({ layers: patched, hidden: base.hidden })
    },
    [commit, selectionRects, toast],
  )

  // ---- Command palette (⌘K) — every action, searchable (commands built after selection state) ----
  const [paletteOpen, setPaletteOpen] = useState(false)
  const focusAiBar = useCallback(() => {
    setRail('AI')
    requestAnimationFrame(() => document.querySelector<HTMLInputElement>('.tai__input')?.focus())
  }, [])

  // ---- Right-click context menu — surfaces the same wired ops at the point of intent ----
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null)
  const renameHandleRef = useRef<((id: string) => void) | null>(null)

  /** Menu for a selected object / layer. `effSel` is the selection the actions will operate on. */
  const objectMenuItems = useCallback(
    (effSel: string[], opts?: { includeRename?: string }): MenuItem[] => {
      const someGroup = effSel.some((id) => present.layers.find((l) => l.id === id)?.type === 'Group')
      const target = effSel[0]
      const items: MenuItem[] = []
      if (opts?.includeRename) {
        items.push({ label: 'Rename', shortcut: '↵', onSelect: () => renameHandleRef.current?.(opts.includeRename as string) })
        items.push({ kind: 'separator' })
      }
      items.push(
        { label: 'Cut', shortcut: '⌘X', onSelect: cutSelection },
        { label: 'Copy', shortcut: '⌘C', onSelect: copySelection },
        { label: 'Paste', shortcut: '⌘V', onSelect: paste, disabled: clipboardRef.current.length === 0 },
        { label: 'Duplicate', shortcut: '⌘D', onSelect: duplicateSelection },
        { kind: 'separator' },
        { label: 'Bring to Front', shortcut: '⌘⇧]', onSelect: () => target && arrangeLayer(target, 'front') },
        { label: 'Bring Forward', shortcut: '⌘]', onSelect: () => target && arrangeLayer(target, 'forward') },
        { label: 'Send Backward', shortcut: '⌘[', onSelect: () => target && arrangeLayer(target, 'backward') },
        { label: 'Send to Back', shortcut: '⌘⇧[', onSelect: () => target && arrangeLayer(target, 'back') },
        { kind: 'separator' },
        someGroup
          ? { label: 'Ungroup', shortcut: '⌘⇧G', onSelect: ungroupSelection }
          : { label: 'Group', shortcut: '⌘G', onSelect: groupSelection, disabled: effSel.length < 2 },
        { label: 'Flip Horizontal', onSelect: () => flipSelection('h') },
        { label: 'Flip Vertical', onSelect: () => flipSelection('v') },
        { label: 'Lock / Unlock', onSelect: toggleLockSelection },
        { label: 'Hide / Show', onSelect: toggleHideSelection },
        { kind: 'separator' },
        { label: 'Delete', shortcut: '⌫', onSelect: deleteSelection, danger: true },
      )
      return items
    },
    [present.layers, cutSelection, copySelection, paste, duplicateSelection, arrangeLayer, ungroupSelection, groupSelection, flipSelection, toggleLockSelection, toggleHideSelection, deleteSelection],
  )

  /** Menu for the empty canvas. */
  const emptyMenuItems = useCallback(
    (): MenuItem[] => [
      { label: 'Add text', onSelect: addTextObject },
      { label: 'Paste', shortcut: '⌘V', onSelect: paste, disabled: clipboardRef.current.length === 0 },
      { label: 'Select all', shortcut: '⌘A', onSelect: selectAllObjects },
    ],
    [addTextObject, paste, selectAllObjects],
  )

  /** Point the actions at `ids` immediately (ref is synchronous; state catches up). */
  const focusSelection = useCallback((ids: string[]) => {
    liveSelectedRef.current = ids
    setRegionSel(null)
    setSelectedIds(ids)
  }, [])

  /** Right-click on the canvas: an object (select it if needed → object menu) or empty (empty menu). */
  const onCanvasContextMenu = useCallback(
    (x: number, y: number, objectId: string | null) => {
      if (objectId) {
        const effSel = liveSelectedRef.current.includes(objectId) ? liveSelectedRef.current : [objectId]
        if (!liveSelectedRef.current.includes(objectId)) focusSelection(effSel)
        setCtxMenu({ x, y, items: objectMenuItems(effSel) })
      } else {
        setCtxMenu({ x, y, items: emptyMenuItems() })
      }
    },
    [objectMenuItems, emptyMenuItems, focusSelection],
  )

  /** Right-click on a layer row: select it (keep a multi-select if the row is in it), then the menu. */
  const onLayerContextMenu = useCallback(
    (id: string, x: number, y: number) => {
      const effSel = liveSelectedRef.current.includes(id) ? liveSelectedRef.current : [id]
      if (!liveSelectedRef.current.includes(id)) focusSelection(effSel)
      setCtxMenu({ x, y, items: objectMenuItems(effSel, { includeRename: id }) })
    },
    [objectMenuItems, focusSelection],
  )

  // The Garment Library is the single source of truth — the catalog loads real garments.
  const { garments: library, loading: libraryLoading } = useGarments()
  // The Studio rail is editable-only: every card must resolve to a real region tree so clicking it
  // shows the garment's parts as layers. Traced/uploaded garments have no region tree (studioGarment
  // stays null → zero layers), so they're excluded here. This scopes editable-only to the Studio —
  // the shared listGarments and the Admin Garment Library still show every source. Filtering the
  // catalog itself (not just visibleGarments) makes catalog[0] — the garment selected on load — a
  // built-in template too, so the layers appear immediately without a click.
  const catalog = useMemo(() => library.filter((g) => isBuiltinGarmentId(g.id)).map(libToStudio), [library])

  // M9/8.2 bridge: an editable garment injected via ?garment=<id> (from the Garments editor). When
  // present it IS the active garment, so the studio shows YOUR garment (not a catalog item) and keys
  // the design to its id.
  const [searchParams] = useSearchParams()
  const [bridgeGarment, setBridgeGarment] = useState<Garment | null>(null)
  const [bridgeSvg, setBridgeSvg] = useState<string | null>(null)
  // The editable garment behind the current design surface (from the bridge, or a built-in template).
  // Its region tree is shown as controllable layers so you can hide/recolour any part in the Studio.
  const [studioGarment, setStudioGarment] = useState<EditableGarment | null>(null)
  const [regionSel, setRegionSel] = useState<string | null>(null)

  const activeGarment = useMemo<Garment>(
    () =>
      bridgeGarment ??
      catalog.find((g) => g.name === activeName) ??
      catalog[0] ?? { name: activeName || 'Garment', kind: 'hoodie', cat: 'Tops', fit: '', views: EMPTY_VIEWS },
    [catalog, activeName, bridgeGarment],
  )

  // One stable design per garment blank. The garment's own UUID is the design's id, so the
  // Recent-Designs row (Supabase designs.id is a uuid column) upserts cleanly per garment.
  const designId = activeGarment.id ?? ''

  // Built-in catalog garments have a real editable region tree behind them. "Open in Garment
  // Editor" builds a fresh editable copy and opens the region editor (front+back, every part a
  // layer) — the Studio itself is a print/graphics tool with a single-preview backdrop.
  const editableTemplateId = activeGarment.id && isBuiltinGarmentId(activeGarment.id) ? builtinTemplateId(activeGarment.id) : null
  const openInGarmentEditor = useCallback(() => {
    if (!user?.id || !editableTemplateId) return
    // Reopen the SAME editable copy on repeat clicks — creating a new garment every time silently
    // filled the user's collection with duplicates. The template→garment mapping lives per user.
    const mapKey = `threados-tpl-editable-${user.id}`
    let map: Record<string, string> = {}
    try {
      map = JSON.parse(localStorage.getItem(mapKey) ?? '{}') as Record<string, string>
    } catch {
      /* corrupt map — rebuild */
    }
    const existing = map[editableTemplateId]
    if (existing && getEditableSummary(user.id, existing)) {
      navigate(`/suite/garment-lab/${existing}`)
      return
    }
    const built = buildFromTemplate(editableTemplateId)
    const summary = createGarment(user.id, { ...built.garment, name: built.name }, { name: built.name, category: built.category, origin: 'blank' })
    try {
      localStorage.setItem(mapKey, JSON.stringify({ ...map, [editableTemplateId]: summary.id }))
    } catch {
      /* non-fatal */
    }
    navigate(`/suite/garment-lab/${summary.id}`)
  }, [user?.id, editableTemplateId, navigate])

  // Resolve the editable garment behind the active design surface so EVERY part shows as a layer:
  // 1) a real saved garment (a bridged / created editable garment has a region-tree history), else
  // 2) a built-in catalog template. Kind-only blanks (no id / no history) have no region tree.
  useEffect(() => {
    const id = activeGarment.id
    const h = id ? loadHistory(id) : null
    if (h) setStudioGarment(currentGarment(h))
    else if (editableTemplateId) setStudioGarment(buildFromTemplate(editableTemplateId).garment)
    else setStudioGarment(null)
    setRegionSel(null)
  }, [activeGarment.id, editableTemplateId])

  // Region overrides live in the UNDOABLE snapshot and persist with the design document —
  // studioGarment stays the pristine base; the displayed garment = base + overrides. An
  // override that lands back on the base value is dropped, so docs stay minimal.
  const displayGarment = useMemo(() => {
    if (!studioGarment) return null
    const rh = present.regionHidden ?? {}
    const rf = present.regionFills ?? {}
    const rn = present.regionNames ?? {}
    const rl = present.regionLocked ?? {}
    const rt = present.regionTransforms ?? {}
    if (![rh, rf, rn, rl, rt].some((m) => Object.keys(m).length > 0)) return studioGarment
    const regions = Object.fromEntries(
      Object.entries(studioGarment.regions).map(([id, r]) => {
        const visible = rh[id] !== undefined ? !rh[id] : r.visible
        const fill = rf[id]
        const name = rn[id] ?? r.name
        const locked = rl[id] !== undefined ? rl[id] : r.locked
        const t = rt[id]
        // A spatial move translates every shape's path in the garment's own SVG units.
        const shapes = t ? r.shapes.map((s) => ({ ...s, d: translateD(s.d, t.dx, t.dy) })) : r.shapes
        return [id, { ...r, visible, name, locked, shapes, appearance: fill ? { ...r.appearance, fill } : r.appearance }]
      }),
    )
    return { ...studioGarment, regions }
  }, [studioGarment, present.regionHidden, present.regionFills, present.regionNames, present.regionLocked, present.regionTransforms])

  // The garment backdrop is rendered FROM the displayed garment, so hiding/recolouring a region
  // updates the canvas live. Falls back to the bridge/library preview when there's no region tree.
  const studioBackdropSvg = useMemo(() => (displayGarment ? garmentThumbnailSvg(displayGarment) : null), [displayGarment])
  // Per-view backdrops: the view tabs genuinely switch Front/Back (the founder's "back stays the
  // same" fix). garmentThumbnailSvg renders views[0], so Back = the same garment with views swapped.
  const studioBackdropByView = useMemo(() => {
    if (!displayGarment || displayGarment.views.length < 2) return null
    return {
      Front: garmentThumbnailSvg(displayGarment),
      Back: garmentThumbnailSvg({ ...displayGarment, views: [...displayGarment.views].reverse() }),
    }
  }, [displayGarment])

  const garmentRegionLayers = useMemo<GarmentRegionLayer[]>(
    () =>
      // An AI garment-edit (garmentEditUrl) replaces the whole garment with a preview-only image, so
      // the previous garment's editable regions no longer apply — don't leak them into the Layers panel.
      displayGarment && !garmentEditUrl
        ? flattenRegions(displayGarment).map(({ region, depth }) => ({
            id: region.id,
            name: region.name,
            type: region.type,
            depth,
            visible: region.visible,
            color: region.appearance?.fill,
          }))
        : [],
    [displayGarment, garmentEditUrl],
  )

  const toggleRegion = useCallback(
    (id: string) => {
      const base = presentRef.current
      const baseVisible = studioGarment?.regions[id]?.visible ?? true
      const rh = { ...(base.regionHidden ?? {}) }
      const displayed = rh[id] !== undefined ? !rh[id] : baseVisible
      const nextDisplayed = !displayed
      // An override that matches the base state is redundant — drop it instead of storing it.
      if (nextDisplayed === baseVisible) delete rh[id]
      else rh[id] = !nextDisplayed
      commit({ ...base, regionHidden: rh })
    },
    [studioGarment, commit],
  )
  const selectRegion = useCallback((id: string) => {
    setRegionSel(id)
    setSelectedIds([])
  }, [])
  const cycleRegionColor = useCallback(
    (id: string) => {
      const base = presentRef.current
      const baseFill = studioGarment?.regions[id]?.appearance?.fill
      const rf = { ...(base.regionFills ?? {}) }
      const cur = (rf[id] ?? baseFill ?? '').toLowerCase()
      const idx = COLOR_SWATCHES.findIndex((s) => s.hex.toLowerCase() === cur)
      const next = idx < 0 ? COLOR_SWATCHES[0].hex : idx + 1 >= COLOR_SWATCHES.length ? undefined : COLOR_SWATCHES[idx + 1].hex
      if (next === undefined || next === baseFill) delete rf[id]
      else rf[id] = next
      commit({ ...base, regionFills: rf })
    },
    [studioGarment, commit],
  )
  /** Set a region's fill to a specific colour (from the inspector palette). undefined = reset to base. */
  const setRegionFill = useCallback(
    (id: string, hex: string | undefined) => {
      const base = presentRef.current
      const baseFill = studioGarment?.regions[id]?.appearance?.fill
      const rf = { ...(base.regionFills ?? {}) }
      if (!hex || hex.toLowerCase() === (baseFill ?? '').toLowerCase()) delete rf[id]
      else rf[id] = hex
      commit({ ...base, regionFills: rf })
    },
    [studioGarment, commit],
  )
  /** Rename a region — a draft-committed override, dropped when it matches the base name. */
  const renameRegion = useCallback(
    (id: string, name: string) => {
      const base = presentRef.current
      const baseName = studioGarment?.regions[id]?.name
      const rn = { ...(base.regionNames ?? {}) }
      const trimmed = name.trim()
      if (!trimmed || trimmed === baseName) delete rn[id]
      else rn[id] = trimmed
      commit({ ...base, regionNames: rn })
    },
    [studioGarment, commit],
  )
  /** Lock/unlock a region — locked parts are protected from move (see the canvas drag). */
  const toggleRegionLock = useCallback(
    (id: string) => {
      const base = presentRef.current
      const baseLocked = studioGarment?.regions[id]?.locked ?? false
      const rl = { ...(base.regionLocked ?? {}) }
      const cur = rl[id] !== undefined ? rl[id] : baseLocked
      const nextLocked = !cur
      if (nextLocked === baseLocked) delete rl[id]
      else rl[id] = nextLocked
      commit({ ...base, regionLocked: rl })
    },
    [studioGarment, commit],
  )
  /** Move a region by (dx,dy) in SVG viewBox units — accumulates onto any existing transform,
   *  dropping the override when the part returns to (near) its base position. */
  const moveRegion = useCallback(
    (id: string, dx: number, dy: number) => {
      if (dx === 0 && dy === 0) return
      const base = presentRef.current
      const rt = { ...(base.regionTransforms ?? {}) }
      const cur = rt[id] ?? { dx: 0, dy: 0 }
      const nextT = { dx: cur.dx + dx, dy: cur.dy + dy }
      if (Math.abs(nextT.dx) < 0.5 && Math.abs(nextT.dy) < 0.5) delete rt[id]
      else rt[id] = nextT
      commit({ ...base, regionTransforms: rt })
    },
    [commit],
  )

  // Session entry: once the catalog is available, decide how the Studio opens. Opening from a
  // specific garment (?garment=…) is handled by the bridge effect below — no gate then. Otherwise
  // ask before reopening the last design; if there is nothing to continue, go straight to the wizard.
  const restoredRef = useRef(false)
  useEffect(() => {
    if (restoredRef.current || catalog.length === 0) return
    if (searchParams.get('garment')) return // the bridge owns this entry
    restoredRef.current = true
    const lastId = loadLastGarment()
    const last = lastId ? catalog.find((g) => g.id === lastId) : null
    if (last) {
      setLastDesignName(last.name)
      setSessionGateOpen(true)
    } else {
      setWizardOpen(true)
    }
  }, [catalog, searchParams])

  // M9/8.2 unified workflow: opened from a garment (?garment=<id>&name=<name>) → make THAT editable
  // garment the active garment (its flat as the backdrop, design keyed to its id), skip the picker.
  const bridgedRef = useRef(false)
  useEffect(() => {
    // NOTE: this must NOT gate on catalog.length — a purchased/opened garment comes from its saved
    // history (loadHistory), not the built-in catalog. With the base library hidden the catalog is
    // empty, so gating here used to drop the ?garment= entry and fall back to the default blank.
    if (bridgedRef.current) return
    const gid = searchParams.get('garment')
    const gname = searchParams.get('name')
    if (!gid) return
    const h = loadHistory(gid)
    const catalogG = catalog.find((x) => x.id === gid)
    // Neither an editable garment nor a catalog entry → let the normal restore/gate handle it.
    if (!h && !catalogG) return
    bridgedRef.current = true
    restoredRef.current = true // the injected garment wins over last-opened restore
    try {
      sessionStorage.setItem('threados-studio-configured', '1')
    } catch {
      /* ignore */
    }
    setWizardOpen(false)
    // A catalog garment (e.g. a Recent Design on a built-in blank) opens straight to that garment.
    if (!h) {
      if (catalogG) setActiveName(catalogG.name)
      return
    }
    const eg = currentGarment(h)
    setBridgeSvg(garmentThumbnailSvg(eg))
    setStudioGarment(eg)
    setBridgeGarment({
      id: gid,
      name: gname || eg.name,
      kind: 'hoodie',
      cat: 'Tops',
      fit: '',
      category: undefined,
      views: { front: true, back: true, combinedFrontBack: false, side: false, details: false, has3D: false },
    })
  }, [searchParams, catalog])

  // Open a garment → load its saved document (or start empty). Resets undo history so each
  // garment is its own editing session; never carries one garment's layers onto another.
  // Saving is done explicitly at edit sinks (see saveCurrentDoc), so a load never persists.
  useEffect(() => {
    const gid = activeGarment.id
    if (!gid || loadedGarmentRef.current === gid) return
    loadedGarmentRef.current = gid
    // Opening from the Garments Studio passes ?design=<newId> → the design is keyed by that id, not
    // the garment id, so it starts as its own NEW file (a brand-new id has no saved doc → blank) and
    // never overwrites the garment's other designs. It stays reachable across reloads (the id is in
    // the URL). The garment STRUCTURE is unaffected (it loads from the garment id). The design id only
    // applies to the FIRST load — an internal garment switch afterwards loads that garment normally.
    const design = freshConsumedRef.current ? null : searchParams.get('design')
    freshConsumedRef.current = true
    const docKey = design || gid
    docKeyRef.current = docKey
    const doc = loadDoc(docKey)
    const snapshot: Snapshot = doc
      ? {
          layers: doc.layers,
          hidden: doc.hidden,
          regionHidden: doc.regionHidden,
          regionFills: doc.regionFills,
          regionNames: doc.regionNames,
          regionLocked: doc.regionLocked,
          regionTransforms: doc.regionTransforms,
        }
      : { layers: [], hidden: {} }
    // Versions: restore saved boards, or wrap the single loaded snapshot as "Version 1" (migration
    // for pre-versions docs and fresh designs). `present` mirrors the active version.
    const versionDocToSnapshot = (v: DesignVersionDoc): Snapshot => ({
      layers: v.layers,
      hidden: v.hidden ?? {},
      regionHidden: v.regionHidden,
      regionFills: v.regionFills,
      regionNames: v.regionNames,
      regionLocked: v.regionLocked,
      regionTransforms: v.regionTransforms,
    })
    let loadedVersions: DesignVersion[]
    let activeId: string
    if (doc?.versions && doc.versions.length > 0) {
      loadedVersions = doc.versions.map((v) => ({ id: v.id, name: v.name, snapshot: versionDocToSnapshot(v) }))
      activeId = doc.versions.some((v) => v.id === doc.activeVersionId) ? doc.activeVersionId! : loadedVersions[0].id
    } else {
      activeId = uid('ver')
      loadedVersions = [{ id: activeId, name: 'Page 1', snapshot }]
    }
    const activeSnapshot = loadedVersions.find((v) => v.id === activeId)?.snapshot ?? snapshot
    setVersions(loadedVersions)
    versionsRef.current = loadedVersions
    setActiveVersionId(activeId)
    activeVersionIdRef.current = activeId
    const name = doc?.designName || activeGarment.name
    setPast([])
    setFuture([])
    setPresent(activeSnapshot)
    presentRef.current = activeSnapshot
    setDesignName(name)
    designNameRef.current = name
    setCollectionId(doc?.collectionId)
    collectionIdRef.current = doc?.collectionId
    const loadedSpecs = doc?.specs ?? {}
    setSpecs(loadedSpecs)
    specsRef.current = loadedSpecs
    const loadedInfo = doc?.projectInfo ?? {}
    setProjectInfo(loadedInfo)
    projectInfoRef.current = loadedInfo
    // Restore each PAGE's AI garment backdrop from IndexedDB (per-version key), async. The garment
    // images aren't in the snapshot yet, so inject them once loaded — into the right version and into
    // `present` if that page is active — guarding against a fast garment switch.
    const injectGarment = (vid: string, url: string | null) => {
      if (loadedGarmentRef.current !== gid || !url) return // a newer garment loaded meanwhile
      const put = (v: DesignVersion): DesignVersion =>
        v.id === vid ? { ...v, snapshot: { ...v.snapshot, garmentEdit: url } } : v
      versionsRef.current = versionsRef.current.map(put)
      setVersions((vs) => vs.map(put))
      if (activeVersionIdRef.current === vid) {
        const nextPresent = { ...presentRef.current, garmentEdit: url }
        presentRef.current = nextPresent
        setPresent(nextPresent)
      }
    }
    doc?.versions?.forEach((v) => {
      if (v.garmentEditKey) void getGarmentImage(v.garmentEditKey).then((url) => injectGarment(v.id, url))
    })
    // Back-compat: an OLD doc stored one garment for the whole design → it belongs to Page 1.
    const baseVid = loadedVersions[0].id
    if (doc?.garmentEdit) injectGarment(baseVid, doc.garmentEdit)
    else if (doc?.garmentEditKey) void getGarmentImage(doc.garmentEditKey).then((url) => injectGarment(baseVid, url))
    // Restore (or clear) the neck label for this garment.
    setNeckLabel(doc?.neckLabel ?? null)
    neckLabelRef.current = doc?.neckLabel ?? null
    setSelectedIds([])
    saveLastGarment(gid)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGarment.id, activeGarment.name])

  const visibleGarments = useMemo(() => {
    const q = query.trim().toLowerCase()
    return catalog.filter((g) => {
      if (cat !== 'All' && g.cat !== cat) return false
      if (!q) return true
      return `${g.name} ${g.category ?? ''}`.toLowerCase().includes(q)
    })
  }, [catalog, cat, query])

  // Canvas backdrop: prefer the garment's crisp inline VECTOR (perfect at any zoom),
  // else its full-resolution raster. Resolved whenever the active garment changes.
  const [garmentSvg, setGarmentSvg] = useState<string | null>(null)
  const [garmentDisplayUrl, setGarmentDisplayUrl] = useState<string>('')
  useEffect(() => {
    const id = activeGarment.id
    // A bridged editable garment isn't in the Supabase catalog — its flat comes from bridgeSvg, so
    // never call loadGarmentDisplay for it (it would resolve to nothing).
    if (bridgeGarment) {
      setGarmentDisplayUrl('')
      return
    }
    if (!id) {
      setGarmentSvg(null)
      setGarmentDisplayUrl(activeGarment.thumbUrl ?? '')
      return
    }
    let alive = true
    void loadGarmentDisplay(id).then((res) => {
      if (!alive) return
      setGarmentSvg(res.svg ?? null)
      setGarmentDisplayUrl(res.imageUrl ?? activeGarment.thumbUrl ?? '')
    })
    return () => {
      alive = false
    }
  }, [activeGarment.id, activeGarment.thumbUrl, bridgeGarment])

  // The inspector shows the garment's real representations — loaded only while it's open.
  const [garmentReps, setGarmentReps] = useState<GarmentRepresentation[]>([])
  useEffect(() => {
    const id = activeGarment.id
    if (rightHidden || !id) {
      setGarmentReps([])
      return
    }
    let alive = true
    void getGarment(id).then((g) => {
      if (alive) setGarmentReps(g?.representations ?? [])
    })
    return () => {
      alive = false
    }
  }, [activeGarment.id, rightHidden])

  function selectRail(name: string) {
    setRail(name)
  }

  /** Drop a Drive asset onto the design: becomes a real, undoable layer. */
  const addAssetLayer = useCallback(
    (asset: { name: string; folder: string; url?: string }) => {
      // An asset with an image URL becomes a real, movable canvas object.
      const layer: Layer = asset.url
        ? makeImageLayer(asset.name, asset.url)
        : { id: `l-${Date.now().toString(36)}`, name: asset.name.replace(/\.[^.]+$/, ''), type: asset.folder === 'My Logos' ? 'Logo' : 'Graphic' }
      commit({ layers: [layer, ...presentRef.current.layers], hidden: presentRef.current.hidden })
      setSelectedIds([layer.id])
      toast(`“${layer.name}” added to the design.`, 'success')
    },
    [commit, toast],
  )

  // Place a library graphic: embed the asset's own copy so the project stays self-contained
  // (deleting the library asset never affects it) and each placement is an independent instance.
  const placeAsset = useCallback(
    async (assetId: string) => {
      try {
        const asset = await getAsset(assetId)
        if (!asset) {
          toast('That graphic is no longer in your library.', 'info')
          return
        }
        const dataUrl = await blobToDataUrl(asset.blob)
        const base = makeImageLayer(asset.filename, dataUrl)
        // Intelligent default: centered in the print area; portrait art gets a narrower width so it fits.
        const aspect = asset.width && asset.height ? asset.width / asset.height : 1
        const width = Math.max(0.2, Math.min(0.6, aspect < 1 ? 0.5 * aspect : 0.5))
        const layer: Layer = { ...base, obj: { ...base.obj!, x: 0.5, y: 0.5, width } }
        commit({ layers: [layer, ...presentRef.current.layers], hidden: presentRef.current.hidden })
        setSelectedIds([layer.id])
        void touchAsset(assetId)
        toast(`“${layer.name}” placed on the garment.`, 'success')
      } catch {
        toast('Could not place that graphic.', 'info')
      }
    },
    [commit, toast],
  )

  function doSelectGarment(g: Garment) {
    setActiveName(g.name)
    toast(`Loaded ${g.name} blank onto the canvas.`, 'success')
  }

  /** Copy the current design's prints/graphics onto the target garment, then open it. Region-part
   *  overrides are garment-specific, so they reset for the new blank — the layers carry over. */
  function moveDesignToGarment(target: Garment) {
    const src = presentRef.current
    if (target.id) {
      const verId = uid('ver')
      const ok = saveDoc(target.id, {
        layers: [],
        hidden: {},
        designName: designNameRef.current,
        collectionId: collectionIdRef.current,
        specs: specsRef.current,
        projectInfo: projectInfoRef.current,
        versions: [{ id: verId, name: 'Page 1', layers: src.layers, hidden: src.hidden }],
        activeVersionId: verId,
        updatedAt: Date.now(),
      })
      // If the move can't be written (storage full), don't navigate away and silently drop the work —
      // keep the user on the intact source and tell them.
      if (!ok) {
        toast(`Storage is full — couldn’t move the design onto ${target.name}. Export or remove heavy images/versions, then try again.`, 'info')
        setGarmentSwitchTarget(null)
        return
      }
    }
    setGarmentSwitchTarget(null)
    doSelectGarment(target)
  }

  function selectGarment(g: Garment) {
    if (g.name === activeName) return
    // A different garment with real work open → ask first (each garment keeps its own saved design,
    // so nothing is lost — but "keep separate" vs "carry the design over" should be an explicit choice).
    if (presentRef.current.layers.length > 0) {
      setGarmentSwitchTarget(g)
      return
    }
    doSelectGarment(g)
  }

  /** '+' in the Layers panel adds REAL content — an editable text object on the canvas. An
   *  obj-less layer could never render or receive content (a permanent dead-end), so we never
   *  create one from a user action. */
  function addLayer() {
    addTextObject()
  }

  // ---- Selection + smart context panel ----
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [layerFields, setLayerFields] = useState<Record<string, ContextField[]>>({})

  // Selection follows the stack: drop ids that no longer exist (undo/redo/delete).
  const liveSelected = useMemo(() => {
    const alive = new Set(layers.map((l) => l.id))
    return selectedIds.filter((id) => alive.has(id))
  }, [layers, selectedIds])
  useEffect(() => {
    liveSelectedRef.current = liveSelected
  }, [liveSelected])

  // Object ids shown selected on the canvas — selecting a group selects its member objects,
  // so they highlight + move together. (Canvas selection is by object; panel may hold a group.)
  const selectedObjIds = useMemo(() => {
    const sel = new Set(liveSelected)
    return layers.filter((l) => l.obj && (sel.has(l.id) || (l.groupId && sel.has(l.groupId)))).map((l) => l.id)
  }, [layers, liveSelected])

  /** Canvas selection: replace, or toggle (Shift+Click / additive). Clears any region highlight. */
  const selectObj = useCallback((id: string | null, additive?: boolean) => {
    setRegionSel(null)
    if (id === null) {
      setSelectedIds([])
      return
    }
    if (additive) setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
    else setSelectedIds([id])
  }, [])

  // Prune context fields of deleted layers so the map never accumulates orphans.
  useEffect(() => {
    const alive = new Set(layers.map((l) => l.id))
    setLayerFields((prev) => {
      const stale = Object.keys(prev).filter((id) => !alive.has(id))
      if (stale.length === 0) return prev
      const next = { ...prev }
      stale.forEach((id) => delete next[id])
      return next
    })
  }, [layers])

  const activeLayer = useMemo(
    () => (liveSelected.length === 1 ? layers.find((l) => l.id === liveSelected[0]) ?? null : null),
    [liveSelected, layers],
  )

  const activeFields = useMemo(
    () => (activeLayer ? layerFields[activeLayer.id] ?? defaultFieldsFor(activeLayer) : []),
    [activeLayer, layerFields],
  )

  /** Set a property of the selected object (picker-driven — no dialogs). */
  const setContextField = useCallback(
    (fieldId: string, value: string) => {
      if (!activeLayer || activeLayer.locked) return
      setLayerFields((prev) => ({
        ...prev,
        [activeLayer.id]: (prev[activeLayer.id] ?? defaultFieldsFor(activeLayer)).map((f) =>
          f.id === fieldId ? { ...f, value } : f,
        ),
      }))
      // Placement is a REAL canvas property — move the object, don't just relabel it.
      if (fieldId === 'cx-placement' && activeLayer.obj) {
        const spot = PLACEMENT_SPOTS[value.toLowerCase()]
        if (spot) setObjectProp(activeLayer.id, { x: spot.x, y: spot.y })
      }
      if (fieldId === 'cx-technique') rememberChoice('technique', value)
    },
    [activeLayer, rememberChoice, setObjectProp],
  )

  // The AI reads the selected object and gives one precise, applyable note.
  const garmentWeight = fields.details.find((f) => f.id === 'd-weight')?.value ?? ''
  const activeNote = useMemo<ObjectNote | null>(
    () => (activeLayer && !activeLayer.locked ? objectNote(activeLayer.type, activeLayer.name, activeFields, garmentWeight) : null),
    [activeLayer, activeFields, garmentWeight],
  )

  const applyObjectNote = useCallback(
    (note: ObjectNote) => {
      if (note.fieldChanges.length > 0) {
        note.fieldChanges.forEach(([id, value]) => setContextField(id, value))
      } else {
        // garment-level recommendation (e.g. "switch to 450 GSM") — keep fabric + weight consistent
        setFields((prev) => ({
          ...prev,
          details: prev.details.map((f) => {
            if (f.id === 'd-weight') return { ...f, value: '450 GSM' }
            if (f.id === 'd-fabric') return { ...f, value: 'Heavy French Terry 450 GSM' }
            return f
          }),
        }))
        // …and in the REAL specs the panel shows and the tech pack exports.
        patchSpec({ weight: '450 GSM', material: 'Heavy French Terry 450 GSM' })
        rememberChoice('weight', '450 GSM')
      }
      toast('Applied — the spec is updated.', 'accent')
    },
    [setContextField, rememberChoice, toast, patchSpec],
  )

  const commitLayers = useCallback(
    (nextLayers: Layer[], nextHidden: Record<string, boolean>) => {
      commit({ layers: nextLayers, hidden: nextHidden })
    },
    [commit],
  )

  const undo = useCallback(() => {
    if (past.length === 0) return
    const previous = past[past.length - 1]
    setPast((prev) => prev.slice(0, -1))
    setFuture((prev) => [present, ...prev])
    setPresent(previous)
    saveCurrentDoc(previous)
    toast('Undid last change.')
  }, [past, present, toast, saveCurrentDoc])

  const redo = useCallback(() => {
    if (future.length === 0) return
    const next = future[0]
    setFuture((prev) => prev.slice(1))
    setPast((prev) => [...prev, present])
    setPresent(next)
    saveCurrentDoc(next)
    toast('Redid change.')
  }, [future, present, toast, saveCurrentDoc])

  // Every Studio action as a searchable command (⌘K). Each just calls the already-wired op, so
  // they inherit undo + autosave + selection exactly like the toolbar, shortcuts and context menu.
  const paletteCommands = useMemo<Command[]>(() => {
    const hasSel = liveSelected.length > 0
    const cmd = (id: string, label: string, run: () => void, opts?: Partial<Command>): Command => ({ id, label, run, ...opts })
    return [
      cmd('undo', 'Undo', undo, { hint: '⌘Z', group: 'Edit', disabled: !canUndo }),
      cmd('redo', 'Redo', redo, { hint: '⌘⇧Z', group: 'Edit', disabled: !canRedo }),
      cmd('add-text', 'Add text', addTextObject, { group: 'Insert', keywords: 'new type layer' }),
      cmd('duplicate', 'Duplicate', duplicateSelection, { hint: '⌘D', group: 'Object', disabled: !hasSel }),
      cmd('copy', 'Copy', copySelection, { hint: '⌘C', group: 'Object', disabled: !hasSel }),
      cmd('cut', 'Cut', cutSelection, { hint: '⌘X', group: 'Object', disabled: !hasSel }),
      cmd('paste', 'Paste', paste, { hint: '⌘V', group: 'Object', disabled: clipboardRef.current.length === 0 }),
      cmd('delete', 'Delete', deleteSelection, { hint: '⌫', group: 'Object', disabled: !hasSel }),
      cmd('select-all', 'Select all', selectAllObjects, { hint: '⌘A', group: 'Object' }),
      cmd('group', 'Group', groupSelection, { hint: '⌘G', group: 'Arrange', disabled: selectedObjIds.length < 2 }),
      cmd('ungroup', 'Ungroup', ungroupSelection, { hint: '⌘⇧G', group: 'Arrange', disabled: !hasSel }),
      cmd('front', 'Bring to front', () => liveSelected[0] && arrangeLayer(liveSelected[0], 'front'), { hint: '⌘⇧]', group: 'Arrange', disabled: !hasSel }),
      cmd('forward', 'Bring forward', () => liveSelected[0] && arrangeLayer(liveSelected[0], 'forward'), { hint: '⌘]', group: 'Arrange', disabled: !hasSel }),
      cmd('backward', 'Send backward', () => liveSelected[0] && arrangeLayer(liveSelected[0], 'backward'), { hint: '⌘[', group: 'Arrange', disabled: !hasSel }),
      cmd('back', 'Send to back', () => liveSelected[0] && arrangeLayer(liveSelected[0], 'back'), { hint: '⌘⇧[', group: 'Arrange', disabled: !hasSel }),
      cmd('align-left', 'Align left', () => alignSelection('left'), { group: 'Align', keywords: 'distribute', disabled: !hasSel }),
      cmd('align-center', 'Align centers', () => alignSelection('center'), { group: 'Align', disabled: !hasSel }),
      cmd('align-right', 'Align right', () => alignSelection('right'), { group: 'Align', disabled: !hasSel }),
      cmd('align-top', 'Align top', () => alignSelection('top'), { group: 'Align', disabled: !hasSel }),
      cmd('align-middle', 'Align middles', () => alignSelection('middle'), { group: 'Align', disabled: !hasSel }),
      cmd('align-bottom', 'Align bottom', () => alignSelection('bottom'), { group: 'Align', disabled: !hasSel }),
      cmd('dist-h', 'Distribute horizontally', () => distributeSelection('h'), { group: 'Align', disabled: selectedObjIds.length < 3 }),
      cmd('dist-v', 'Distribute vertically', () => distributeSelection('v'), { group: 'Align', disabled: selectedObjIds.length < 3 }),
      cmd('flip-h', 'Flip horizontal', () => flipSelection('h'), { group: 'Object', disabled: !hasSel }),
      cmd('flip-v', 'Flip vertical', () => flipSelection('v'), { group: 'Object', disabled: !hasSel }),
      cmd('lock', 'Lock / unlock', toggleLockSelection, { group: 'Object', disabled: !hasSel }),
      cmd('hide', 'Hide / show', toggleHideSelection, { group: 'Object', disabled: !hasSel }),
      cmd('ask-ai', 'Ask loom studios AI', focusAiBar, { group: 'AI', keywords: 'prompt command generate' }),
      cmd('save', 'Save design…', () => setSaveOpen(true), { group: 'File', keywords: 'store collection' }),
    ]
  }, [
    liveSelected, selectedObjIds.length, canUndo, canRedo, undo, redo, addTextObject, duplicateSelection, copySelection,
    cutSelection, paste, deleteSelection, selectAllObjects, groupSelection, ungroupSelection, arrangeLayer, alignSelection,
    distributeSelection, flipSelection, toggleLockSelection, toggleHideSelection, focusAiBar,
  ])

  // ---- Keyboard shortcuts (skipped while typing) ----
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      const mod = e.metaKey || e.ctrlKey
      const k = e.key.toLowerCase()

      if (mod && k === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
        return
      }
      if (mod && k === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (mod && k === 'y') {
        e.preventDefault()
        redo()
        return
      }
      if (mod && k === 'a') {
        e.preventDefault()
        selectAllObjects()
        return
      }
      if (mod && k === 'c') {
        e.preventDefault()
        copySelection()
        return
      }
      if (mod && k === 'v') {
        e.preventDefault()
        paste()
        return
      }
      if (mod && k === 'd') {
        e.preventDefault()
        duplicateSelection()
        return
      }
      if (mod && k === 'g') {
        e.preventDefault()
        if (e.shiftKey) ungroupSelection()
        else groupSelection()
        return
      }
      // Stacking order: ⌘] / ⌘[  (⇧ → all the way to front/back)
      if (mod && (e.key === ']' || e.key === '[')) {
        e.preventDefault()
        const id = liveSelected[0]
        if (!id) return
        if (e.key === ']') arrangeLayer(id, e.shiftKey ? 'front' : 'forward')
        else arrangeLayer(id, e.shiftKey ? 'back' : 'backward')
        return
      }
      if (mod && k === 'x') {
        e.preventDefault()
        cutSelection()
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && liveSelected.length > 0) {
        e.preventDefault()
        deleteSelection()
        return
      }
      if (e.key === 'Escape' && liveSelected.length > 0) {
        setSelectedIds([])
        return
      }
      // Arrow-key nudge (Shift = a larger step)
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) && liveSelected.length > 0) {
        e.preventDefault()
        const step = e.shiftKey ? 0.05 : 0.005
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        nudgeSelection(dx, dy)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    layers,
    hidden,
    liveSelected,
    commit,
    undo,
    redo,
    toast,
    selectAllObjects,
    copySelection,
    paste,
    duplicateSelection,
    groupSelection,
    ungroupSelection,
    arrangeLayer,
    nudgeSelection,
    cutSelection,
    deleteSelection,
  ])

  // The design's identity, handed to the Manufacturing Export System.
  // Real export project — assembled from the live design (layers + specs + project info) + the
  // real garment. Project-info fields the user entered in the wizard win over derived defaults.
  const exportProject: RealExportProject = useMemo(
    () => ({
      brand: projectInfo.brand?.trim() || activeGarment.brand || 'loom studios',
      projectName: designName,
      designer: projectInfo.designer?.trim() || user?.name || user?.email?.split('@')[0] || 'Designer',
      collection: projectInfo.collection?.trim() || '',
      styleNumber: projectInfo.styleNumber?.trim() || '',
      sku: projectInfo.sku?.trim() || '',
      season: projectInfo.season?.trim() || '',
      garment: {
        name: activeGarment.name,
        category: activeGarment.category ? categoryLabel(activeGarment.category) : 'Other',
        views: activeGarment.views,
      },
      specs,
      layers: present.layers,
      hidden: present.hidden,
    }),
    [activeGarment, designName, user, specs, projectInfo, present],
  )

  async function shareDesign() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      // Honest: designs are stored on this device today — the link opens the studio, it does not
      // carry the design to other people. Server-backed sharing is a later milestone.
      toast('Link copied — it opens the studio on this device. Cross-device sharing is coming.', 'info')
    } catch {
      toast('Could not copy the link. Copy it from the address bar.', 'info')
    }
  }

  // ---- Smart studio: live readiness, AI command bar & companion ----
  // Artwork readiness = REAL canvas objects (any visible graphic/text), not layer-name guessing.
  const frontArt = layers.some((l) => l.obj && !hidden[l.id])

  const studioCtx = useMemo<StudioContext>(
    () => ({
      garment: { name: activeGarment.name, kind: activeGarment.kind, fit: activeGarment.fit },
      config,
      fields,
      frontArt,
      specs,
    }),
    [activeGarment, config, fields, frontArt, specs],
  )

  const readinessInput = useMemo(() => deriveReadiness(studioCtx), [studioCtx])
  const readiness = useMemo(() => computeReadiness(readinessInput), [readinessInput])

  // Collections the current user can save into (for the Save dialog).
  const myCollections = useMemo(
    () => data.collections.filter((c) => c.ownerId === user?.id),
    [data.collections, user?.id],
  )

  // ---- Save + auto-save: the design lands in Recent Designs, always current ----
  // A real preview thumbnail for Recent-Designs cards. Fire-and-forget (never blocks the save) and
  // throttled on auto-save so html2canvas doesn't run on every keystroke-quiet tick. Stored in a
  // separate local cache keyed by design id — no schema change, no Supabase risk.
  const lastThumbRef = useRef(0)
  const THUMB_MIN_INTERVAL = 20_000
  const captureThumb = useCallback((id: string, force: boolean) => {
    const now = Date.now()
    if (!force && now - lastThumbRef.current < THUMB_MIN_INTERVAL) return
    lastThumbRef.current = now
    void captureDesignThumbnail().then((url) => {
      if (url) saveDesignThumb(id, url)
    })
  }, [])

  // Capture a real preview shortly after a design opens (once the canvas has painted), so
  // Recent-Designs cards show the actual design — not a glyph — even for designs opened but not yet
  // re-saved. Cancelled if the user flicks to another garment first (no wasted html2canvas).
  useEffect(() => {
    if (!designId) return
    const t = window.setTimeout(() => captureThumb(designId, true), 1800)
    return () => window.clearTimeout(t)
  }, [designId, captureThumb])

  const persistDesign = useCallback(
    (name: string, colId: string | undefined, notify: boolean) => {
      if (!user || !designId) {
        if (notify && !user) toast('Sign in to save designs.', 'info')
        return
      }
      setSaveState('saving')
      const now = Date.now()
      mutate((d) => {
        const exists = d.designs.some((x) => x.id === designId)
        const next = {
          id: designId,
          ownerId: user.id,
          name,
          kind: activeGarment.kind,
          status: 'draft' as const,
          progress: readiness.score,
          collectionId: colId,
          updatedAt: now,
        }
        return {
          ...d,
          designs: exists
            ? d.designs.map((x) => (x.id === designId ? { ...x, ...next } : x))
            : [next, ...d.designs],
        }
      })
      window.setTimeout(() => setSaveState('saved'), 350)
      captureThumb(designId, notify) // force a fresh preview on explicit saves, throttle on auto-save
      if (notify) {
        const col = colId ? data.collections.find((c) => c.id === colId)?.name : undefined
        toast(col ? `“${name}” saved to ${col}.` : `“${name}” saved.`, 'success')
      }
    },
    [user, designId, activeGarment.kind, readiness.score, mutate, toast, data.collections, captureThumb],
  )

  // ---- Unsaved-changes guard --------------------------------------------------------------------
  // Leaving the Studio (the logo → workspace, the browser Back button, or a refresh/close) must ask
  // for an explicit Save or Discard decision while there are unsaved edits. The studio also autosaves,
  // so work is never lost — this is the deliberate "commit or discard before you leave" gate.
  const [pendingLeave, setPendingLeave] = useState<string | null>(null) // a path, or 'back'
  const dirty = saveState === 'unsaved'
  const dirtyRef = useRef(dirty)
  useEffect(() => {
    dirtyRef.current = dirty
  }, [dirty])

  // Browser refresh / tab close → native "leave site?" prompt while dirty.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  // Browser Back button → intercept via a history sentinel. Dirty: re-arm + open the dialog; clean:
  // leave to the workspace. (react-router 6 BrowserRouter has no useBlocker, hence the manual trap.)
  useEffect(() => {
    window.history.pushState(null, '', window.location.href)
    const onPop = () => {
      if (dirtyRef.current) {
        window.history.pushState(null, '', window.location.href)
        setPendingLeave('back')
      } else {
        navigate('/suite')
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Guarded in-app navigation (used by the logo → workspace).
  const guardedNavigate = useCallback(
    (to: string) => {
      if (dirtyRef.current) setPendingLeave(to)
      else navigate(to)
    },
    [navigate],
  )

  const leaveNow = useCallback(() => {
    const to = pendingLeave
    setPendingLeave(null)
    if (to && to !== 'back') navigate(to)
    else navigate('/suite')
  }, [pendingLeave, navigate])

  const saveAndLeave = useCallback(() => {
    saveCurrentDoc(presentRef.current)
    persistDesign(designNameRef.current, collectionIdRef.current, false)
    leaveNow()
  }, [saveCurrentDoc, persistDesign, leaveNow])

  /**
   * Confirm from the Save dialog. Creates the collection (if new) AND saves the design in a
   * SINGLE mutate, so reconcile inserts the collection before the design references it —
   * otherwise the design's collection_id would hit a foreign-key that doesn't exist yet.
   */
  const confirmSave = useCallback(
    (choice: SaveChoice) => {
      if (!user || !designId) {
        toast(!user ? 'Sign in to save designs.' : 'Pick a garment first.', 'info')
        setSaveOpen(false)
        return
      }
      const now = Date.now()
      const newColId = choice.newCollection ? uid('col') : undefined
      const colId = newColId ?? choice.collectionId
      setSaveState('saving')
      mutate((d) => {
        const collections = newColId
          ? [
              { id: newColId, ownerId: user.id, name: choice.newCollection!, season: '', status: 'draft' as const, updatedAt: now },
              ...d.collections,
            ]
          : d.collections
        const exists = d.designs.some((x) => x.id === designId)
        const nextDesign = {
          id: designId,
          ownerId: user.id,
          name: choice.name,
          kind: activeGarment.kind,
          status: 'draft' as const,
          progress: readiness.score,
          collectionId: colId,
          updatedAt: now,
        }
        return {
          ...d,
          collections,
          designs: exists
            ? d.designs.map((x) => (x.id === designId ? { ...x, ...nextDesign } : x))
            : [nextDesign, ...d.designs],
        }
      })
      setDesignName(choice.name)
      setCollectionId(colId)
      // Persist the local document with the chosen name + collection right away.
      saveCurrentDoc(presentRef.current, choice.name, colId)
      captureThumb(designId, true) // real preview for Recent Designs
      window.setTimeout(() => setSaveState('saved'), 350)
      const colName = choice.newCollection ?? (choice.collectionId ? myCollections.find((c) => c.id === choice.collectionId)?.name : undefined)
      toast(colName ? `“${choice.name}” saved to ${colName}.` : `“${choice.name}” saved.`, 'success')
      setSaveOpen(false)
    },
    [user, designId, activeGarment.kind, readiness.score, mutate, toast, myCollections, saveCurrentDoc, captureThumb],
  )

  // Auto-save (metadata → Recent Designs): any real change persists after 2s of quiet.
  // Skips pristine empty designs so merely browsing garments never creates empty draft rows.
  const firstChange = useRef(true)
  useEffect(() => {
    if (firstChange.current) {
      firstChange.current = false
      return
    }
    if (present.layers.length === 0) return
    setSaveState('unsaved')
    const t = window.setTimeout(() => persistDesign(designName, collectionId, false), 2000)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields, config, present, activeName, designName, collectionId])

  /**
   * Route a garment property to the REAL systems — the Product Specs the user sees and the
   * tech-pack export reads, and the canvas for placement commands. (The legacy `fields` copy is
   * still written for AI context, but it is never the only destination — no phantom applies.)
   */
  const applyRealField = useCallback(
    (fieldId: string, value: string) => {
      if (fieldId === 'd-fit') patchSpec({ fit: value })
      else if (fieldId === 'd-fabric') patchSpec({ material: value })
      else if (fieldId === 'd-weight') patchSpec({ weight: value })
      else if (fieldId === 'd-color') patchSpec({ colors: [{ name: value, hex: value }] })
      else if (/composition/i.test(fieldId)) patchSpec({ composition: value })
      else if (fieldId === 'de-technique') {
        const notes = specsRef.current.notes ?? ''
        const line = `Technique: ${value}`
        if (!notes.includes(line)) patchSpec({ notes: notes ? `${notes}\n${line}` : line })
      } else if (fieldId === 'de-placement') {
        const spot = PLACEMENT_SPOTS[value.toLowerCase()]
        const target =
          presentRef.current.layers.find((l) => l.obj && selectedIds.includes(l.id)) ??
          presentRef.current.layers.find((l) => l.obj && !presentRef.current.hidden[l.id])
        if (spot && target) setObjectProp(target.id, { x: spot.x, y: spot.y })
        else if (!target) toast('Add a graphic or text first — there is nothing to reposition yet.', 'info')
      }
    },
    [patchSpec, setObjectProp, selectedIds, toast],
  )

  const applyAction = useCallback(
    (action: StudioAction) => {
      if (action.kind === 'set-field') {
        setFields((prev) => ({
          ...prev,
          [action.group]: (prev[action.group] ?? []).map((f) =>
            f.id === action.fieldId ? { ...f, value: action.value } : f,
          ),
        }))
        applyRealField(action.fieldId, action.value)
        const dim = MEMORY_DIMS[action.fieldId]
        if (dim) rememberChoice(dim, action.value)
      } else if (action.kind === 'toggle-config') {
        setConfig((prev) => ({ ...prev, [action.key]: action.value }))
        if (action.key === 'neckLabel' && action.value) rememberChoice('label', 'Woven neck label')
      } else if (action.kind === 'add-note') {
        // Production notes land in the REAL spec notes (deduped), not just in memory.
        const notes = specsRef.current.notes ?? ''
        if (!notes.includes(action.note)) patchSpec({ notes: notes ? `${notes}\n${action.note}` : action.note })
        if (/wash/i.test(action.note)) rememberChoice('wash', 'Vintage wash')
      }
    },
    [MEMORY_DIMS, rememberChoice, applyRealField, patchSpec],
  )

  const fixCheck = useCallback(
    (id: string) => {
      const map: Record<string, StudioAction | undefined> = {
        'neck-label': { kind: 'toggle-config', key: 'neckLabel', value: true },
        'care-label': { kind: 'toggle-config', key: 'careLabel', value: true },
        packaging: { kind: 'toggle-config', key: 'packaging', value: true },
        tolerance: { kind: 'toggle-config', key: 'tolerance', value: true },
        'production-notes': { kind: 'toggle-config', key: 'productionNotes', value: true },
        construction: { kind: 'toggle-config', key: 'construction', value: true },
      }
      const action = map[id]
      if (action) {
        applyAction(action)
        toast('Marked ready.', 'success')
      } else if (id === 'front-art') {
        // Real fix: open the Graphics library so the user can place artwork right now.
        setRail('Graphics')
        toast('Pick a graphic — or use Add text in the toolbar. It lands on the garment.', 'info')
      } else if (id === 'materials' || id === 'colors') {
        // Real fix: open the Product Specs panel where these fields actually live.
        setRightHidden(false)
        toast(id === 'materials' ? 'Set the material in Product Specs on the right.' : 'Add a colorway in Product Specs on the right.', 'info')
      } else {
        toast('Add this from the design panel on the right.', 'info')
      }
    },
    [applyAction, toast],
  )

  /** Set a garment property (picker-driven — no dialogs anywhere). Routed to the real specs too. */
  const setField = useCallback(
    (group: string, fieldId: string, value: string) => {
      setFields((prev) => ({
        ...prev,
        [group]: (prev[group] ?? []).map((f) => (f.id === fieldId ? { ...f, value } : f)),
      }))
      applyRealField(fieldId, value)
      const dim = MEMORY_DIMS[fieldId]
      if (dim) rememberChoice(dim, value)
    },
    [MEMORY_DIMS, rememberChoice, applyRealField],
  )

  /** The wizard hands over a configured design — no empty editor, ever. */
  const completeWizard = useCallback(
    (r: WizardResult) => {
      // Selecting the garment opens (or creates) that garment's design — see the load effect.
      setActiveName(r.garmentName || 'Hoodie')
      setFields((prev) => ({
        ...prev,
        details: prev.details.map((f) => {
          if (f.id === 'd-fit') return { ...f, value: r.fit }
          if (f.id === 'd-fabric') return { ...f, value: r.fabric }
          if (f.id === 'd-weight') return { ...f, value: r.weight }
          if (f.id === 'd-color') return { ...f, value: r.colorHex }
          return f
        }),
      }))
      // The wizard's choices are REAL product specs (visible in the panel, read by exports).
      patchSpec({ fit: r.fit, material: r.fabric, weight: r.weight, colors: [{ name: r.colorName, hex: r.colorHex }] })
      rememberChoice('fit', r.fit)
      rememberChoice('weight', r.weight)
      rememberChoice('color', r.colorName)
      try {
        sessionStorage.setItem('threados-studio-configured', '1')
      } catch {
        /* ignore */
      }
      setWizardOpen(false)
      toast(`Your ${r.garmentName.toLowerCase()} is ready — ${r.colorName}, ${r.fit.toLowerCase()}, ${r.weight}.`, 'accent')
    },
    [rememberChoice, toast, patchSpec],
  )

  const skipWizard = useCallback(() => {
    try {
      sessionStorage.setItem('threados-studio-configured', '1')
    } catch {
      /* ignore */
    }
    setWizardOpen(false)
  }, [])

  // Session gate → "Continue": reopen the last design (setting the active garment reloads its doc).
  const continueLastDesign = useCallback(() => {
    const lastId = loadLastGarment()
    const last = lastId ? catalog.find((g) => g.id === lastId) : null
    if (last) setActiveName(last.name)
    setSessionGateOpen(false)
  }, [catalog])

  // Session gate → "New file": drop the last design and open the New Design wizard.
  const startNewFromGate = useCallback(() => {
    setSessionGateOpen(false)
    setWizardOpen(true)
  }, [])

  /** Apply the Brand Kit defaults to this design (fabric, fit, weight). */
  const applyBrandKit = useCallback(
    (k: BrandKit) => {
      const gsm = k.defaultFabric.match(/(\d+)\s*GSM/i)?.[0]?.toUpperCase()
      setFields((prev) => ({
        ...prev,
        details: prev.details.map((f) => {
          if (f.id === 'd-fabric') return { ...f, value: k.defaultFabric }
          if (f.id === 'd-fit') return { ...f, value: k.defaultFit }
          if (f.id === 'd-weight' && gsm) return { ...f, value: gsm }
          return f
        }),
      }))
      // Brand defaults land in the REAL specs the panel shows and exports read.
      patchSpec({ material: k.defaultFabric, fit: k.defaultFit, ...(gsm ? { weight: gsm } : {}) })
      kitRef.current = k
      toast('Brand Kit defaults applied to this design.', 'accent')
    },
    [toast, patchSpec],
  )

  return (
    <div className="suite studio">
      {/* ---- Editor top bar ---- */}
      <header className="ds-top">
        <div className="ds-top__left">
          <button className="ds-logo" type="button" onClick={() => guardedNavigate('/suite')}>
            <img className="ds-logo__img" src={loomLogo} alt="loom studios" />
            <span className="ds-logo__beta">Beta</span>
          </button>
          {/* Connect App + live readiness — next to the logo (no separate bar below). */}
          <CommandBar
            readiness={readiness}
            onFix={fixCheck}
            onConnectApp={() => setConnectOpen(true)}
          />
        </div>

        <div className="ds-top__right">
          <button className="ds-cmdk" type="button" title="Command palette (⌘K)" onClick={() => setPaletteOpen(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <span>Actions</span>
            <kbd>⌘K</kbd>
          </button>
          <button className="s-btn s-btn--ghost" type="button" title="Start a new design" onClick={() => setWizardOpen(true)}>
            New
          </button>
          <button
            className="s-btn s-btn--ghost"
            type="button"
            title="Save this design to a collection"
            onClick={() => setSaveOpen(true)}
          >
            Save
          </button>
          <button className="s-btn s-btn--ghost" type="button" onClick={shareDesign}>
            <IcoUpload width="16" height="16" /> Share
          </button>
          <button
            className="s-btn s-btn--accent"
            type="button"
            title="Generate campaign photos of this garment on a model"
            onClick={() => setCampaignOpen(true)}
          >
            <IcoSparkle width="15" height="15" /> Generate
          </button>
          <Suspense
            fallback={
              <button className="s-btn s-btn--accent" type="button" disabled>
                Export
              </button>
            }
          >
            <ExportMenu
              project={exportProject}
              projectInfo={projectInfo}
              specs={specs}
              onPatchProjectInfo={patchProjectInfo}
              onPatchSpec={patchSpec}
            />
          </Suspense>
          <span className="ds-sep" />
          <button
            className="ds-icon"
            type="button"
            aria-label="Undo"
            title={canUndo ? 'Undo (⌘Z)' : 'Nothing to undo'}
            disabled={!canUndo}
            onClick={undo}
          >
            <IcoArrowRight width="16" height="16" style={{ transform: 'scaleX(-1)' }} />
          </button>
          <button
            className="ds-icon"
            type="button"
            aria-label="Redo"
            title={canRedo ? 'Redo (⇧⌘Z)' : 'Nothing to redo'}
            disabled={!canRedo}
            onClick={redo}
          >
            <IcoArrowRight width="16" height="16" />
          </button>
          <span className="ds-sep" />
          <button
            className="ds-icon"
            type="button"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? <IcoSun width="18" height="18" /> : <IcoMoon width="17" height="17" />}
          </button>

          <div className="ds-pop-wrap">
            <button
              className="ds-icon"
              type="button"
              aria-label="Keyboard shortcuts & help"
              title="Shortcuts & help"
              aria-expanded={helpOpen}
              onClick={() => {
                setHelpOpen((v) => !v)
                setNotifOpen(false)
              }}
            >
              <IcoHelp width="18" height="18" />
            </button>
            {helpOpen && (
              <div className="ds-pop" role="dialog" aria-label="Shortcuts">
                <b className="ds-pop__title">Shortcuts</b>
                {[
                  ['⌘Z / ⇧⌘Z', 'Undo / Redo'],
                  ['⌘D', 'Duplicate layer'],
                  ['Delete', 'Remove selection'],
                  ['Esc', 'Deselect'],
                  ['Scroll', 'Zoom to cursor'],
                  ['Space + drag', 'Pan the canvas'],
                  ['Double-click', 'Fit to view'],
                ].map(([k, v]) => (
                  <div className="ds-pop__row" key={k}>
                    <kbd>{k}</kbd>
                    <span>{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="ds-pop-wrap">
            <button
              className="ds-icon ds-icon--badge"
              type="button"
              aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
              title="Notifications"
              aria-expanded={notifOpen}
              onClick={() => {
                setNotifOpen((v) => !v)
                setHelpOpen(false)
                if (!notifOpen && unread > 0) {
                  mutate((d) => ({ ...d, notifications: d.notifications.map((n) => ({ ...n, read: true })) }))
                }
              }}
            >
              <IcoBell width="18" height="18" />
              {unread > 0 && <span className="ds-icon__badge">{unread}</span>}
            </button>
            {notifOpen && (
              <div className="ds-pop ds-pop--notif" role="dialog" aria-label="Notifications">
                <b className="ds-pop__title">Notifications</b>
                {data.notifications.length === 0 && <p className="ds-pop__empty">You're all caught up.</p>}
                {data.notifications.map((n) => (
                  <div className="ds-pop__notif" key={n.id}>
                    <b>{n.title}</b>
                    <small>{n.body}</small>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ---- Body ---- */}
      <div
        className={`ds-body${rightHidden ? ' ds-body--no-right' : ''}${leftHidden ? ' ds-body--no-left' : ''}`}
        style={libraryW ? ({ '--library-w': `${libraryW}px` } as React.CSSProperties) : undefined}
      >
        {/* Library rail — five human categories, all real */}
        <nav className="ds-rail" aria-label="Library">
          <span className="ds-rail__eyebrow">Library</span>
          {RAIL.map((r) => (
            <button
              key={r}
              type="button"
              className={`ds-rail__item${rail === r ? ' is-active' : ''}`}
              onClick={() => selectRail(r)}
            >
              <RailIcon name={r} />
              <span>{r}</span>
            </button>
          ))}
        </nav>

        {/* Collapse the Library — mirror of the inspector handle */}
        <button
          type="button"
          className={`ds-collapse ds-collapse--left${leftHidden ? ' is-collapsed' : ''}`}
          onClick={toggleLeft}
          aria-expanded={!leftHidden}
          aria-label={leftHidden ? 'Show library' : 'Hide library'}
          title={leftHidden ? 'Show library' : 'Hide library — focus on the canvas'}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d={leftHidden ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'} />
          </svg>
        </button>

        {/* Drag the library's right edge to resize it */}
        {!leftHidden && (
          <div
            className="ds-lib-resize"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize library"
            title="Drag to resize the library"
            onPointerDown={startLibraryResize}
          />
        )}

        {/* Left panel — the Library category currently open */}
        {!leftHidden && (
        <aside className="ds-left">
          {/* loom studios AI lives in the Library rail (it replaced the old Catalog). Always mounted so a
              generation survives switching rails; hidden when another Library category is active. */}
          <div className="ds-left__ai" style={{ display: rail === 'AI' ? 'flex' : 'none' }}>
            <ThreadosAIModal
              embedded
              open
              initialPrompt={aiPrompt}
              initialMode={aiMode}
              userId={user?.id}
              onClose={() => {}}
              onAddToCanvas={addGeneratedConcept}
              onApplyGarment={applyGarmentToPage}
            />
          </div>
          {rail === 'Assets' && <AssetLibrary userId={user?.id} onPlace={(id) => void placeAsset(id)} />}
          {rail === 'Brand Kit' && <BrandKitPanel onApplyDefaults={applyBrandKit} />}
          {rail === 'Inspiration' && (
            <InspirationPanel
              onApply={(p) => {
                setActiveName(p.garment || 'Hoodie')
                setField('details', 'd-fit', p.fit)
                setField('details', 'd-fabric', p.fabric)
                setField('details', 'd-color', p.colorHex)
                if (p.text) commit({ layers: [makeTextLayer(p.text, p.textColor ?? '#F4F4F6'), ...presentRef.current.layers], hidden: presentRef.current.hidden })
                toast(`“${p.name}” look applied.`, 'accent')
              }}
            />
          )}
          {rail === 'Graphics' && <GraphicsPanel onAdd={(name) => addGraphicObject(name)} />}
          {rail === 'Elements' && <ElementsPanel onAdd={addGraphicObject} />}
          {rail === 'Garments' && (
          <div className="ds-left__scroll">
            <div className="ds-panel-head">
              <h2>Catalog</h2>
              <button
                className={`ds-mini${showCatalogHint ? ' is-active' : ''}`}
                type="button"
                aria-label="Toggle catalog help"
                aria-pressed={showCatalogHint}
                title="Show how the catalog works"
                onClick={() => setShowCatalogHint((v) => !v)}
              >
                <IcoDots width="15" height="15" />
              </button>
            </div>

            {showCatalogHint && (
              <p className="ds-hint">
                Pick a garment blank below, then design it on the canvas. Use the Layers panel to stack
                graphics and materials.
              </p>
            )}

            <label className="ds-search">
              <IcoSearch width="15" height="15" />
              <input
                placeholder="Search for items…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search garments"
              />
            </label>

            <div className="ds-cats">
              {CATS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`ds-cat${cat === c ? ' is-active' : ''}`}
                  onClick={() => setCat(c)}
                >
                  {c}
                </button>
              ))}
            </div>

            {libraryLoading ? (
              <div className="ds-garments" aria-busy="true">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="ds-garment ds-garment--sk">
                    <span className="ds-garment__thumb" />
                  </div>
                ))}
              </div>
            ) : catalog.length === 0 ? (
              <p className="ds-empty">
                No garments imported yet.
                <span className="ds-empty__sub">An admin adds garments in the Garment Library.</span>
              </p>
            ) : visibleGarments.length > 0 ? (
              <div className="ds-garments">
                {visibleGarments.map((g) => {
                  const Glyph = GARMENT_GLYPHS[g.kind]
                  return (
                    <button
                      key={g.id ?? g.name}
                      type="button"
                      className={`ds-garment${activeName === g.name ? ' is-active' : ''}`}
                      onClick={() => selectGarment(g)}
                      title={g.category ? `${g.name} · ${categoryLabel(g.category)}` : g.name}
                    >
                      <span className="ds-garment__thumb">
                        {g.thumbUrl ? (
                          <img className="ds-garment__img" src={g.thumbUrl} alt={g.name} loading="lazy" />
                        ) : (
                          <Glyph width="40" height="40" />
                        )}
                      </span>
                      <span className="ds-garment__name">{g.name}</span>
                      {g.category && <span className="ds-garment__cat">{categoryLabel(g.category)}</span>}
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="ds-empty">
                No garments match “{query.trim()}”.
                <button type="button" className="ds-empty__reset" onClick={() => setQuery('')}>
                  Clear search
                </button>
              </p>
            )}
          </div>
          )}

          {/* Layers — its own Library tab (Figma-grade: multi-select, rename, lock, groups, reorder) */}
          {rail === 'Layers' && (
            <div className="ds-left__layers">
              <LayersPanel
                layers={layers}
                hidden={hidden}
                selectedIds={liveSelected}
                onCommit={commitLayers}
                onSelect={(ids) => {
                  setSelectedIds(ids)
                  if (ids.length > 0) setRegionSel(null) // a layer selection replaces a region selection
                }}
                onAddLayer={addLayer}
                baseGarmentName={activeGarment.name}
                baseSelected={liveSelected.length === 0 && !regionSel}
                onSelectBase={() => {
                  setSelectedIds([])
                  setRegionSel(null)
                }}
                garmentRegions={garmentRegionLayers}
                garmentTitle={studioGarment?.name}
                garmentSelectedId={regionSel}
                onToggleRegion={toggleRegion}
                onSelectRegion={selectRegion}
                onCycleRegionColor={cycleRegionColor}
                onRowContextMenu={onLayerContextMenu}
                renameHandle={renameHandleRef}
              />
            </div>
          )}
        </aside>
        )}

        {/* Canvas — also a drop target for Drive assets and starter graphics */}
        <div
          style={{ display: 'contents' }}
          onDragOver={(e) => {
            const t = e.dataTransfer.types
            if (t.includes('application/x-threados-asset') || t.includes('application/x-threados-graphic') || t.includes(ASSET_DRAG_TYPE)) e.preventDefault()
          }}
          onDrop={(e) => {
            const assetId = e.dataTransfer.getData(ASSET_DRAG_TYPE)
            const asset = e.dataTransfer.getData('application/x-threados-asset')
            const graphic = e.dataTransfer.getData('application/x-threados-graphic')
            if (!assetId && !asset && !graphic) return
            e.preventDefault()
            try {
              if (assetId) void placeAsset(assetId)
              else if (asset) addAssetLayer(JSON.parse(asset) as { name: string; folder: string; url?: string })
              else addGraphicObject(graphic)
            } catch {
              /* malformed payload — ignore */
            }
          }}
        >
          <StudioCanvas
            garmentName={activeGarment.name}
            garmentKind={activeGarment.kind}
            garmentViews={activeGarment.views}
            garmentImage={garmentDisplayUrl || activeGarment.thumbUrl}
            garmentOverride={garmentEditUrl}
            neckLabel={neckLabel}
            onNeckLabel={() => setNeckLabelOpen(true)}
            garmentSvg={studioBackdropSvg ?? (bridgeGarment ? bridgeSvg : garmentSvg)}
            garmentSvgByView={studioBackdropByView}
            designName={designName}
            onRenameDesign={(n) => {
              setDesignName(n)
              saveCurrentDoc(presentRef.current, n)
            }}
            saveState={saveState}
            pages={versions.map((v) => ({
              id: v.id,
              name: v.name,
              // Live garment for the active page (present), stored garment for the rest.
              thumb: (v.id === activeVersionId ? present.garmentEdit : v.snapshot.garmentEdit) ?? null,
            }))}
            activePageId={activeVersionId}
            onSwitchPage={switchVersion}
            onAddPage={addVersion}
            onDeletePage={deleteVersion}
            objects={objectLayers}
            hiddenMap={hidden}
            selectedObjIds={selectedObjIds}
            onSelectObj={selectObj}
            onMarqueeSelect={(ids, additive) => {
              setRegionSel(null)
              setSelectedIds((prev) => (additive ? [...new Set([...prev, ...ids])] : ids))
            }}
            onLiveObj={liveObject}
            onCommitObj={commitObject}
            onEditText={editObjectText}
            onAddText={addTextObject}
            onAddImage={addImageObject}
            onCreateObject={addShapeObject}
            regionGarment={garmentEditUrl ? null : displayGarment}
            selectedRegionId={regionSel}
            onSelectRegion={(id) => (id ? selectRegion(id) : setRegionSel(null))}
            onMoveRegion={moveRegion}
            onContextMenu={onCanvasContextMenu}
            objectSelectionCount={selectedObjIds.length}
            onAlign={alignSelection}
            onDistribute={distributeSelection}
          />
        </div>

        {/* Collapse the inspector — let the designer focus on the piece */}
        <button
          type="button"
          className={`ds-collapse${rightHidden ? ' is-collapsed' : ''}`}
          onClick={toggleRight}
          aria-expanded={!rightHidden}
          aria-label={rightHidden ? 'Show inspector' : 'Hide inspector'}
          title={rightHidden ? 'Show inspector' : 'Hide inspector — focus on the canvas'}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d={rightHidden ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
          </svg>
        </button>

        {/* Inspector — the selected object, or the garment itself */}
        {!rightHidden && (
        <aside className="ds-right">
          {activeLayer?.obj ? (
            <div className="ds-right__scroll">
              <ObjectInspector
                layer={activeLayer}
                onChange={(patch) => setObjectProp(activeLayer.id, patch)}
                onReplace={() => replaceImage(activeLayer.id)}
                onArrange={(op) => arrangeLayer(activeLayer.id, op)}
                onDelete={() => {
                  const nextHidden = { ...hidden }
                  delete nextHidden[activeLayer.id]
                  commit({ layers: layers.filter((l) => l.id !== activeLayer.id), hidden: nextHidden })
                  setSelectedIds([])
                }}
                onBack={() => setSelectedIds([])}
              />
            </div>
          ) : activeLayer ? (
            <div className="ds-right__scroll">
              <ContextPanel
                layer={activeLayer}
                fields={activeFields}
                memberCount={
                  activeLayer.type === 'Group' ? layers.filter((l) => l.groupId === activeLayer.id).length : undefined
                }
                aiNote={activeNote}
                onFieldChange={setContextField}
                onApplyNote={applyObjectNote}
                onBack={() => setSelectedIds([])}
              />
            </div>
          ) : regionSel && displayGarment ? (
            <div className="ds-right__scroll">
              <RegionInspector
                garment={displayGarment}
                selectedId={regionSel}
                onRename={renameRegion}
                onToggleVisible={toggleRegion}
                onToggleLocked={toggleRegionLock}
                onSetColor={setRegionFill}
              />
            </div>
          ) : (
            <div className="ds-right__scroll">
              <GarmentInfoPanel
                name={activeGarment.name}
                brand={activeGarment.brand}
                category={activeGarment.category}
                views={activeGarment.views}
                representations={garmentReps}
                hasRegionTree={!!editableTemplateId}
                onEditRegions={editableTemplateId && user?.id ? openInGarmentEditor : undefined}
              />
              <ProductSpecsEditor specs={specs} onSpec={patchSpec} mode={mode} />
            </div>
          )}
        </aside>
        )}
      </div>

      {/* loom studios AI is now embedded in the Library rail (see .ds-left above) — no portal modal. */}
      <CampaignModal open={campaignOpen} garmentName={activeGarment.name} userId={user?.id} onClose={() => setCampaignOpen(false)} />
      <ConnectAppDialog open={connectOpen} onClose={() => setConnectOpen(false)} />
      {director && rail !== 'AI' && !saveOpen && !wizardOpen && !sessionGateOpen && !garmentSwitchTarget && (
        <CreativeDirector
          suggestions={director.suggestions}
          onApply={applyDirector}
          onDismiss={dismissDirectorSuggestion}
          onClose={() => setDirector(null)}
        />
      )}
      <SessionStartDialog
        open={sessionGateOpen}
        lastName={lastDesignName}
        onContinue={continueLastDesign}
        onNew={startNewFromGate}
      />
      <GarmentSwitchDialog
        open={!!garmentSwitchTarget}
        currentName={designName || activeGarment.name}
        targetName={garmentSwitchTarget?.name ?? ''}
        onOpenNew={() => {
          const t = garmentSwitchTarget
          setGarmentSwitchTarget(null)
          if (t) doSelectGarment(t)
        }}
        onMoveHere={() => {
          if (garmentSwitchTarget) moveDesignToGarment(garmentSwitchTarget)
        }}
        onCancel={() => setGarmentSwitchTarget(null)}
      />
      <NewDesignWizard open={wizardOpen} onComplete={completeWizard} onClose={skipWizard} />

      {/* Save — name the design + choose (or create) the collection it belongs to */}
      <SaveDesignDialog
        open={saveOpen}
        initialName={designName}
        collections={myCollections}
        currentCollectionId={collectionId}
        onClose={() => setSaveOpen(false)}
        onSave={confirmSave}
      />

      {/* Neck Label creator — AI-generated woven care/brand tag, applied as the garment's third view */}
      <NeckLabelModal open={neckLabelOpen} onClose={() => setNeckLabelOpen(false)} onApply={applyNeckLabel} />

      {/* Unsaved-changes guard — shown when leaving the Studio with edits that weren't explicitly saved */}
      {pendingLeave && (
        <div className="ds-leave" role="dialog" aria-modal="true" aria-labelledby="ds-leave-title">
          <div className="ds-leave__scrim" onClick={() => setPendingLeave(null)} />
          <div className="ds-leave__card">
            <b id="ds-leave-title">Save before leaving?</b>
            <span>You have unsaved changes. Save this design to your collection, or leave without saving? (Your canvas autosaves, so it’ll still be here next time.)</span>
            <div className="ds-leave__actions">
              <button type="button" className="s-btn" onClick={() => setPendingLeave(null)}>Cancel</button>
              <button type="button" className="s-btn s-btn--ghost" onClick={leaveNow}>Leave without saving</button>
              <button type="button" className="s-btn s-btn--accent" onClick={saveAndLeave}>Save &amp; leave</button>
            </div>
          </div>
        </div>
      )}

      {/* Right-click context menu */}
      {ctxMenu && <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={ctxMenu.items} onClose={() => setCtxMenu(null)} />}

      {/* Command palette (⌘K) */}
      <CommandPalette open={paletteOpen} commands={paletteCommands} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}

function RailIcon({ name }: { name: string }) {
  const common = { width: 20, height: 20 }
  switch (name) {
    case 'AI':
      return <IcoSparkle {...common} />
    case 'Layers':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
          <path d="M12 3.5 20.5 8 12 12.5 3.5 8 12 3.5Z" />
          <path d="M4 12l8 4.5L20 12" />
          <path d="M4 16l8 4.5L20 16" />
        </svg>
      )
    case 'Garments':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
          <path d="M9 4.5 5 7l1.6 3.2 1.6-.9v9.2h7.6v-9.2l1.6.9L19 7l-4-2.5a3 3 0 0 1-6 0Z" />
        </svg>
      )
    case 'Graphics':
      return <IcoDesign {...common} />
    case 'Elements':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
          <rect x="3.5" y="3.5" width="7" height="7" rx="1.4" />
          <circle cx="17" cy="7" r="3.6" />
          <path d="M7 13.5 10.8 20.5H3.2Z" />
          <path d="M17 13.2 20.4 16.6 17 20 13.6 16.6Z" />
        </svg>
      )
    case 'Brand Kit':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
          <path d="M12 3.5 20 8v8l-8 4.5L4 16V8l8-4.5Z" />
          <circle cx="12" cy="12" r="2.6" />
        </svg>
      )
    case 'Assets':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
          <path d="M3.5 8.5V6.8c0-1 .8-1.8 1.8-1.8h4l2 2.4h7.4c1 0 1.8.8 1.8 1.8v8c0 1-.8 1.8-1.8 1.8H5.3c-1 0-1.8-.8-1.8-1.8V8.5Z" />
        </svg>
      )
    case 'Inspiration':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
          <path d="M12 3a6 6 0 0 1 4 10.5c-.7.7-1 1.2-1 2.5H9c0-1.3-.3-1.8-1-2.5A6 6 0 0 1 12 3ZM9.5 20h5M10 22h4" />
        </svg>
      )
    default:
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
          <rect x="4" y="4" width="16" height="16" rx="3" />
        </svg>
      )
  }
}
