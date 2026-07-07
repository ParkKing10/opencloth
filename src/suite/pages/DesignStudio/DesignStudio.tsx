import { useState } from 'react'
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
import { GARMENT_GLYPHS } from '../../components/ui/Garments'
import { StudioCanvas } from './StudioCanvas'
import './design-studio.css'

const RAIL = ['Catalog', 'Templates', 'Graphics', 'Fabrics', 'Colors', 'Trims', 'Text', 'Uploads', 'AI Tools']

const CATS = ['All', 'Tops', 'Bottoms', 'Outerwear', 'Accessories']

const GARMENTS = [
  { name: 'T-Shirt', kind: 'tee' },
  { name: 'Hoodie', kind: 'hoodie' },
  { name: 'Zip Hoodie', kind: 'hoodie' },
  { name: 'Sweatshirt', kind: 'hoodie' },
  { name: 'Tank Top', kind: 'tee' },
  { name: 'Longsleeve', kind: 'tee' },
  { name: 'Oversized Tee', kind: 'tee' },
  { name: 'Raglan Hoodie', kind: 'hoodie' },
  { name: 'Crop Hoodie', kind: 'hoodie' },
] as const

const LAYERS = [
  { name: 'Puff Print Front', type: 'Graphic' },
  { name: 'Back Print', type: 'Graphic' },
  { name: 'Hood', type: 'Material' },
  { name: 'Main Fabric', type: 'Material' },
  { name: 'Ribbing', type: 'Material' },
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
  const [rail, setRail] = useState('Catalog')
  const [cat, setCat] = useState('Tops')
  const [active, setActive] = useState('Hoodie')
  const [propTab, setPropTab] = useState<'Properties' | 'Materials' | 'Colors'>('Properties')
  const [hidden, setHidden] = useState<Record<string, boolean>>({})

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
          <button className="ds-icon" type="button" aria-label="Undo">
            <IcoArrowRight width="17" height="17" style={{ transform: 'scaleX(-1)' }} />
          </button>
          <button className="ds-icon" type="button" aria-label="Redo">
            <IcoArrowRight width="17" height="17" />
          </button>
          <span className="ds-sep" />
          <button className="s-btn s-btn--ghost" type="button">
            <IcoUpload width="16" height="16" /> Share
          </button>
          <button className="s-btn s-btn--accent" type="button">
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
              onClick={() => setRail(r)}
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
              <button className="ds-mini" type="button" aria-label="Expand">
                <IcoDots width="15" height="15" />
              </button>
            </div>

            <label className="ds-search">
              <IcoSearch width="15" height="15" />
              <input placeholder="Search for items…" />
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

            <div className="ds-garments">
              {GARMENTS.map((g) => {
                const Glyph = GARMENT_GLYPHS[g.kind]
                return (
                  <button
                    key={g.name}
                    type="button"
                    className={`ds-garment${active === g.name ? ' is-active' : ''}`}
                    onClick={() => setActive(g.name)}
                  >
                    <span className="ds-garment__thumb">
                      <Glyph width="40" height="40" />
                    </span>
                    <span className="ds-garment__name">{g.name}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Layers */}
          <div className="ds-layers">
            <div className="ds-panel-head ds-panel-head--tight">
              <h2>Layers</h2>
              <button className="ds-mini" type="button" aria-label="Options">
                <IcoDots width="15" height="15" />
              </button>
            </div>
            <div className="ds-layer-list">
              {LAYERS.map((l) => (
                <div className="ds-layer" key={l.name}>
                  <span className="ds-layer__thumb" />
                  <span className="ds-layer__text">
                    <b>{l.name}</b>
                    <small>{l.type}</small>
                  </span>
                  <button
                    className={`ds-layer__eye${hidden[l.name] ? ' is-off' : ''}`}
                    type="button"
                    aria-label="Toggle visibility"
                    onClick={() => setHidden((h) => ({ ...h, [l.name]: !h[l.name] }))}
                  >
                    <IcoEye width="15" height="15" />
                  </button>
                  <button className="ds-layer__more" type="button" aria-label="More">
                    <IcoDots width="14" height="14" />
                  </button>
                </div>
              ))}
            </div>
            <button className="ds-add-layer" type="button">
              <IcoPlus width="15" height="15" /> Add Layer
            </button>
          </div>
        </aside>

        {/* Canvas */}
        <StudioCanvas />

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
            <section className="ds-group">
              <div className="ds-group__head">
                <span>Item</span>
              </div>
              <div className="ds-item">
                <span className="ds-item__thumb">
                  <GARMENT_GLYPHS.hoodie width="26" height="26" />
                </span>
                <span className="ds-item__text">
                  <b>Hoodie</b>
                  <small>Oversized Fit</small>
                </span>
                <button className="ds-change" type="button">
                  Change
                </button>
              </div>
            </section>

            <Accordion title="Details" open>
              {DETAILS.map(([k, v]) => (
                <Field key={k} label={k} value={v} />
              ))}
              <Field label="Color" value="#2A2A2A" swatch="#2A2A2A" />
            </Accordion>

            <Accordion title="Design" open>
              {DESIGN.map(([k, v]) => (
                <Field key={k} label={k} value={v} />
              ))}
              <Field label="Color" value="#F2F2F2" swatch="#F2F2F2" />
            </Accordion>

            <Accordion title="Stitching" />
            <Accordion title="Labels" />
            <Accordion title="Packaging" />

            <section className="ds-ai">
              <div className="ds-ai__head">
                <IcoSparkle width="15" height="15" />
                <span>AI Assistant</span>
              </div>
              <p className="ds-ai__msg">
                Make it more vintage washed and add a small woven label on the hem.
              </p>
              <button className="s-btn s-btn--accent ds-ai__apply" type="button">
                <IcoSparkle width="15" height="15" /> Apply Suggestion
              </button>
            </section>
          </div>
        </aside>
      </div>
    </div>
  )
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

function Field({ label, value, swatch }: { label: string; value: string; swatch?: string }) {
  return (
    <div className="ds-field">
      <span className="ds-field__label">{label}</span>
      <button className="ds-field__value" type="button">
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
