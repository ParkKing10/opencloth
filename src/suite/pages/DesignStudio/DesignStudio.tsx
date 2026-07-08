import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  IcoDesign,
  IcoPattern,
  IcoTechPack,
  IcoFactory,
  IcoSearch,
  IcoPlus,
  IcoDots,
  IcoEye,
  IcoSparkle,
  IcoChevron,
  IcoUpload,
  IcoArrowRight,
} from '../../components/ui/Icons'
import { GARMENT_GLYPHS, type GarmentKind } from '../../components/ui/Garments'
import { useToast } from '../../components/ui/Toast'
import type { ProjectInput } from '../../export/project'
import { computeReadiness } from '../../export/readiness'
import { StudioCanvas } from './StudioCanvas'
import { CommandBar, type StudioMode } from './CommandBar'
import { AICompanion } from './AICompanion'
import {
  INITIAL_CONFIG,
  buildSuggestions,
  deriveReadiness,
  interpretCommand,
  type Proposal,
  type StudioAction,
  type StudioConfig,
  type StudioContext,
  type Suggestion,
} from './studioModel'
import './design-studio.css'

// The export system pulls in jsPDF + JSZip; load it as its own chunk on demand
// so the manufacturing-export weight never lands in the initial bundle.
const ExportMenu = lazy(() => import('../../export/ui/ExportMenu').then((m) => ({ default: m.ExportMenu })))

const RAIL = ['Catalog', 'Templates', 'Graphics', 'Fabrics', 'Colors', 'Trims', 'Text', 'Uploads', 'AI Tools']

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

type Layer = { id: string; name: string; type: string }

/** A single undoable snapshot of the editable canvas state. */
type Snapshot = {
  layers: Layer[]
  hidden: Record<string, boolean>
}

const INITIAL_LAYERS: Layer[] = [
  { id: 'l-puff', name: 'Puff Print Front', type: 'Graphic' },
  { id: 'l-back', name: 'Back Print', type: 'Graphic' },
  { id: 'l-hood', name: 'Hood', type: 'Material' },
  { id: 'l-main', name: 'Main Fabric', type: 'Material' },
  { id: 'l-rib', name: 'Ribbing', type: 'Material' },
]

const INITIAL_SNAPSHOT: Snapshot = { layers: INITIAL_LAYERS, hidden: {} }

