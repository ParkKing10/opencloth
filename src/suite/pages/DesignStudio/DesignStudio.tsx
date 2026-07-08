import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { useToast } from '../../components/ui/Toast'
import { useSuiteTheme } from '../../theme'
import { useStore } from '../../data/store'
import { useAuth } from '../../auth/auth'
import { uid } from '../../data/utils'
import type { ProjectInput } from '../../export/project'
import { computeReadiness } from '../../export/readiness'
import { DrivePanel } from '../../drive/ui/DrivePanel'
import { BrandKitPanel } from '../../drive/ui/BrandKitPanel'
import type { DriveAsset } from '../../drive/driveClient'
import { loadBrandKit, recordChoice, saveBrandKit, type BrandKit } from '../../drive/brandKit'
import { StudioCanvas } from './StudioCanvas'
import { CommandBar, type StudioMode } from './CommandBar'
import { LayersPanel, type Layer } from './LayersPanel'
import { ContextPanel, defaultFieldsFor, type ContextField } from './ContextPanel'
import { ObjectInspector } from './ObjectInspector'
import {
  makeGraphicLayer,
  makeImageLayer,
  makeTextLayer,
  patchObject,
  type CanvasObject,
} from './objectModel'
import { GarmentInspector, type PropField } from './GarmentInspector'
import { NewDesignWizard, type WizardResult } from './NewDesignWizard'
import { GraphicsPanel } from './GraphicsPanel'
import { MaterialsPanel } from './MaterialsPanel'
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

/** The Library — five human categories, every one opens a real panel. */
const RAIL = ['Garments', 'Graphics', 'Materials', 'Brand', 'Assets']

type Cat = 'All' | 'Tops' | 'Bottoms' | 'Outerwear' | 'Accessories'
const CATS: Cat[] = ['All', 'Tops', 'Bottoms', 'Outerwear', 'Accessories']

/** A studio garment blank — the base the creator designs on. */
type Garment = {
  name: string
  kind: GarmentKind
  cat: Cat
  fit: string
}

const GARMENTS: Garment[] = [
  { name: 'T-Shirt', kind: 'tee', cat: 'Tops', fit: 'Regular Fit' },
  { name: 'Hoodie', kind: 'hoodie', cat: 'Tops', fit: 'Oversized Fit' },
  { name: 'Zip Hoodie', kind: 'hoodie', cat: 'Tops', fit: 'Relaxed Fit' },
  { name: 'Sweatshirt', kind: 'hoodie', cat: 'Tops', fit: 'Boxy Fit' },
  { name: 'Tank Top', kind: 'tee', cat: 'Tops', fit: 'Slim Fit' },
  { name: 'Longsleeve', kind: 'tee', cat: 'Tops', fit: 'Regular Fit' },
  { name: 'Oversized Tee', kind: 'tee', cat: 'Tops', fit: 'Oversized Fit' },
  { name: 'Bomber Jacket', kind: 'jacket', cat: 'Outerwear', fit: 'Regular Fit' },
  { name: 'Cargo Jacket', kind: 'jacket', cat: 'Outerwear', fit: 'Relaxed Fit' },
  { name: 'Cargo Pants', kind: 'pants', cat: 'Bottoms', fit: 'Baggy Fit' },
  { name: 'Wide Trousers', kind: 'pants', cat: 'Bottoms', fit: 'Wide Fit' },
  { name: 'Dad Cap', kind: 'cap', cat: 'Accessories', fit: 'Adjustable' },
]

// Layer model lives with the panel (Figma-grade: lock, color labels, groups).

/** A single undoable snapshot of the editable canvas state. */
type Snapshot = {
  layers: Layer[]
  hidden: Record<string, boolean>
}

