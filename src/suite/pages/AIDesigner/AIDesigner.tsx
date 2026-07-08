import { useEffect, useMemo, useRef, useState } from 'react'
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
import { useToast } from '../../components/ui/Toast'
import { useAuth } from '../../auth/auth'
import { useStore } from '../../data/store'
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
  'radial-gradient(130% 120% at 30% 12%, rgba(209,249,79,0.30), transparent 58%), linear-gradient(160deg, #14121f, #0b0b10)',
  'radial-gradient(130% 120% at 70% 14%, rgba(155,123,255,0.26), transparent 60%), linear-gradient(160deg, #171320, #0b0b10)',
  'radial-gradient(120% 130% at 50% 0%, rgba(209,249,79,0.22), transparent 62%), linear-gradient(200deg, #100f19, #0a0a0f)',
  'radial-gradient(130% 120% at 20% 20%, rgba(209,249,79,0.24), rgba(255,107,166,0.06) 45%, transparent 66%), linear-gradient(150deg, #15121d, #0b0b10)',
]

type Variation = {
  id: string
  seed: string
  name: string
  kind: GarmentKind
  style: Style
  isFav: boolean
}

const INITIAL_VARIATIONS: Variation[] = [
  { id: 'v-seed-1', seed: '0x8F2A', name: 'Washed Boxy Hoodie', kind: 'hoodie', style: 'Vintage Wash', isFav: true },
  { id: 'v-seed-2', seed: '0x1D77', name: 'Panelled Track Hoodie', kind: 'hoodie', style: 'Sportswear', isFav: false },
  { id: 'v-seed-3', seed: '0xB4C0', name: 'Drop-Shoulder Heavyweight', kind: 'hoodie', style: 'Streetwear', isFav: false },
]

let variationCounter = 0
function makeVariationId(): string {
  variationCounter += 1
  return `v-${Date.now().toString(36)}-${variationCounter.toString(36)}`
}

type HistoryItem = { id: string; prompt: string; kind: GarmentKind; style: Style; time: string; count: number }
const INITIAL_HISTORY: HistoryItem[] = [
  { id: 'h1', prompt: 'Faded acid-wash hoodie, oversized fit, raw hem', kind: 'hoodie', style: 'Vintage Wash', time: '4m ago', count: 4 },
  { id: 'h2', prompt: 'Minimal boxy tee, heavyweight cotton, tonal stitch', kind: 'tee', style: 'Minimal', time: '1h ago', count: 4 },
  { id: 'h3', prompt: 'Cropped moto jacket, matte black hardware', kind: 'jacket', style: 'Luxury', time: '3h ago', count: 6 },
  { id: 'h4', prompt: 'Baggy cargo pants, ripstop, utility pockets', kind: 'pants', style: 'Streetwear', time: 'Yesterday', count: 4 },
  { id: 'h5', prompt: 'Structured 6-panel cap, embroidered crest', kind: 'cap', style: 'Sportswear', time: 'Yesterday', count: 4 },
]

let historyCounter = 0
function makeHistoryId(): string {
  historyCounter += 1
  return `h-${Date.now().toString(36)}-${historyCounter.toString(36)}`
}

const GEN_COST = 4
const GEN_COUNT = 4
const UPSCALE_COST = 2
const PROMPT_MAX = 480
const GEN_MS = 2400

/** Descriptive nouns used to name freshly generated variations. */
const NAME_FORMS = ['Boxy', 'Cropped', 'Relaxed', 'Panelled', 'Draped', 'Structured', 'Washed', 'Heavyweight']

function makeSeed(): string {
  return `0x${Math.floor(Math.random() * 0xffff).toString(16).toUpperCase().padStart(4, '0')}`
}

function makeVariationName(style: Style, kind: GarmentKind): string {
  const form = NAME_FORMS[Math.floor(Math.random() * NAME_FORMS.length)]
  const label = TYPES.find((t) => t.key === kind)?.label ?? 'Garment'
  return `${form} ${style} ${label}`
}

const DEFAULT_PROMPT =
  'Oversized boxy hoodie, heavyweight fleece with a faded vintage wash, dropped shoulders, ribbed cuffs and a raw-cut hem. Muted concrete grey.'

