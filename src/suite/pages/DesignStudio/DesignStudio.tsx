import { useMemo, useState } from 'react'
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
import { StudioCanvas } from './StudioCanvas'
import './design-studio.css'

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

const INITIAL_LAYERS: Layer[] = [
  { id: 'l-puff', name: 'Puff Print Front', type: 'Graphic' },
  { id: 'l-back', name: 'Back Print', type: 'Graphic' },
  { id: 'l-hood', name: 'Hood', type: 'Material' },
  { id: 'l-main', name: 'Main Fabric', type: 'Material' },
  { id: 'l-rib', name: 'Ribbing', type: 'Material' },
]

const DETAILS: [string, string][] = [
  ['Size', 'M'],
  ['Fit', 'Oversized'],
  ['Length', 'Regular'],
  ['Fabric', 'French Terry 450 GSM'],
  ['Weight', '450 GSM'],
]

const DESIGN: [string, string][] = [
  ['Technique', 'Puff Print'],
  ['Placement', 'Front Center'],
  ['Size', '28 cm'],
]

export function DesignStudio() {
  const navigate = useNavigate()
  const toast = useToast()
  const [rail, setRail] = useState('Catalog')
  const [cat, setCat] = useState<Cat>('All')
  const [query, setQuery] = useState('')
  const [activeName, setActiveName] = useState('Hoodie')
  const [propTab, setPropTab] = useState<'Properties' | 'Materials' | 'Colors'>('Properties')
  const [hidden, setHidden] = useState<Record<string, boolean>>({})
  const [layers, setLayers] = useState<Layer[]>(INITIAL_LAYERS)

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
    setLayers((prev) => [layer, ...prev])
    toast('Layer added — drop a graphic or type onto it.', 'success')
  }

  function removeLayer(layer: Layer) {
    setLayers((prev) => prev.filter((l) => l.id !== layer.id))
    setHidden((h) => {
      const next = { ...h }
      delete next[layer.id]
      return next
    })
    toast(`Removed “${layer.name}”.`)
  }

  function applySuggestion() {
    toast('Applied AI suggestion — vintage wash + woven hem label.', 'accent')
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
          <button className="ds-icon" type="button" aria-label="Undo" title="Undo" onClick={() => toast('Nothing left to undo.')}>
            <IcoArrowRight width="17" height="17" style={{ transform: 'scaleX(-1)' }} />
          </button>
          <button className="ds-icon" type="button" aria-label="Redo" title="Redo" onClick={() => toast('Nothing to redo.')}>
            <IcoArrowRight width="17" height="17" />
          </button>
          <span className="ds-sep" />
          <button
            className="s-btn s-btn--ghost"
            type="button"
            onClick={() => toast('Share link copied — anyone with it can view this design.', 'info')}
          >
            <IcoUpload width="16" height="16" /> Share
          </button>
          <button
            className="s-btn s-btn--accent"
            type="button"
            onClick={() => toast(`Exporting “${activeGarment.name}” as a PDF tech pack…`, 'accent')}
          >
            <IcoUpload width="16" height="16" style={{ transform: 'rotate(180deg)' }} /> Export
          </button>
        </div>
      </header>

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
                className="ds-mini"
                type="button"
                aria-label="Catalog help"
                title="Pick a blank to start designing"
                onClick={() => toast('Pick a garment blank, then design it on the canvas.', 'info')}
              >
                <IcoDots width="15" height="15" />
              </button>
            </div>

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
                    onClick={() => setHidden((h) => ({ ...h, [l.id]: !h[l.id] }))}
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
        <StudioCanvas garmentName={activeGarment.name} garmentKind={activeGarment.kind} />

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
                      onClick={() => toast('Pick a different blank from the catalog on the left.', 'info')}
                    >
                      Change
                    </button>
                  </div>
                </section>

                <Accordion title="Details" open>
                  {DETAILS.map(([k, v]) => (
                    <Field key={k} label={k} value={v} onEdit={() => toast(`Editing ${k}…`)} />
                  ))}
                  <Field label="Color" value="#2A2A2A" swatch="#2A2A2A" onEdit={() => toast('Editing base colour…')} />
                </Accordion>

                <Accordion title="Design" open>
                  {DESIGN.map(([k, v]) => (
                    <Field key={k} label={k} value={v} onEdit={() => toast(`Editing ${k}…`)} />
                  ))}
                  <Field label="Color" value="#F2F2F2" swatch="#F2F2F2" onEdit={() => toast('Editing print colour…')} />
                </Accordion>

                <Accordion title="Stitching" />
                <Accordion title="Labels" />
                <Accordion title="Packaging" />
              </>
            )}

            {propTab === 'Materials' && (
              <Accordion title="Materials" open>
                {[
                  ['Body', 'French Terry 450 GSM'],
                  ['Ribbing', '2x2 Rib · Cotton'],
                  ['Lining', 'None'],
                  ['Thread', 'Tex 40 · Matte'],
                ].map(([k, v]) => (
                  <Field key={k} label={k} value={v} onEdit={() => toast(`Editing ${k} material…`)} />
                ))}
              </Accordion>
            )}

            {propTab === 'Colors' && (
              <Accordion title="Palette" open>
                {[
                  ['Base', '#2A2A2A'],
                  ['Print', '#F2F2F2'],
                  ['Rib', '#1E1E1E'],
                  ['Stitch', '#D1F94F'],
                ].map(([k, v]) => (
                  <Field key={k} label={k} value={v} swatch={v} onEdit={() => toast(`Editing ${k} colour…`)} />
                ))}
              </Accordion>
            )}

            <section className="ds-ai">
              <div className="ds-ai__head">
                <IcoSparkle width="15" height="15" />
                <span>AI Assistant</span>
              </div>
              <p className="ds-ai__msg">
                Make it more vintage washed and add a small woven label on the hem.
              </p>
              <button className="s-btn s-btn--accent ds-ai__apply" type="button" onClick={applySuggestion}>
                <IcoSparkle width="15" height="15" /> Apply Suggestion
              </button>
            </section>
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

function Field({ label, value, swatch, onEdit }: { label: string; value: string; swatch?: string; onEdit: () => void }) {
  return (
    <div className="ds-field">
      <span className="ds-field__label">{label}</span>
      <button className="ds-field__value" type="button" onClick={onEdit} title={`Edit ${label}`}>
        {swatch && <span className="ds-field__swatch" style={{ background: swatch }} />}
        <span>{value}</span>
        <IcoChevron width="14" height="14" />
      </button>
    </div>
  )
}

function Accordion({ title, open, children }: { title: string; open?: boolean; children?: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(!!open)
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
