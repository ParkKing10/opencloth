import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  IcoSparkle,
  IcoPlus,
  IcoCoins,
  IcoBolt,
  IcoTechPack,
  IcoUpload,
  IcoStar,
  IcoGrid,
  IcoDots,
  IcoArrowRight,
} from '../../components/ui/Icons'
import { GARMENT_GLYPHS, type GarmentKind } from '../../components/ui/Garments'
import './aid.css'

/* ---- Static option sets ---- */
const STYLES = ['Streetwear', 'Luxury', 'Vintage Wash', 'Sportswear', 'Minimal'] as const
type Style = (typeof STYLES)[number]

const TYPES: { key: GarmentKind; label: string }[] = [
  { key: 'hoodie', label: 'Hoodie' },
  { key: 'tee', label: 'Tee' },
  { key: 'jacket', label: 'Jacket' },
  { key: 'pants', label: 'Pants' },
  { key: 'cap', label: 'Cap' },
]

const ASPECTS = [
  { key: 'square', label: '1:1', glyph: 'sq' },
  { key: 'portrait', label: '3:4', glyph: 'port' },
  { key: 'landscape', label: '4:3', glyph: 'land' },
] as const
type Aspect = (typeof ASPECTS)[number]['key']

const REF_SLOTS = ['Fabric', 'Silhouette', 'Palette'] as const

/* ---- Rich per-card gradient tints (violet-forward, restrained) ---- */
const TINTS = [
  'radial-gradient(130% 120% at 30% 12%, rgba(124,92,255,0.30), transparent 58%), linear-gradient(160deg, #14121f, #0b0b10)',
  'radial-gradient(130% 120% at 70% 14%, rgba(155,123,255,0.26), transparent 60%), linear-gradient(160deg, #171320, #0b0b10)',
  'radial-gradient(120% 130% at 50% 0%, rgba(124,92,255,0.22), transparent 62%), linear-gradient(200deg, #100f19, #0a0a0f)',
  'radial-gradient(130% 120% at 20% 20%, rgba(124,92,255,0.24), rgba(255,107,166,0.06) 45%, transparent 66%), linear-gradient(150deg, #15121d, #0b0b10)',
]

type Variation = {
  seed: string
  name: string
  kind: GarmentKind
  style: Style
  isFav: boolean
}

const INITIAL_VARIATIONS: Variation[] = [
  { seed: '0x8F2A', name: 'Washed Boxy Hoodie', kind: 'hoodie', style: 'Vintage Wash', isFav: true },
  { seed: '0x1D77', name: 'Panelled Track Hoodie', kind: 'hoodie', style: 'Sportswear', isFav: false },
  { seed: '0xB4C0', name: 'Drop-Shoulder Heavyweight', kind: 'hoodie', style: 'Streetwear', isFav: false },
]

type HistoryItem = { prompt: string; kind: GarmentKind; style: Style; time: string; count: number }
const HISTORY: HistoryItem[] = [
  { prompt: 'Faded acid-wash hoodie, oversized fit, raw hem', kind: 'hoodie', style: 'Vintage Wash', time: '4m ago', count: 4 },
  { prompt: 'Minimal boxy tee, heavyweight cotton, tonal stitch', kind: 'tee', style: 'Minimal', time: '1h ago', count: 4 },
  { prompt: 'Cropped moto jacket, matte black hardware', kind: 'jacket', style: 'Luxury', time: '3h ago', count: 6 },
  { prompt: 'Baggy cargo pants, ripstop, utility pockets', kind: 'pants', style: 'Streetwear', time: 'Yesterday', count: 4 },
  { prompt: 'Structured 6-panel cap, embroidered crest', kind: 'cap', style: 'Sportswear', time: 'Yesterday', count: 4 },
]

const GEN_COST = 4
const PROMPT_MAX = 480