const INITIAL_LAYERS: Layer[] = [
  {
    id: 'l-puff',
    name: 'VISIONARY',
    type: 'Text',
    obj: { type: 'text', x: 0.5, y: 0.4, width: 0.82, rotation: 0, opacity: 1, text: 'VISIONARY', color: '#C9C9D2', font: 'Archivo', weight: 800, letterSpacing: 3 },
  },
  { id: 'l-back', name: 'Back Print', type: 'Graphic' },
  { id: 'l-hood', name: 'Hood', type: 'Material' },
  { id: 'l-main', name: 'Main Fabric', type: 'Material' },
  { id: 'l-rib', name: 'Ribbing', type: 'Material' },
]

const INITIAL_SNAPSHOT: Snapshot = { layers: INITIAL_LAYERS, hidden: {} }

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

  // The design being edited — one stable id per piece so auto-save upserts it.
  const [designId, setDesignId] = useState<string>(() => {
    try {
      return sessionStorage.getItem('threados-current-design') || uid('d')
    } catch {
      return uid('d')
    }
  })
  const [designName, setDesignName] = useState('Hoodie')
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'unsaved'>('unsaved')

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
      return localStorage.getItem('threados-right-hidden') === '1'
    } catch {
      return false
    }
  })
  const [leftHidden, setLeftHidden] = useState<boolean>(() => {
    try {
      return localStorage.getItem('threados-left-hidden') === '1'
    } catch {
      return false
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
        localStorage.setItem('threados-right-hidden', v ? '0' : '1')
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

  /** Commit a new snapshot, pushing the current one onto the undo stack. */
  const commit = useCallback((next: Snapshot) => {
    setPast((prev) => [...prev, present])
    setPresent(next)
    setFuture([])
  }, [present])

  // Live mirror so object drags read the freshest state without stale closures.
  const presentRef = useRef(present)
  useEffect(() => {
    presentRef.current = present
  }, [present])

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
    dragStartedRef.current = false
  }, [])

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

  const activeGarment = useMemo(
    () => GARMENTS.find((g) => g.name === activeName) ?? GARMENTS[1],
    [activeName],
  )

  const visibleGarments = useMemo(() => {
    const q = query.trim().toLowerCase()
    return GARMENTS.filter((g) => {
      if (cat !== 'All' && g.cat !== cat) return false
      if (!q) return true
      return g.name.toLowerCase().includes(q)
    })
  }, [cat, query])

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
      if (fieldId === 'cx-technique') rememberChoice('technique', value)
    },
    [activeLayer, rememberChoice],
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
        rememberChoice('weight', '450 GSM')
      }
      toast('Applied — the spec is updated.', 'accent')
    },
    [setContextField, rememberChoice, toast],
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
    toast('Undid last change.')
  }, [past, present, toast])

  const redo = useCallback(() => {
    if (future.length === 0) return
    const next = future[0]
    setFuture((prev) => prev.slice(1))
    setPast((prev) => [...prev, present])
    setPresent(next)
    toast('Redid change.')
  }, [future, present, toast])

  // ---- Keyboard shortcuts (skipped while typing) ----
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      const mod = e.metaKey || e.ctrlKey

      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
        return
      }
      if (mod && e.key.toLowerCase() === 'd' && liveSelected.length > 0) {
        e.preventDefault()
        const src = layers.find((l) => l.id === liveSelected[0])
        if (!src || src.type === 'Group') return
        const copy: Layer = { ...src, id: `l-${Date.now().toString(36)}`, name: `${src.name} copy`, locked: false }
        const at = layers.findIndex((l) => l.id === src.id)
        commit({ layers: [...layers.slice(0, at), copy, ...layers.slice(at)], hidden })
        setSelectedIds([copy.id])
        toast(`Duplicated “${src.name}”.`, 'success')
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
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [layers, hidden, liveSelected, commit, undo, redo, toast])

  // The design's identity, handed to the Manufacturing Export System.
  const exportInput: ProjectInput = useMemo(
    () => ({ styleName: activeGarment.name, kind: activeGarment.kind }),
    [activeGarment.name, activeGarment.kind],
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

  // ---- Save + auto-save: the design lands in Recent Designs, always current ----
  const saveDesign = useCallback(
    (manual: boolean) => {
      if (!user) {
        if (manual) toast('Sign in to save designs.', 'info')
        return
      }
      setSaveState('saving')
      const now = Date.now()
      mutate((d) => {
        const exists = d.designs.some((x) => x.id === designId)
        const next = {
          id: designId,
          ownerId: user.id,
          name: designName,
          kind: activeGarment.kind,
          status: 'draft' as const,
          progress: readiness.score,
          updatedAt: now,
        }
        return {
          ...d,
          designs: exists
            ? d.designs.map((x) => (x.id === designId ? { ...x, ...next } : x))
            : [next, ...d.designs],
        }
      })
      try {
        sessionStorage.setItem('threados-current-design', designId)
      } catch {
        /* ignore */
      }
      window.setTimeout(() => setSaveState('saved'), 350)
      if (manual) toast(`“${designName}” saved — you'll find it under Recent Designs.`, 'success')
    },
    [user, designId, designName, activeGarment.kind, readiness.score, mutate, toast],
  )

  // Auto-save: any real change persists after 2s of quiet.
  const firstChange = useRef(true)
  useEffect(() => {
    if (firstChange.current) {
      firstChange.current = false
      return
    }
    setSaveState('unsaved')
    const t = window.setTimeout(() => saveDesign(false), 2000)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields, config, present, activeName, designName])

  // A new blank gets the blank's name until the designer renames it.
  useEffect(() => {
    setDesignName(activeGarment.name)
  }, [activeGarment.name])

  const applyAction = useCallback(
    (action: StudioAction) => {
      if (action.kind === 'set-field') {
        setFields((prev) => ({
          ...prev,
          [action.group]: (prev[action.group] ?? []).map((f) =>
            f.id === action.fieldId ? { ...f, value: action.value } : f,
          ),
        }))
        const dim = MEMORY_DIMS[action.fieldId]
        if (dim) rememberChoice(dim, action.value)
      } else if (action.kind === 'toggle-config') {
        setConfig((prev) => ({ ...prev, [action.key]: action.value }))
        if (action.key === 'neckLabel' && action.value) rememberChoice('label', 'Woven neck label')
      } else if (action.kind === 'add-note') {
        // production notes land in the spec via memory; the toast confirms the apply
        if (/wash/i.test(action.note)) rememberChoice('wash', 'Vintage wash')
      }
    },
    [MEMORY_DIMS, rememberChoice],
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

  /** Set a garment property (picker-driven — no dialogs anywhere). */
  const setField = useCallback(
    (group: string, fieldId: string, value: string) => {
      setFields((prev) => ({
        ...prev,
        [group]: (prev[group] ?? []).map((f) => (f.id === fieldId ? { ...f, value } : f)),
      }))
      const dim = MEMORY_DIMS[fieldId]
      if (dim) rememberChoice(dim, value)
    },
    [MEMORY_DIMS, rememberChoice],
  )

  /** Switch the garment blank by name (from the object-first "Garment" picker). */
  const selectGarmentByName = useCallback(
    (name: string) => {
      const g = GARMENTS.find((x) => x.name === name)
      if (!g) return
      setActiveName(g.name)
      toast(`Switched to ${g.name}.`, 'success')
    },
    [toast],
  )

  /** The wizard hands over a configured design — no empty editor, ever. */
  const completeWizard = useCallback(
    (r: WizardResult) => {
      // a fresh piece gets its own identity for save/auto-save
      const freshId = uid('d')
      setDesignId(freshId)
      try {
        sessionStorage.setItem('threados-current-design', freshId)
      } catch {
        /* ignore */
      }
      setActiveName(GARMENTS.some((g) => g.name === r.garmentName) ? r.garmentName : 'Hoodie')
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
    [rememberChoice, toast],
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
      kitRef.current = k
      toast('Brand Kit defaults applied to this design.', 'accent')
    },
    [toast],
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
          <span className="ds-sep" />
          <button className="s-btn s-btn--ghost" type="button" title="Start a new design" onClick={() => setWizardOpen(true)}>
            New
          </button>
          <button
            className="s-btn s-btn--ghost"
            type="button"
            title="Save to your designs (auto-saves too)"
            onClick={() => saveDesign(true)}
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
            <ExportMenu input={exportInput} readiness={readinessInput} />
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
        </div>

        {/* Journey progress — the user always knows where they are */}
        <button
          className="ds-progress"
          type="button"
          title={readiness.missing.length > 0 ? `Next: ${readiness.missing[0].label}` : 'Ready for production'}
          onClick={() => readiness.missing.length > 0 && fixCheck(readiness.missing[0].id)}
        >
          <span className="ds-progress__label">Design</span>
          <span className="ds-progress__track">
            <span className="ds-progress__fill" style={{ width: `${readiness.score}%` }} />
          </span>
          <span className="ds-progress__pct">{readiness.score}%</span>
          <span className="ds-progress__next">
            {readiness.missing.length > 0 ? (
              <>
                Next · <b>{readiness.missing[0].label}</b>
              </>
            ) : (
              <b className="is-done">Ready ✓</b>
            )}
          </span>
        </button>

        <div className="ds-top__right">
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
      <div className={`ds-body${rightHidden ? ' ds-body--no-right' : ''}${leftHidden ? ' ds-body--no-left' : ''}`}>
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

        {/* Left panel — the Library category currently open */}
        {!leftHidden && (
        <aside className="ds-left">
          {rail === 'Assets' && <DrivePanel onAddToDesign={(a: DriveAsset) => addAssetLayer(a)} />}
          {rail === 'Brand' && <BrandKitPanel onApplyDefaults={applyBrandKit} />}
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

            {visibleGarments.length > 0 ? (
              <div className="ds-garments">
                {visibleGarments.map((g) => {
                  const Glyph = GARMENT_GLYPHS[g.kind]
                  return (
                    <button
                      key={g.name}
                      type="button"
                      className={`ds-garment${activeName === g.name ? ' is-active' : ''}`}
                      onClick={() => selectGarment(g)}
                      title={`${g.name} · ${g.fit}`}
                    >
                      <span className="ds-garment__thumb">
                        <Glyph width="40" height="40" />
                      </span>
                      <span className="ds-garment__name">{g.name}</span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="ds-empty">
                No blanks match “{query.trim()}”.
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
            if (t.includes('application/x-threados-asset') || t.includes('application/x-threados-graphic')) e.preventDefault()
          }}
          onDrop={(e) => {
            const asset = e.dataTransfer.getData('application/x-threados-asset')
            const graphic = e.dataTransfer.getData('application/x-threados-graphic')
            if (!asset && !graphic) return
            e.preventDefault()
            try {
              if (asset) addAssetLayer(JSON.parse(asset) as { name: string; folder: string; url?: string })
              else addGraphicObject(graphic)
            } catch {
              /* malformed payload — ignore */
            }
          }}
        >
          <StudioCanvas
            garmentName={activeGarment.name}
            garmentKind={activeGarment.kind}
            garmentFit={activeGarment.fit}
            showHints={liveSelected.length === 0}
            designName={designName}
            onRenameDesign={setDesignName}
            saveState={saveState}
            objects={objectLayers}
            hiddenMap={hidden}
            selectedObjId={activeLayer?.obj ? activeLayer.id : null}
            onSelectObj={(id) => setSelectedIds(id ? [id] : [])}
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
            <GarmentInspector
              mode={mode}
              garment={{ name: activeGarment.name, kind: activeGarment.kind, fit: activeGarment.fit }}
              fields={fields}
              config={config}
              onField={setField}
              onGarment={selectGarmentByName}
              onConfig={(key, value) => setConfig((c) => ({ ...c, [key]: value }))}
            />
          )}
        </aside>
        )}
      </div>

      {/* New-design wizard — nobody ever starts on an empty editor */}
      <NewDesignWizard open={wizardOpen} onComplete={completeWizard} onClose={skipWizard} />
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
    case 'Brand':
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
    default:
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
          <rect x="4" y="4" width="16" height="16" rx="3" />
        </svg>
      )
  }
}
