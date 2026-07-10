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
} from '../../components/ui/Icons'
import { GARMENT_GLYPHS, type GarmentKind } from '../../components/ui/Garments'
import { useGarments } from '../../garments/useGarments'
import { loadGarmentDisplay, getGarment } from '../../garments/garmentClient'
import { isBuiltinGarmentId, builtinTemplateId } from '../../garments/builtinGarments'
import { buildFromTemplate } from '../../garment-model/garmentFactory'
import { createGarment } from '../../garment-model/garmentLibrary'
import { categoryLabel, EMPTY_VIEWS, type Garment as LibGarment, type GarmentCategoryId, type GarmentRepresentation, type GarmentViews } from '../../garments/types'
import { useToast } from '../../components/ui/Toast'
import { useSuiteTheme } from '../../theme'
import { useStore } from '../../data/store'
import { useAuth } from '../../auth/auth'
import { uid } from '../../data/utils'
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
  makeTextLayer,
  patchObject,
  type CanvasObject,
} from './objectModel'
import { type PropField } from './GarmentInspector'
import { GarmentInfoPanel } from './GarmentInfoPanel'
import { NewDesignWizard, type WizardResult } from './NewDesignWizard'
import { SaveDesignDialog, type SaveChoice } from './SaveDesignDialog'
import { loadDoc, saveDoc, loadLastGarment, saveLastGarment, type ProductSpecs, type ProjectInfo } from './designDoc'
// M9 bridge: open the Design Studio scoped to a garment coming from the Garments workspace.
import { loadHistory } from '../../garment-model/garmentDocumentStore'
import { currentGarment } from '../../garment-model/garmentRevision'
import { garmentThumbnailSvg } from '../../garment-model/garmentThumbnail'
import { flattenRegions } from '../../garment-model/regionTree'
import { COLOR_SWATCHES } from '../../garment-model/garmentColors'
import type { EditableGarment } from '../../garment-model/editableGarment'
import { ProductSpecsEditor } from './ProductSpecsEditor'
import { GraphicsPanel } from './GraphicsPanel'
import { MaterialsPanel } from './MaterialsPanel'
import { InspirationPanel } from './InspirationPanel'
import {
  INITIAL_CONFIG,
  deriveReadiness,
  interpretCommand,
  objectNote,
  type ObjectNote,
  type Proposal,
  type StudioAction,
  type StudioConfig,
  type StudioContext,
} from './studioModel'
import './design-studio.css'

// The export system pulls in jsPDF + JSZip; load it as its own chunk on demand
// so the manufacturing-export weight never lands in the initial bundle.
const ExportMenu = lazy(() => import('../../export/ui/ExportMenu').then((m) => ({ default: m.ExportMenu })))