export function AIDesigner() {
  const navigate = useNavigate()

  const [prompt, setPrompt] = useState(
    'Oversized boxy hoodie, heavyweight fleece with a faded vintage wash, dropped shoulders, ribbed cuffs and a raw-cut hem. Muted concrete grey.',
  )
  const [style, setStyle] = useState<Style>('Vintage Wash')
  const [type, setType] = useState<GarmentKind>('hoodie')
  const [aspect, setAspect] = useState<Aspect>('portrait')
  const [refs, setRefs] = useState<boolean[]>([true, false, false])
  const [variations, setVariations] = useState<Variation[]>(INITIAL_VARIATIONS)

  const canGenerate = prompt.trim().length > 0
  const totalVariations = variations.length + 1 // + the generating card

  const genLabel = useMemo(() => {
    const label = TYPES.find((x) => x.key === type)?.label ?? 'garment'
    return `${style} ${label.toLowerCase()}`
  }, [style, type])

  const toggleRef = (index: number) =>
    setRefs((prev) => prev.map((value, i) => (i === index ? !value : value)))

  const toggleFav = (seed: string) =>
    setVariations((prev) => prev.map((v) => (v.seed === seed ? { ...v, isFav: !v.isFav } : v)))

  const RefGlyph = GARMENT_GLYPHS[type]

  return (
    <div className="aid-root">
      {/* ---- Header ---- */}
      <header className="aid-head">
        <div>
          <p className="aid-head__eyebrow">
            <IcoSparkle width="13" height="13" /> AI Studio
          </p>
          <h1 className="aid-head__title">AI Designer</h1>
          <p className="aid-head__sub">
            Describe the garment, drop references and let the studio render production-ready
            variations you can upscale or push straight into the Design Studio.
          </p>
        </div>
        <div className="aid-head__actions">
          <span className="aid-coins">
            <IcoCoins width="16" height="16" />
            <b>184</b>
            <small>coins</small>
          </span>
          <button className="s-btn s-btn--ghost" type="button">
            <IcoPlus width="15" height="15" /> New session
          </button>
        </div>
      </header>

      {/* ---- Studio ---- */}
      <div className="aid-studio">
        {/* ============ LEFT CONTROL PANEL ============ */}
        <aside className="aid-panel">
          {/* Prompt */}
          <div className="aid-field">
            <div className="aid-field__label">
              <span>Prompt</span>
              <span className="aid-field__hint">Be specific — fabric, fit, finish</span>
            </div>
            <div className="aid-prompt">
              <textarea
                value={prompt}
                maxLength={PROMPT_MAX}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the garment you want to create…"
                aria-label="Prompt"
              />
              <div className="aid-prompt__foot">
                <button className="aid-prompt__enhance" type="button">
                  <IcoBolt width="12" height="12" /> Enhance
                </button>
                <span className="aid-prompt__count">
                  {prompt.length}/{PROMPT_MAX}
                </span>
              </div>
            </div>
          </div>

          {/* Reference images */}
          <div className="aid-field">
            <div className="aid-field__label">
              <span>Reference images</span>
              <span className="aid-field__hint">Optional</span>
            </div>
            <div className="aid-refs">
              {REF_SLOTS.map((label, i) => {
                const isFilled = refs[i]
                return (
                  <button
                    key={label}
                    type="button"
                    className={`aid-ref${isFilled ? ' is-filled' : ''}`}
                    onClick={() => toggleRef(i)}
                    aria-label={`${isFilled ? 'Remove' : 'Add'} ${label} reference`}
                  >
                    {isFilled ? <RefGlyph width="26" height="26" /> : <IcoPlus width="16" height="16" />}
                    <span className="aid-ref__tag">{label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Brand style */}
          <div className="aid-field">
            <div className="aid-field__label">
              <span>Brand style</span>
            </div>
            <div className="aid-pills">
              {STYLES.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`aid-pill${style === s ? ' is-active' : ''}`}
                  onClick={() => setStyle(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Garment type */}
          <div className="aid-field">
            <div className="aid-field__label">
              <span>Garment type</span>
            </div>
            <div className="aid-seg" style={{ '--aid-cols': 5 } as CSSProperties}>
              {TYPES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className={`aid-seg__opt${type === t.key ? ' is-active' : ''}`}
                  onClick={() => setType(t.key)}
                  title={t.label}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Aspect */}
          <div className="aid-field">
            <div className="aid-field__label">
              <span>Aspect ratio</span>
            </div>
            <div className="aid-seg" style={{ '--aid-cols': 3 } as CSSProperties}>
              {ASPECTS.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  className={`aid-seg__opt${aspect === a.key ? ' is-active' : ''}`}
                  onClick={() => setAspect(a.key)}
                >
                  <span className={`aid-aspect aid-aspect--${a.glyph}`} aria-hidden="true" />
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          {/* Generate */}
          <div className="aid-panel__foot">
            <button
              className="s-btn s-btn--accent aid-generate"
              type="button"
              disabled={!canGenerate}
            >
              <IcoSparkle width="17" height="17" /> Generate 4 variations
            </button>
            <p className="aid-cost-hint">
              <IcoCoins width="13" height="13" /> Costs <b>{GEN_COST} coins</b> per generation
            </p>
          </div>
        </aside>

        {/* ============ RIGHT RESULTS CANVAS ============ */}
        <section className="aid-results">
          <div className="aid-results__head">
            <div className="aid-results__title">
              <h2>Results</h2>
              <span className="aid-results__count">
                {totalVariations} variations · {genLabel}
              </span>
            </div>
            <div className="aid-results__tools">
              <span className="s-chip s-chip--accent">
                <IcoSparkle width="12" height="12" /> {style}
              </span>
              <div className="aid-view">
                <button className="aid-view__btn is-active" type="button" aria-label="Grid view">
                  <IcoGrid width="15" height="15" />
                </button>
                <button className="aid-view__btn" type="button" aria-label="More options">
                  <IcoDots width="15" height="15" />
                </button>
              </div>
            </div>
          </div>

          <div className="aid-grid">
            {variations.map((v, i) => {
              const Glyph = GARMENT_GLYPHS[v.kind]
              return (
                <article className="aid-card" key={v.seed} tabIndex={0}>
                  <div className="aid-card__canvas" style={{ background: TINTS[i % TINTS.length] }}>
                    <span className="aid-card__grain" aria-hidden="true" />
                    <span className="aid-card__seed">{v.seed}</span>
                    <button
                      type="button"
                      className={`aid-card__fav${v.isFav ? ' is-fav' : ''}`}
                      onClick={() => toggleFav(v.seed)}
                      aria-label={v.isFav ? 'Unfavorite' : 'Favorite'}
                    >
                      <IcoStar width="15" height="15" />
                    </button>
                    <span className="aid-card__glyph">
                      <Glyph width="96" height="96" />
                    </span>

                    <div className="aid-toolbar">
                      <button className="aid-tool aid-tool--primary" type="button">
                        <IcoSparkle width="14" height="14" /> Upscale
                        <span className="aid-tool__tip">Upscale to 4K · 2 coins</span>
                      </button>
                      <button className="aid-tool" type="button" aria-label="Create tech pack">
                        <IcoTechPack width="16" height="16" />
                        <span className="aid-tool__tip">Create Tech Pack</span>
                      </button>
                      <button
                        className="aid-tool"
                        type="button"
                        aria-label="Send to Design Studio"
                        onClick={() => navigate('/suite/design')}
                      >
                        <IcoArrowRight width="16" height="16" />
                        <span className="aid-tool__tip">Send to Design Studio</span>
                      </button>
                      <button className="aid-tool" type="button" aria-label="Download">
                        <IcoUpload width="16" height="16" style={{ transform: 'rotate(180deg)' }} />
                        <span className="aid-tool__tip">Download</span>
                      </button>
                    </div>
                  </div>
                  <div className="aid-card__meta">
                    <span className="aid-card__name">{v.name}</span>
                    <span className="aid-card__style">{v.style}</span>
                  </div>
                </article>
              )
            })}

            {/* Generating shimmer placeholder */}
            <article className="aid-card aid-card--gen">
              <div className="aid-gen">
                <span className="aid-gen__shimmer" aria-hidden="true" />
                <span className="aid-gen__orb">
                  <IcoSparkle width="22" height="22" />
                </span>
                <span className="aid-gen__label">Rendering variation 4…</span>
                <span className="aid-gen__bar">
                  <span />
                </span>
              </div>
              <div className="aid-card__meta">
                <span className="aid-card__name">Generating…</span>
                <span className="aid-card__style">~8s</span>
              </div>
            </article>
          </div>

          {/* ---- History strip ---- */}
          <div className="aid-history">
            <div className="aid-history__head">
              <span className="aid-history__title">
                <IcoBolt width="13" height="13" /> Prompt history
              </span>
              <button className="aid-history__clear" type="button">
                Clear
              </button>
            </div>
            <div className="aid-history__row">
              {HISTORY.map((h) => {
                const Glyph = GARMENT_GLYPHS[h.kind]
                return (
                  <button
                    key={h.prompt}
                    type="button"
                    className="aid-hist"
                    onClick={() => setPrompt(h.prompt)}
                  >
                    <span className="aid-hist__thumb">
                      <Glyph width="22" height="22" />
                    </span>
                    <span className="aid-hist__body">
                      <span className="aid-hist__prompt">{h.prompt}</span>
                      <span className="aid-hist__meta">
                        <span>{h.style}</span>
                        <span className="aid-hist__dot" />
                        <span>{h.count} variations</span>
                        <span className="aid-hist__dot" />
                        <span>{h.time}</span>
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