export function AIDesigner() {
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuth()
  const { mutate } = useStore()

  const [prompt, setPrompt] = useState(DEFAULT_PROMPT)
  const [style, setStyle] = useState<Style>('Vintage Wash')
  const [type, setType] = useState<GarmentKind>('hoodie')
  const [aspect, setAspect] = useState<Aspect>('portrait')
  const [refs, setRefs] = useState<boolean[]>([true, false, false])
  const [variations, setVariations] = useState<Variation[]>(INITIAL_VARIATIONS)
  const [history, setHistory] = useState<HistoryItem[]>(INITIAL_HISTORY)
  const [isGenerating, setIsGenerating] = useState(false)
  const genTimer = useRef<number | null>(null)

  // Coins live on the authenticated user in the store — read them there rather
  // than showing a hardcoded balance that never reflects a generation spend.
  const coins = user?.coins ?? 0
  const canGenerate = prompt.trim().length > 0 && !isGenerating && coins >= GEN_COST
  const totalVariations = variations.length + (isGenerating ? GEN_COUNT : 0)

  const genLabel = useMemo(() => {
    const label = TYPES.find((x) => x.key === type)?.label ?? 'garment'
    return `${style} ${label.toLowerCase()}`
  }, [style, type])

  const toggleRef = (index: number) =>
    setRefs((prev) => prev.map((value, i) => (i === index ? !value : value)))

  const toggleFav = (id: string) =>
    setVariations((prev) => prev.map((v) => (v.id === id ? { ...v, isFav: !v.isFav } : v)))

  // Clear any in-flight generation timer if the component unmounts mid-run, so
  // the delayed setState never fires on an unmounted component.
  useEffect(() => {
    return () => {
      if (genTimer.current !== null) {
        window.clearTimeout(genTimer.current)
        genTimer.current = null
      }
    }
  }, [])

  function handleGenerate() {
    const clean = prompt.trim()
    if (!clean) {
      toast('Describe the garment you want before generating.', 'info')
      return
    }
    if (isGenerating) return
    if (!user) {
      toast('Sign in to generate designs.', 'info')
      return
    }
    if (coins < GEN_COST) {
      toast(`Not enough coins — generating costs ${GEN_COST}.`, 'info')
      return
    }

    // Spend coins immutably against the current user, preserving all other data.
    mutate((d) => ({
      ...d,
      users: d.users.map((u) => (u.id === user.id ? { ...u, coins: u.coins - GEN_COST } : u)),
    }))

    setIsGenerating(true)
    genTimer.current = window.setTimeout(() => {
      const fresh: Variation[] = Array.from({ length: GEN_COUNT }, () => ({
        id: makeVariationId(),
        seed: makeSeed(),
        name: makeVariationName(style, type),
        kind: type,
        style,
        isFav: false,
      }))
      setVariations((prev) => [...fresh, ...prev])
      setHistory((prev) => [
        { id: makeHistoryId(), prompt: clean, kind: type, style, time: 'just now', count: GEN_COUNT },
        ...prev,
      ])
      setIsGenerating(false)
      genTimer.current = null
      toast(`Generated ${GEN_COUNT} ${genLabel} variations.`, 'success')
    }, GEN_MS)
  }

  function enhancePrompt() {
    const clean = prompt.trim()
    if (!clean) {
      toast('Write a short prompt first, then enhance it.', 'info')
      return
    }
    const additions = 'studio product shot, soft diffused lighting, crisp fabric detail, neutral backdrop'
    if (clean.toLowerCase().includes('studio product shot')) {
      toast('Prompt already enhanced.', 'info')
      return
    }
    const next = `${clean.replace(/\s*[.,]?\s*$/, '')}. ${additions}.`.slice(0, PROMPT_MAX)
    setPrompt(next)
    toast('Prompt enhanced with studio detail.', 'accent')
  }

  function newSession() {
    if (genTimer.current !== null) {
      window.clearTimeout(genTimer.current)
      genTimer.current = null
    }
    setPrompt(DEFAULT_PROMPT)
    setStyle('Vintage Wash')
    setType('hoodie')
    setAspect('portrait')
    setRefs([true, false, false])
    setVariations(INITIAL_VARIATIONS)
    setIsGenerating(false)
    toast('Started a fresh session.', 'info')
  }

  function clearHistory() {
    if (history.length === 0) {
      toast('History is already empty.', 'info')
      return
    }
    setHistory([])
    toast('Prompt history cleared.')
  }

  function upscale(v: Variation) {
    if (!user) {
      toast('Sign in to upscale designs.', 'info')
      return
    }
    if (coins < UPSCALE_COST) {
      toast(`Not enough coins — upscaling costs ${UPSCALE_COST}.`, 'info')
      return
    }
    mutate((d) => ({
      ...d,
      users: d.users.map((u) => (u.id === user.id ? { ...u, coins: u.coins - UPSCALE_COST } : u)),
    }))
    toast(`Upscaling “${v.name}” to 4K…`, 'accent')
  }

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
            <b>{coins}</b>
            <small>coins</small>
          </span>
          <button className="s-btn s-btn--ghost" type="button" onClick={newSession}>
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
                <button className="aid-prompt__enhance" type="button" onClick={enhancePrompt}>
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
              onClick={handleGenerate}
            >
              <IcoSparkle width="17" height="17" />
              {isGenerating ? 'Generating…' : `Generate ${GEN_COUNT} variations`}
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
                <button
                  className="aid-view__btn is-active"
                  type="button"
                  aria-label="Grid view"
                  aria-pressed="true"
                >
                  <IcoGrid width="15" height="15" />
                </button>
                <button
                  className="aid-view__btn"
                  type="button"
                  aria-label="More options"
                  onClick={() => toast('More result options coming soon.', 'info')}
                >
                  <IcoDots width="15" height="15" />
                </button>
              </div>
            </div>
          </div>

          <div className="aid-grid">
            {variations.map((v, i) => {
              const Glyph = GARMENT_GLYPHS[v.kind]
              return (
                <article className="aid-card" key={v.id} tabIndex={0}>
                  <div className="aid-card__canvas" style={{ background: TINTS[i % TINTS.length] }}>
                    <span className="aid-card__grain" aria-hidden="true" />
                    <span className="aid-card__seed">{v.seed}</span>
                    <button
                      type="button"
                      className={`aid-card__fav${v.isFav ? ' is-fav' : ''}`}
                      onClick={() => toggleFav(v.id)}
                      aria-label={v.isFav ? 'Unfavorite' : 'Favorite'}
                    >
                      <IcoStar width="15" height="15" />
                    </button>
                    <span className="aid-card__glyph">
                      <Glyph width="96" height="96" />
                    </span>

                    <div className="aid-toolbar">
                      <button
                        className="aid-tool aid-tool--primary"
                        type="button"
                        onClick={() => upscale(v)}
                      >
                        <IcoSparkle width="14" height="14" /> Upscale
                        <span className="aid-tool__tip">Upscale to 4K · {UPSCALE_COST} coins</span>
                      </button>
                      <button
                        className="aid-tool"
                        type="button"
                        aria-label="Create tech pack"
                        onClick={() => {
                          toast(`Creating a tech pack from “${v.name}”…`, 'accent')
                          navigate('/suite/tech-packs')
                        }}
                      >
                        <IcoTechPack width="16" height="16" />
                        <span className="aid-tool__tip">Create Tech Pack</span>
                      </button>
                      <button
                        className="aid-tool"
                        type="button"
                        aria-label="Send to Design Studio"
                        onClick={() => {
                          toast(`Sending “${v.name}” to the Design Studio…`, 'accent')
                          navigate('/suite/design')
                        }}
                      >
                        <IcoArrowRight width="16" height="16" />
                        <span className="aid-tool__tip">Send to Design Studio</span>
                      </button>
                      <button
                        className="aid-tool"
                        type="button"
                        aria-label="Download"
                        onClick={() => toast(`Preparing “${v.name}” for download…`)}
                      >
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

            {/* Generating shimmer placeholders — shown only while a run is in flight */}
            {isGenerating &&
              Array.from({ length: GEN_COUNT }, (_, i) => (
                <article className="aid-card aid-card--gen" key={`gen-${i}`} aria-hidden="true">
                  <div className="aid-gen">
                    <span className="aid-gen__shimmer" />
                    <span className="aid-gen__orb">
                      <IcoSparkle width="22" height="22" />
                    </span>
                    <span className="aid-gen__label">Rendering variation {i + 1}…</span>
                    <span className="aid-gen__bar">
                      <span />
                    </span>
                  </div>
                  <div className="aid-card__meta">
                    <span className="aid-card__name">Generating…</span>
                    <span className="aid-card__style">~{Math.ceil(GEN_MS / 1000)}s</span>
                  </div>
                </article>
              ))}

            {variations.length === 0 && !isGenerating && (
              <div className="aid-empty">
                <span className="aid-empty__orb">
                  <IcoSparkle width="22" height="22" />
                </span>
                <h3>No variations yet</h3>
                <p>Describe a garment on the left and generate your first set.</p>
              </div>
            )}
          </div>

          {/* ---- History strip ---- */}
          <div className="aid-history">
            <div className="aid-history__head">
              <span className="aid-history__title">
                <IcoBolt width="13" height="13" /> Prompt history
              </span>
              <button className="aid-history__clear" type="button" onClick={clearHistory}>
                Clear
              </button>
            </div>
            {history.length > 0 ? (
              <div className="aid-history__row">
                {history.map((h) => {
                  const Glyph = GARMENT_GLYPHS[h.kind]
                  return (
                    <button
                      key={h.id}
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
            ) : (
              <p className="aid-history__empty">No prompts yet — your generations will show up here.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