/** The Library — six human categories, every one opens a real panel. */
const RAIL = ['Garments', 'Graphics', 'Materials', 'Brand Kit', 'Assets', 'Inspiration']

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
  /** Garment-region overrides (hide a sleeve, recolour the body) — undoable + saved with the design. */
  regionHidden?: Record<string, boolean>
  regionFills?: Record<string, string>
}

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
  const [rail, setRail] = useState('Garments')

  // A Design belongs to a garment blank: its id is derived from the active garment
  // (see `designId` below, after the catalog resolves), so one stable design per garment.
  const [designName, setDesignName] = useState('Hoodie')
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'unsaved'>('unsaved')
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

  // New-design wizard: guide the first steps instead of an empty editor.
  const [wizardOpen, setWizardOpen] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('threados-studio-configured') !== '1'
    } catch {
      return true
    }
  })

  // Workspace layout: resizable Layers panel + collapsible inspector (both persisted).
  const [layersH, setLayersH] = useState<number | null>(() => {
    try {
      const raw = localStorage.getItem('threados-layers-h')
      return raw ? Math.max(150, parseInt(raw, 10) || 0) : null
    } catch {
      return null
    }
  })
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
  // Layers start minimized — the canvas is the star; one click opens the stack.
  const [layersCollapsed, setLayersCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('threados-layers-open') !== '1'
    } catch {
      return true
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

  const toggleLayersCollapsed = useCallback(() => {
    setLayersCollapsed((v) => {
      try {
        localStorage.setItem('threados-layers-open', v ? '1' : '0')
      } catch {
        /* ignore */
      }
      return !v
    })
  }, [])

  /**
   * Drag the divider above the Layers panel to resize it. Stateless math: the
   * panel height is simply the distance from the pointer to the aside's bottom,
   * so the divider tracks the cursor exactly.
   */
  const startLayersResize = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const aside = e.currentTarget.closest('.ds-left')
    if (!aside) return
    const compute = (clientY: number) => {
      const rect = aside.getBoundingClientRect()
      const maxH = Math.max(220, rect.height - 220)
      return Math.min(maxH, Math.max(150, Math.round(rect.bottom - clientY - 5)))
    }
    let last = compute(e.clientY)
    const onMove = (ev: PointerEvent) => {
      last = compute(ev.clientY)
      setLayersH(last)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      try {
        localStorage.setItem('threados-layers-h', String(last))
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
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

  // Editable property fields — clicking a field really changes its displayed value.
  const [fields, setFields] = useState<Record<string, PropField[]>>(INITIAL_FIELDS)
  const [showCatalogHint, setShowCatalogHint] = useState(false)

  // Beginner vs Pro presentation, and the manufacturing config that drives readiness.
  const [mode, setMode] = useState<StudioMode>('beginner')
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
    const gid = loadedGarmentRef.current
    if (!gid) return
    saveDoc(gid, {
      layers: snap.layers,
      hidden: snap.hidden,
      regionHidden: snap.regionHidden,
      regionFills: snap.regionFills,
      designName: name ?? designNameRef.current,
      collectionId: col ?? collectionIdRef.current,
      specs: specsRef.current,
      projectInfo: projectInfoRef.current,
      updatedAt: Date.now(),
    })
  }, [])

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
      const merged: Snapshot = { regionHidden: present.regionHidden, regionFills: present.regionFills, ...next }
      setPast((prev) => [...prev, present])
      setPresent(merged)
      setFuture([])
      saveCurrentDoc(merged)
    },
    [present, saveCurrentDoc],
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

  // The Garment Library is the single source of truth — the catalog loads real garments.
  const { garments: library, loading: libraryLoading } = useGarments()
  const catalog = useMemo(() => library.map(libToStudio), [library])

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
    const built = buildFromTemplate(editableTemplateId)
    const summary = createGarment(user.id, { ...built.garment, name: built.name }, { name: built.name, category: built.category, origin: 'blank' })
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
    if (Object.keys(rh).length === 0 && Object.keys(rf).length === 0) return studioGarment
    const regions = Object.fromEntries(
      Object.entries(studioGarment.regions).map(([id, r]) => {
        const visible = rh[id] !== undefined ? !rh[id] : r.visible
        const fill = rf[id]
        return [id, { ...r, visible, appearance: fill ? { ...r.appearance, fill } : r.appearance }]
      }),
    )
    return { ...studioGarment, regions }
  }, [studioGarment, present.regionHidden, present.regionFills])

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
      displayGarment
        ? flattenRegions(displayGarment).map(({ region, depth }) => ({
            id: region.id,
            name: region.name,
            type: region.type,
            depth,
            visible: region.visible,
            color: region.appearance?.fill,
          }))
        : [],
    [displayGarment],
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

  // Restore the last-opened garment once the catalog is available (reload reopens the design).
  const restoredRef = useRef(false)
  useEffect(() => {
    if (restoredRef.current || catalog.length === 0) return
    restoredRef.current = true
    const lastId = loadLastGarment()
    const last = lastId ? catalog.find((g) => g.id === lastId) : null
    if (last) setActiveName(last.name)
  }, [catalog])

  // M9/8.2 unified workflow: opened from a garment (?garment=<id>&name=<name>) → make THAT editable
  // garment the active garment (its flat as the backdrop, design keyed to its id), skip the picker.
  const bridgedRef = useRef(false)
  useEffect(() => {
    if (bridgedRef.current) return
    const gid = searchParams.get('garment')
    const gname = searchParams.get('name')
    if (!gid) return
    bridgedRef.current = true
    restoredRef.current = true // the injected garment wins over last-opened restore
    try {
      sessionStorage.setItem('threados-studio-configured', '1')
    } catch {
      /* ignore */
    }
    setWizardOpen(false)
    const h = loadHistory(gid)
    if (!h) return
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
  }, [searchParams])

  // Open a garment → load its saved document (or start empty). Resets undo history so each
  // garment is its own editing session; never carries one garment's layers onto another.
  // Saving is done explicitly at edit sinks (see saveCurrentDoc), so a load never persists.
  useEffect(() => {
    const gid = activeGarment.id
    if (!gid || loadedGarmentRef.current === gid) return
    loadedGarmentRef.current = gid
    const doc = loadDoc(gid)
    const snapshot: Snapshot = doc
      ? { layers: doc.layers, hidden: doc.hidden, regionHidden: doc.regionHidden, regionFills: doc.regionFills }
      : { layers: [], hidden: {} }
    const name = doc?.designName || activeGarment.name
    setPast([])
    setFuture([])
    setPresent(snapshot)
    presentRef.current = snapshot
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

  function selectGarment(g: Garment) {
    setActiveName(g.name)
    toast(`Loaded ${g.name} blank onto the canvas.`, 'success')
  }

  function addLayer() {
    const n = layers.filter((l) => l.type === 'Graphic').length + 1
    const layer: Layer = { id: `l-${Date.now().toString(36)}`, name: `New Graphic ${n}`, type: 'Graphic' }
    commit({ layers: [layer, ...layers], hidden })
    toast('Layer added — drop a graphic or type onto it.', 'success')
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

  /** Canvas selection: replace, or toggle (Shift+Click / additive). */
  const selectObj = useCallback((id: string | null, additive?: boolean) => {
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

  // ---- Keyboard shortcuts (skipped while typing) ----
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      const mod = e.metaKey || e.ctrlKey
      const k = e.key.toLowerCase()

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
      if ((e.key === 'Delete' || e.key === 'Backspace') && liveSelected.length > 0) {
        e.preventDefault()
        const removable = new Set(
          liveSelected.filter((id) => {
            const l = layers.find((x) => x.id === id)
            return l && !l.locked && !(l.groupId && layers.find((g) => g.id === l.groupId)?.locked)
          }),
        )
        // deleting a group takes its unlocked members with it
        layers.forEach((l) => {
          if (l.groupId && removable.has(l.groupId) && !l.locked) removable.add(l.id)
        })
        if (removable.size === 0) return
        const nextHidden = { ...hidden }
        removable.forEach((id) => delete nextHidden[id])
        commit({ layers: layers.filter((l) => !removable.has(l.id)), hidden: nextHidden })
        setSelectedIds([])
        toast(`Removed ${removable.size} ${removable.size === 1 ? 'layer' : 'layers'}.`)
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
  ])

  // The design's identity, handed to the Manufacturing Export System.
  // Real export project — assembled from the live design (layers + specs + project info) + the
  // real garment. Project-info fields the user entered in the wizard win over derived defaults.
  const exportProject: RealExportProject = useMemo(
    () => ({
      brand: projectInfo.brand?.trim() || activeGarment.brand || 'THREADOS',
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
      toast('Link copied — anyone with it can view this design.', 'success')
    } catch {
      toast('Could not copy the link. Copy it from the address bar.', 'info')
    }
  }

  // ---- Smart studio: live readiness, AI command bar & companion ----
  const frontArt = layers.some((l) => /front/i.test(l.name) && !hidden[l.id])
  const backArt = layers.some((l) => /back/i.test(l.name) && !hidden[l.id])

  const studioCtx = useMemo<StudioContext>(
    () => ({
      garment: { name: activeGarment.name, kind: activeGarment.kind, fit: activeGarment.fit },
      config,
      fields,
      frontArt,
      backArt,
    }),
    [activeGarment, config, fields, frontArt, backArt],
  )

  const readinessInput = useMemo(() => deriveReadiness(studioCtx), [studioCtx])
  const readiness = useMemo(() => computeReadiness(readinessInput), [readinessInput])

  // Collections the current user can save into (for the Save dialog).
  const myCollections = useMemo(
    () => data.collections.filter((c) => c.ownerId === user?.id),
    [data.collections, user?.id],
  )

  // ---- Save + auto-save: the design lands in Recent Designs, always current ----
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
      if (notify) {
        const col = colId ? data.collections.find((c) => c.id === colId)?.name : undefined
        toast(col ? `“${name}” saved to ${col}.` : `“${name}” saved.`, 'success')
      }
    },
    [user, designId, activeGarment.kind, readiness.score, mutate, toast, data.collections],
  )

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
      window.setTimeout(() => setSaveState('saved'), 350)
      const colName = choice.newCollection ?? (choice.collectionId ? myCollections.find((c) => c.id === choice.collectionId)?.name : undefined)
      toast(colName ? `“${choice.name}” saved to ${colName}.` : `“${choice.name}” saved.`, 'success')
      setSaveOpen(false)
    },
    [user, designId, activeGarment.kind, readiness.score, mutate, toast, myCollections, saveCurrentDoc],
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

  const applyProposal = useCallback(
    (p: Proposal) => {
      p.actions.forEach(applyAction)
      toast(`Applied — ${p.title.toLowerCase()}.`, 'accent')
    },
    [applyAction, toast],
  )

  const interpret = useCallback((text: string) => interpretCommand(text, studioCtx), [studioCtx])

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
          <button className="ds-logo" type="button" onClick={() => navigate('/suite')}>
            <span className="ds-logo__mark">
              <svg viewBox="0 0 32 32" width="17" height="17">
                <path d="M5 6h22v5h-8v15h-6V11H5V6Z" fill="currentColor" />
              </svg>
            </span>
            THREADOS
            <span className="ds-logo__beta">Beta</span>
          </button>
        </div>

        <div className="ds-top__right">
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

      {/* ---- AI command bar (mode toggle + live readiness) ---- */}
      <CommandBar
        mode={mode}
        onModeChange={setMode}
        readiness={readiness}
        interpret={interpret}
        onApply={applyProposal}
        onFix={fixCheck}
      />

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
          {rail === 'Materials' && (
            <MaterialsPanel
              onApply={(m) => {
                setField('details', 'd-fabric', m.fabric)
                setField('details', 'd-weight', m.weight)
                setField('detailsAdvanced', 'da-composition', m.composition)
                toast(`${m.fabric} applied — specs updated everywhere.`, 'success')
              }}
            />
          )}
          {rail === 'Garments' && (
            <>
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

          {/* Drag to resize the Layers panel (hidden while minimized) */}
          {!layersCollapsed && (
            <div
              className="ds-resize"
              role="separator"
              aria-label="Resize layers panel"
              title="Drag to resize"
              onPointerDown={startLayersResize}
              onDoubleClick={() => {
                setLayersH(null)
                try {
                  localStorage.removeItem('threados-layers-h')
                } catch {
                  /* ignore */
                }
              }}
            >
              <span className="ds-resize__grip" />
            </div>
          )}

          {/* Layers — Figma-grade: multi-select, rename, lock, groups, reorder */}
          <div
            className={`ds-layers-slot${layersCollapsed ? ' is-collapsed' : ''}`}
            style={!layersCollapsed && layersH ? { height: layersH, flex: '0 0 auto' } : undefined}
          >
            <LayersPanel
              layers={layers}
              hidden={hidden}
              selectedIds={liveSelected}
              onCommit={commitLayers}
              onSelect={setSelectedIds}
              onAddLayer={() => {
                if (layersCollapsed) toggleLayersCollapsed()
                addLayer()
              }}
              collapsed={layersCollapsed}
              onToggleCollapse={toggleLayersCollapsed}
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
            />
          </div>
            </>
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
            garmentSvg={studioBackdropSvg ?? (bridgeGarment ? bridgeSvg : garmentSvg)}
            garmentSvgByView={studioBackdropByView}
            designName={designName}
            onRenameDesign={(n) => {
              setDesignName(n)
              saveCurrentDoc(presentRef.current, n)
            }}
            saveState={saveState}
            objects={objectLayers}
            hiddenMap={hidden}
            selectedObjIds={selectedObjIds}
            onSelectObj={selectObj}
            onLiveObj={liveObject}
            onCommitObj={commitObject}
            onEditText={editObjectText}
            onAddText={addTextObject}
            onAddImage={addImageObject}
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
          ) : (
            <div className="ds-right__scroll">
              <GarmentInfoPanel
                name={activeGarment.name}
                brand={activeGarment.brand}
                category={activeGarment.category}
                views={activeGarment.views}
                representations={garmentReps}
                onEditRegions={editableTemplateId && user?.id ? openInGarmentEditor : undefined}
              />
              <ProductSpecsEditor specs={specs} onSpec={patchSpec} />
            </div>
          )}
        </aside>
        )}
      </div>

      {/* New-design wizard — nobody ever starts on an empty editor */}
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
    </div>
  )
}

function RailIcon({ name }: { name: string }) {
  const common = { width: 20, height: 20 }
  switch (name) {
    case 'Garments':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
          <path d="M9 4.5 5 7l1.6 3.2 1.6-.9v9.2h7.6v-9.2l1.6.9L19 7l-4-2.5a3 3 0 0 1-6 0Z" />
        </svg>
      )
    case 'Graphics':
      return <IcoDesign {...common} />
    case 'Materials':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <path d="M4 7c2.7-2 5.3-2 8 0s5.3 2 8 0M4 12c2.7-2 5.3-2 8 0s5.3 2 8 0M4 17c2.7-2 5.3-2 8 0s5.3 2 8 0" />
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