/** Editable property fields, keyed by a stable id so edits target the right row. */
type PropField = { id: string; label: string; value: string; swatch?: boolean }

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
  const [rail, setRail] = useState('Catalog')
  const [cat, setCat] = useState<Cat>('All')
  const [query, setQuery] = useState('')
  const [activeName, setActiveName] = useState('Hoodie')
  const [propTab, setPropTab] = useState<'Properties' | 'Materials' | 'Colors'>('Properties')

  // Undo/redo history: `past` and `future` are real snapshot stacks, `present` is live.
  const [past, setPast] = useState<Snapshot[]>([])
  const [present, setPresent] = useState<Snapshot>(INITIAL_SNAPSHOT)
  const [future, setFuture] = useState<Snapshot[]>([])

  // Applied AI changes become a visible, persistent notes list on the design.
  const [appliedNotes, setAppliedNotes] = useState<string[]>([])

  // Editable property fields — clicking a field really changes its displayed value.
  const [fields, setFields] = useState<Record<string, PropField[]>>(INITIAL_FIELDS)
  const [showCatalogHint, setShowCatalogHint] = useState(false)

  // Beginner vs Pro presentation, and the manufacturing config that drives readiness.
  const [mode, setMode] = useState<StudioMode>('beginner')
  const [config, setConfig] = useState<StudioConfig>(INITIAL_CONFIG)
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({})

  const { layers, hidden } = present
  const canUndo = past.length > 0
  const canRedo = future.length > 0

  /** Commit a new snapshot, pushing the current one onto the undo stack. */
  const commit = useCallback((next: Snapshot) => {
    setPast((prev) => [...prev, present])
    setPresent(next)
    setFuture([])
  }, [present])

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
    if (name !== 'Catalog') toast(`${name} panel — coming to your workspace soon.`, 'info')
  }

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

  function removeLayer(layer: Layer) {
    const nextHidden = { ...hidden }
    delete nextHidden[layer.id]
    commit({ layers: layers.filter((l) => l.id !== layer.id), hidden: nextHidden })
    toast(`Removed “${layer.name}”.`)
  }

  function toggleLayer(layer: Layer) {
    commit({ layers, hidden: { ...hidden, [layer.id]: !hidden[layer.id] } })
  }

  function undo() {
    if (!canUndo) return
    const previous = past[past.length - 1]
    setPast((prev) => prev.slice(0, -1))
    setFuture((prev) => [present, ...prev])
    setPresent(previous)
    toast('Undid last change.')
  }

  function redo() {
    if (!canRedo) return
    const next = future[0]
    setFuture((prev) => prev.slice(1))
    setPast((prev) => [...prev, present])
    setPresent(next)
    toast('Redid change.')
  }

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
  const suggestions = useMemo(
    () => buildSuggestions(studioCtx).filter((s) => !dismissed[s.id]),
    [studioCtx, dismissed],
  )

  const applyAction = useCallback((action: StudioAction) => {
    if (action.kind === 'set-field') {
      setFields((prev) => ({
        ...prev,
        [action.group]: (prev[action.group] ?? []).map((f) =>
          f.id === action.fieldId ? { ...f, value: action.value } : f,
        ),
      }))
    } else if (action.kind === 'toggle-config') {
      setConfig((prev) => ({ ...prev, [action.key]: action.value }))
    } else if (action.kind === 'add-note') {
      setAppliedNotes((prev) => (prev.includes(action.note) ? prev : [...prev, action.note]))
    }
  }, [])

  const applyProposal = useCallback(
    (p: Proposal) => {
      p.actions.forEach(applyAction)
      toast(`Applied — ${p.title.toLowerCase()}.`, 'accent')
    },
    [applyAction, toast],
  )

  const applySuggestion = useCallback(
    (s: Suggestion) => {
      s.actions.forEach(applyAction)
      setDismissed((prev) => ({ ...prev, [s.id]: true }))
      toast('Applied AI suggestion.', 'accent')
    },
    [applyAction, toast],
  )

  const dismissSuggestion = useCallback((id: string) => setDismissed((prev) => ({ ...prev, [id]: true })), [])

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

  function changeGarment() {
    const idx = GARMENTS.findIndex((g) => g.name === activeGarment.name)
    const next = GARMENTS[(idx + 1) % GARMENTS.length]
    setRail('Catalog')
    setActiveName(next.name)
    toast(`Switched to ${next.name}.`, 'success')
  }

  function editField(group: string, field: PropField) {
    const next = window.prompt(`Edit ${field.label}`, field.value)
    if (next == null) return
    const trimmed = next.trim()
    if (!trimmed || trimmed === field.value) return
    setFields((prev) => ({
      ...prev,
      [group]: prev[group].map((f) => (f.id === field.id ? { ...f, value: trimmed } : f)),
    }))
    toast(`${field.label} set to ${trimmed}.`, 'success')
  }

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

        <div className="ds-top__tabs">
          <button className="ds-tab is-active" type="button">
            <IcoDesign width="15" height="15" /> Design
          </button>
          <button className="ds-tab" type="button" onClick={() => navigate('/suite/pattern')}>
            <IcoPattern width="15" height="15" /> Pattern
          </button>
          <button className="ds-tab" type="button" onClick={() => navigate('/suite/tech-packs')}>
            <IcoTechPack width="15" height="15" /> Tech Pack
          </button>
          <button className="ds-tab" type="button" onClick={() => navigate('/suite/manufacturers')}>
            <IcoFactory width="15" height="15" /> Manufacturer
          </button>
        </div>

        <div className="ds-top__right">
          <button
            className="ds-icon"
            type="button"
            aria-label="Undo"
            title={canUndo ? 'Undo' : 'Nothing to undo'}
            disabled={!canUndo}
            onClick={undo}
          >
            <IcoArrowRight width="17" height="17" style={{ transform: 'scaleX(-1)' }} />
          </button>
          <button
            className="ds-icon"
            type="button"
            aria-label="Redo"
            title={canRedo ? 'Redo' : 'Nothing to redo'}
            disabled={!canRedo}
            onClick={redo}
          >
            <IcoArrowRight width="17" height="17" />
          </button>
          <span className="ds-sep" />
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
      <div className="ds-body">
        {/* Icon rail */}
        <nav className="ds-rail" aria-label="Tools">
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

        {/* Catalog + layers panel */}
        <aside className="ds-left">
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

          {/* Layers */}
          <div className="ds-layers">
            <div className="ds-panel-head ds-panel-head--tight">
              <h2>Layers</h2>
              <button
                className="ds-mini"
                type="button"
                aria-label="Add layer"
                title="Add a new layer"
                onClick={addLayer}
              >
                <IcoPlus width="15" height="15" />
              </button>
            </div>
            <div className="ds-layer-list">
              {layers.map((l) => (
                <div className="ds-layer" key={l.id}>
                  <span className="ds-layer__thumb" />
                  <span className="ds-layer__text">
                    <b>{l.name}</b>
                    <small>{l.type}</small>
                  </span>
                  <button
                    className={`ds-layer__eye${hidden[l.id] ? ' is-off' : ''}`}
                    type="button"
                    aria-label={hidden[l.id] ? 'Show layer' : 'Hide layer'}
                    title={hidden[l.id] ? 'Show layer' : 'Hide layer'}
                    onClick={() => toggleLayer(l)}
                  >
                    <IcoEye width="15" height="15" />
                  </button>
                  <button
                    className="ds-layer__more"
                    type="button"
                    aria-label="Remove layer"
                    title="Remove layer"
                    onClick={() => removeLayer(l)}
                  >
                    <IcoDots width="14" height="14" />
                  </button>
                </div>
              ))}
            </div>
            <button className="ds-add-layer" type="button" onClick={addLayer}>
              <IcoPlus width="15" height="15" /> Add Layer
            </button>
          </div>
        </aside>

        {/* Canvas */}
        <StudioCanvas garmentName={activeGarment.name} garmentKind={activeGarment.kind} garmentFit={activeGarment.fit} />

        {/* Properties */}
        <aside className="ds-right">
          <div className="ds-proptabs">
            {(['Properties', 'Materials', 'Colors'] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={`ds-proptab${propTab === t ? ' is-active' : ''}`}
                onClick={() => setPropTab(t)}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="ds-right__scroll">
            {propTab === 'Properties' && (
              <>
                <section className="ds-group">
                  <div className="ds-group__head">
                    <span>Item</span>
                  </div>
                  <div className="ds-item">
                    <span className="ds-item__thumb">
                      <ActiveGlyph kind={activeGarment.kind} />
                    </span>
                    <span className="ds-item__text">
                      <b>{activeGarment.name}</b>
                      <small>{activeGarment.fit}</small>
                    </span>
                    <button
                      className="ds-change"
                      type="button"
                      title="Switch to the next blank in the catalog"
                      onClick={changeGarment}
                    >
                      Change
                    </button>
                  </div>
                </section>

                <Accordion title="Appearance" open>
                  {fields.details.map((f) => (
                    <Field key={f.id} field={f} onEdit={() => editField('details', f)} />
                  ))}
                  <Advanced open={mode === 'pro'}>
                    {fields.detailsAdvanced.map((f) => (
                      <Field key={f.id} field={f} onEdit={() => editField('detailsAdvanced', f)} />
                    ))}
                  </Advanced>
                </Accordion>

                <Accordion title="Design" open>
                  {fields.design.map((f) => (
                    <Field key={f.id} field={f} onEdit={() => editField('design', f)} />
                  ))}
                </Accordion>

                <Accordion title="Brand" open={mode === 'pro'}>
                  <ConfigToggle
                    label="Neck Label Artwork"
                    on={config.neckLabel}
                    onToggle={(v) => setConfig((c) => ({ ...c, neckLabel: v }))}
                  />
                  <ConfigToggle
                    label="Care Label"
                    on={config.careLabel}
                    onToggle={(v) => setConfig((c) => ({ ...c, careLabel: v }))}
                  />
                </Accordion>

                <Accordion title="Construction" open={mode === 'pro'}>
                  <ConfigToggle
                    label="Construction confirmed"
                    on={config.construction}
                    onToggle={(v) => setConfig((c) => ({ ...c, construction: v }))}
                  />
                </Accordion>

                <Accordion title="Manufacturing" open={mode === 'pro'}>
                  <ConfigToggle
                    label="Tolerance Table"
                    on={config.tolerance}
                    onToggle={(v) => setConfig((c) => ({ ...c, tolerance: v }))}
                  />
                  <ConfigToggle
                    label="Production Notes"
                    on={config.productionNotes}
                    onToggle={(v) => setConfig((c) => ({ ...c, productionNotes: v }))}
                  />
                  <ConfigToggle
                    label="Packaging"
                    on={config.packaging}
                    onToggle={(v) => setConfig((c) => ({ ...c, packaging: v }))}
                  />
                </Accordion>
              </>
            )}

            {propTab === 'Materials' && (
              <Accordion title="Materials" open>
                {fields.materials.map((f) => (
                  <Field key={f.id} field={f} onEdit={() => editField('materials', f)} />
                ))}
              </Accordion>
            )}

            {propTab === 'Colors' && (
              <Accordion title="Palette" open>
                {fields.colors.map((f) => (
                  <Field key={f.id} field={f} onEdit={() => editField('colors', f)} />
                ))}
              </Accordion>
            )}

            <AICompanion
              suggestions={suggestions}
              appliedNotes={appliedNotes}
              onApply={applySuggestion}
              onDismiss={dismissSuggestion}
            />
          </div>
        </aside>
      </div>
    </div>
  )
}

function ActiveGlyph({ kind }: { kind: GarmentKind }) {
  const Glyph = GARMENT_GLYPHS[kind]
  return <Glyph width="26" height="26" />
}

function RailIcon({ name }: { name: string }) {
  const common = { width: 20, height: 20 }
  switch (name) {
    case 'Graphics':
      return <IcoDesign {...common} />
    case 'AI Tools':
      return <IcoSparkle {...common} />
    case 'Uploads':
      return <IcoUpload {...common} />
    case 'Text':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <path d="M6 6h12M12 6v12M9 18h6" />
        </svg>
      )
    case 'Colors':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="9" cy="9.5" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="15" cy="9.5" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="10" cy="14.5" r="1.2" fill="currentColor" stroke="none" />
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

function Field({ field, onEdit }: { field: PropField; onEdit: () => void }) {
  return (
    <div className="ds-field">
      <span className="ds-field__label">{field.label}</span>
      <button className="ds-field__value" type="button" onClick={onEdit} title={`Edit ${field.label}`}>
        {field.swatch && <span className="ds-field__swatch" style={{ background: field.value }} />}
        <span>{field.value}</span>
        <IcoChevron width="14" height="14" />
      </button>
    </div>
  )
}

function Accordion({ title, open, children }: { title: string; open?: boolean; children?: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(!!open)
  // Re-sync when the mode toggle flips the `open` prop.
  useEffect(() => setIsOpen(!!open), [open])
  return (
    <section className="ds-group">
      <button className="ds-group__head ds-group__head--btn" type="button" onClick={() => setIsOpen((o) => !o)}>
        <span>{title}</span>
        <IcoChevron width="15" height="15" style={{ transform: isOpen ? 'none' : 'rotate(-90deg)' }} />
      </button>
      {isOpen && children && <div className="ds-fields">{children}</div>}
    </section>
  )
}

/** Progressive disclosure: a "▸ Advanced" reveal for professional controls. */
function Advanced({ open, children }: { open?: boolean; children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(!!open)
  useEffect(() => setIsOpen(!!open), [open])
  return (
    <div className="ds-adv">
      <button
        type="button"
        className={`ds-adv__toggle${isOpen ? ' is-open' : ''}`}
        onClick={() => setIsOpen((o) => !o)}
        aria-expanded={isOpen}
      >
        <IcoChevron width="13" height="13" style={{ transform: isOpen ? 'none' : 'rotate(-90deg)' }} />
        Advanced
      </button>
      {isOpen && <div className="ds-adv__body">{children}</div>}
    </div>
  )
}

/** A labelled on/off switch that drives a manufacturing-config flag. */
function ConfigToggle({ label, on, onToggle }: { label: string; on: boolean; onToggle: (v: boolean) => void }) {
  return (
    <div className="ds-toggle">
      <span className="ds-toggle__label">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        className={`ds-switch${on ? ' is-on' : ''}`}
        onClick={() => onToggle(!on)}
      >
        <span className="ds-switch__knob" />
      </button>
    </div>
  )
}
