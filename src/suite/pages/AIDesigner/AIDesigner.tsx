import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { IcoSparkle, IcoPlus, IcoCoins, IcoBolt, IcoStar } from '../../components/ui/Icons'
import { useToast } from '../../components/ui/Toast'
import { useAuth } from '../../auth/auth'
import { hasImageAi, generateImages } from '../../ai/imageProvider'
import {
  frontPrompt,
  backPrompt,
  onModelPrompt,
  enhanceBrief,
  DESIGN_SIZE,
  MODEL_SIZE,
  DESIGN_STYLES,
  DESIGN_TYPES,
} from '../../ai/aiDesignerEngine'
import { saveDesign, listDesigns, patchDesign, deleteDesign, AI_DESIGNS_CHANGED_EVENT, type AIDesign } from '../../ai/aiDesignStore'
import { blobToDataUrl } from '../../assets/assetThumb'
import { createGarment } from '../../garment-model/garmentLibrary'
import { makeEmptyGarment } from '../../garment-model/garmentGeneration'
import { saveDoc } from '../DesignStudio/designDoc'
import { downloadBlob, slugify } from '../../lib/download'
import { COSTS } from '../../economy/economy'
import { usePaywall } from '../../economy/PaywallProvider'
import { useT } from '@/i18n'
import './aid.css'

/** The AI Designer does real, production-grade work (front + back render, on-model shots), so it
 *  costs meaningfully more than a quick graphic. Charged per successful variation / photo. */
const DESIGN_COST = COSTS.design
const PROMPT_MAX = 480
// Reference images are plain, unlabelled slots — just drop in images for loose style guidance.
const REF_COUNT = 3
const HISTORY_KEY = 'threados-aid-history-v1'
const GEN_TIMEOUT_MS = 120_000

const DEFAULT_PROMPT =
  'Oversized boxy hoodie, heavyweight fleece with a faded vintage wash, dropped shoulders, ribbed cuffs and a raw-cut hem. Muted concrete grey.'

const NAME_FORMS = ['Boxy', 'Cropped', 'Relaxed', 'Panelled', 'Draped', 'Structured', 'Washed', 'Heavyweight']
function designName(style: string, type: string, i: number): string {
  return `${NAME_FORMS[i % NAME_FORMS.length]} ${style} ${type}`
}

function loadHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === 'string') : []
  } catch {
    return []
  }
}
function pushHistory(prompt: string): string[] {
  const next = [prompt, ...loadHistory().filter((p) => p.toLowerCase() !== prompt.toLowerCase())].slice(0, 8)
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  return next
}

export function AIDesigner() {
  const navigate = useNavigate()
  const toast = useToast()
  const t = useT()
  const { user } = useAuth()

  const [prompt, setPrompt] = useState(DEFAULT_PROMPT)
  const [style, setStyle] = useState<string>('Vintage Wash')
  const [type, setType] = useState<string>('Hoodie')
  const [count, setCount] = useState(2)
  const [refUrls, setRefUrls] = useState<(string | null)[]>([null, null, null])
  const [designs, setDesigns] = useState<AIDesign[]>([])
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState('')
  const [modelBusy, setModelBusy] = useState<Set<string>>(() => new Set())
  const [history, setHistory] = useState<string[]>(loadHistory)
  const [live] = useState(() => hasImageAi())
  // Lightbox: an enlarged design image (front, back or an on-model shot) with actions.
  const [lightbox, setLightbox] = useState<{ design: AIDesign; url: string } | null>(null)
  const refInputs = useRef<Array<HTMLInputElement | null>>([])
  const abortRef = useRef<AbortController | null>(null)

  const coins = user?.coins ?? 0
  const { requireGeneration } = usePaywall()

  // Load (and live-refresh) the user's AI design library.
  const refresh = useCallback(async () => {
    if (!user) return
    setDesigns(await listDesigns(user.id))
  }, [user])
  useEffect(() => {
    void refresh()
    const onChange = () => void refresh()
    window.addEventListener(AI_DESIGNS_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(AI_DESIGNS_CHANGED_EVENT, onChange)
  }, [refresh])

  // Abort any in-flight generation on unmount so a late result never sets state on a dead component.
  useEffect(() => () => abortRef.current?.abort(), [])

  // Close the lightbox on Escape.
  useEffect(() => {
    if (!lightbox) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightbox(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox])

  const totalCost = count * DESIGN_COST
  // Enabled whenever there's a prompt — the paywall/coins are enforced on click (so blocked users
  // actually see the wall instead of a silently dead button).
  const canGenerate = prompt.trim().length > 0 && !generating

  async function addReference(i: number, file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast(t('aiDesigner.toastPickImage'), 'info')
      return
    }
    const url = await blobToDataUrl(file)
    setRefUrls((prev) => prev.map((u, j) => (j === i ? url : u)))
  }

  async function handleGenerate() {
    const clean = prompt.trim()
    if (!clean) return toast(t('aiDesigner.toastDescribeFirst'), 'info')
    if (!user) return toast(t('aiDesigner.toastSignIn'), 'info')
    if (generating) return

    // Enforce the paywall the moment they try: the first ever design is free, then Free-plan users
    // hit the wall and paid users spend coins. A blocked attempt shows the wall and stops here.
    const first = requireGeneration('design')
    if (!first.allow) return
    // A provider must be configured to actually render — don't burn the free trial / coins otherwise.
    if (!live) return toast(t('aiDesigner.toastNeedModel'), 'info')

    const brief = { prompt: clean, style, type }
    // References are plain images — loose STYLE guidance the model takes inspiration from, never copies.
    const references = refUrls.filter((u): u is string => !!u)
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setGenerating(true)
    let made = 0
    let firstError: unknown = null

    // A free trial makes exactly ONE design; paid users make the batch they asked for.
    const runs = first.mode === 'free' ? 1 : count

    for (let i = 0; i < runs; i++) {
      // The first run is already granted; each further run needs its own grant (coins) or we stop.
      const gate = i === 0 ? first : requireGeneration('design')
      if (!gate.allow) break
      try {
        setProgress(t('aiDesigner.progressFront', { i: i + 1, n: runs }))
        const signal = AbortSignal.any([ctrl.signal, AbortSignal.timeout(GEN_TIMEOUT_MS)])
        const front = (await generateImages(frontPrompt(brief, references.length > 0), { n: 1, references, size: DESIGN_SIZE, quality: 'high', signal }))[0]
        if (!front) throw new Error(t('aiDesigner.errNoFront'))
        setProgress(t('aiDesigner.progressBack', { i: i + 1, n: runs }))
        // Condition the back on the front so it's the SAME garment, from behind.
        const back = (await generateImages(backPrompt(brief), { n: 1, references: [front], size: DESIGN_SIZE, quality: 'high', signal }))[0] ?? front
        const design: AIDesign = {
          id: crypto.randomUUID(),
          userId: user.id,
          name: designName(style, type, made),
          prompt: clean,
          style,
          type,
          frontUrl: front,
          backUrl: back,
          modelUrls: [],
          favorite: false,
          createdAt: Date.now(),
        }
        await saveDesign(design)
        setDesigns((prev) => [design, ...prev])
        gate.commit() // charge (free-mark or coin-deduct) only for a design that actually landed
        made++
      } catch (err) {
        if (!firstError) firstError = err
      }
    }

    setGenerating(false)
    setProgress('')
    abortRef.current = null
    if (made > 0) {
      setHistory(pushHistory(clean))
      toast(made === 1 ? t('aiDesigner.toastGeneratedOne') : t('aiDesigner.toastGeneratedMany', { n: made }), 'success')
    } else {
      toast(firstError instanceof Error ? firstError.message : t('aiDesigner.errGenerationFailed'), 'info')
    }
  }

  /** Generate a photoreal on-model "real-life" photo of the exact garment. */
  async function generateModel(design: AIDesign) {
    if (!user) return
    if (modelBusy.has(design.id)) return
    const gate = requireGeneration('model')
    if (!gate.allow) return // first is free, then the paywall / coins
    setModelBusy((s) => new Set(s).add(design.id))
    try {
      const signal = AbortSignal.timeout(GEN_TIMEOUT_MS)
      const url = (await generateImages(onModelPrompt({ prompt: design.prompt, style: design.style, type: design.type }), {
        n: 1,
        references: [design.frontUrl],
        size: MODEL_SIZE,
        quality: 'high',
        signal,
      }))[0]
      if (!url) throw new Error(t('aiDesigner.errNoPhoto'))
      const next = await patchDesign(design.id, { modelUrls: [...design.modelUrls, url] })
      setDesigns((prev) => prev.map((d) => (d.id === design.id ? next ?? d : d)))
      gate.commit()
      toast(t('aiDesigner.toastPhotoAdded', { name: design.name }), 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : t('aiDesigner.errNoModelPhoto'), 'info')
    } finally {
      setModelBusy((s) => {
        const n = new Set(s)
        n.delete(design.id)
        return n
      })
    }
  }

  async function download(url: string, name: string) {
    try {
      const blob = await fetch(url).then((r) => r.blob())
      downloadBlob(blob, `threados-${slugify(name)}.png`)
    } catch {
      toast(t('aiDesigner.toastDownloadFail'), 'info')
    }
  }

  async function removeDesign(design: AIDesign) {
    if (!window.confirm(t('aiDesigner.confirmDelete', { name: design.name }))) return
    await deleteDesign(design.id)
    setDesigns((prev) => prev.filter((d) => d.id !== design.id))
  }

  async function toggleFav(design: AIDesign) {
    const next = await patchDesign(design.id, { favorite: !design.favorite })
    setDesigns((prev) => prev.map((d) => (d.id === design.id ? next ?? d : d)))
  }

  /** Push the AI garment into the Design Studio as a designable backdrop (its front render). */
  function sendToStudio(design: AIDesign) {
    if (!user) return
    const summary = createGarment(user.id, makeEmptyGarment(), { name: design.name, category: design.type, origin: 'ai' })
    saveDoc(summary.id, { layers: [], hidden: {}, designName: design.name, garmentEdit: design.frontUrl, updatedAt: Date.now() })
    toast(t('aiDesigner.toastSentToStudio', { name: design.name }), 'success')
    navigate(`/suite/studio?garment=${summary.id}`)
  }

  return (
    <div className="aid-root">
      {/* Header */}
      <header className="aid-head">
        <div>
          <p className="aid-head__eyebrow">
            <IcoSparkle width="13" height="13" /> {t('aiDesigner.eyebrow')}
          </p>
          <h1 className="aid-head__title">{t('aiDesigner.title')}</h1>
          <p className="aid-head__sub">
            {t('aiDesigner.subtitle')}
          </p>
        </div>
        <div className="aid-head__actions">
          <span className="aid-coins">
            <IcoCoins width="16" height="16" />
            <b>{coins}</b>
            <small>{t('aiDesigner.coinsLabel')}</small>
          </span>
        </div>
      </header>

      <div className="aid-studio">
        {/* Control panel */}
        <aside className="aid-panel">
          <div className="aid-field">
            <div className="aid-field__label">
              <span>{t('aiDesigner.prompt')}</span>
              <span className="aid-field__hint">{t('aiDesigner.promptHint')}</span>
            </div>
            <div className="aid-prompt">
              <textarea
                value={prompt}
                maxLength={PROMPT_MAX}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={t('aiDesigner.promptPlaceholder')}
                aria-label={t('aiDesigner.prompt')}
              />
              <div className="aid-prompt__foot">
                <button className="aid-prompt__enhance" type="button" onClick={() => setPrompt((p) => enhanceBrief(p).slice(0, PROMPT_MAX))}>
                  <IcoBolt width="12" height="12" /> {t('aiDesigner.enhance')}
                </button>
                <span className="aid-prompt__count">
                  {prompt.length}/{PROMPT_MAX}
                </span>
              </div>
            </div>
          </div>

          {/* Reference images (optional, real uploads) */}
          <div className="aid-field">
            <div className="aid-field__label">
              <span>{t('aiDesigner.refImages')}</span>
              <span className="aid-field__hint">{t('aiDesigner.optional')}</span>
            </div>
            <div className="aid-refs">
              {Array.from({ length: REF_COUNT }).map((_, i) => (
                <Fragment key={i}>
                  <button
                    type="button"
                    className={`aid-ref${refUrls[i] ? ' is-filled' : ''}`}
                    onClick={() => refInputs.current[i]?.click()}
                    aria-label={refUrls[i] ? t('aiDesigner.refReplace') : t('aiDesigner.refAdd')}
                    title={refUrls[i] ? t('aiDesigner.refReplace') : t('aiDesigner.refAdd')}
                  >
                    {refUrls[i] ? (
                      <img src={refUrls[i] as string} alt={t('aiDesigner.refAlt', { n: i + 1 })} className="aid-ref__img" />
                    ) : (
                      <IcoPlus width="16" height="16" />
                    )}
                  </button>
                  <input
                    ref={(el) => { refInputs.current[i] = el }}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    hidden
                    onChange={(e) => { void addReference(i, e.target.files?.[0]); e.target.value = '' }}
                  />
                </Fragment>
              ))}
            </div>
          </div>

          <div className="aid-field">
            <div className="aid-field__label"><span>{t('aiDesigner.brandStyle')}</span></div>
            <div className="aid-pills">
              {DESIGN_STYLES.map((s) => (
                <button key={s} type="button" className={`aid-pill${style === s ? ' is-active' : ''}`} onClick={() => setStyle(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="aid-field">
            <div className="aid-field__label"><span>{t('aiDesigner.garmentType')}</span></div>
            <div className="aid-pills">
              {DESIGN_TYPES.map((t) => (
                <button key={t} type="button" className={`aid-pill${type === t ? ' is-active' : ''}`} onClick={() => setType(t)}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="aid-field">
            <div className="aid-field__label"><span>{t('aiDesigner.howMany')}</span></div>
            <div className="aid-seg" style={{ '--aid-cols': 4 } as CSSProperties}>
              {[1, 2, 3, 4].map((n) => (
                <button key={n} type="button" className={`aid-seg__opt${count === n ? ' is-active' : ''}`} onClick={() => setCount(n)}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="aid-panel__foot">
            <button className="s-btn s-btn--accent aid-generate" type="button" disabled={!canGenerate} onClick={() => void handleGenerate()}>
              <IcoSparkle width="17" height="17" />
              {generating
                ? progress || t('aiDesigner.generating')
                : live
                  ? count === 1
                    ? t('aiDesigner.generateOne')
                    : t('aiDesigner.generateMany', { n: count })
                  : t('aiDesigner.needKey')}
            </button>
            <p className="aid-cost-hint">
              <IcoCoins width="13" height="13" /> {t('aiDesigner.costsPrefix')} <b>{t('aiDesigner.costsCoins', { n: totalCost })}</b> {t('aiDesigner.costsSuffix', { cost: DESIGN_COST })}
            </p>
          </div>
        </aside>

        {/* Library / results */}
        <section className="aid-results">
          <div className="aid-results__head">
            <div className="aid-results__title">
              <h2>{t('aiDesigner.library')}</h2>
              <span className="aid-results__count">{designs.length === 1 ? t('aiDesigner.designCountOne') : t('aiDesigner.designCountMany', { n: designs.length })}</span>
            </div>
          </div>

          <div className="aid-grid">
            {generating &&
              Array.from({ length: count }, (_, i) => (
                <article className="aid-card aid-card--gen" key={`gen-${i}`} aria-hidden="true">
                  <div className="aid-gen">
                    <span className="aid-gen__shimmer" />
                    <span className="aid-gen__orb"><IcoSparkle width="22" height="22" /></span>
                    <span className="aid-gen__label">{progress || t('aiDesigner.renderingN', { n: i + 1 })}</span>
                  </div>
                  <div className="aid-card__meta"><span className="aid-card__name">{t('aiDesigner.generating')}</span></div>
                </article>
              ))}

            {designs.map((d) => (
              <AIDesignCard
                key={d.id}
                design={d}
                onOpen={(url) => setLightbox({ design: d, url })}
                onFav={() => void toggleFav(d)}
                onDelete={() => void removeDesign(d)}
              />
            ))}

            {designs.length === 0 && !generating && (
              <div className="aid-empty">
                <span className="aid-empty__orb"><IcoSparkle width="22" height="22" /></span>
                <h3>{live ? t('aiDesigner.emptyTitleLive') : t('aiDesigner.emptyTitleKey')}</h3>
                <p>{live ? t('aiDesigner.emptyBodyLive') : t('aiDesigner.emptyBodyKey')}</p>
              </div>
            )}
          </div>

          {history.length > 0 && (
            <div className="aid-history">
              <div className="aid-history__head">
                <span className="aid-history__title"><IcoBolt width="13" height="13" /> {t('aiDesigner.promptHistory')}</span>
              </div>
              <div className="aid-history__row">
                {history.map((h) => (
                  <button key={h} type="button" className="aid-hist" onClick={() => setPrompt(h)}>
                    <span className="aid-hist__body">
                      <span className="aid-hist__prompt">{h}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {lightbox &&
        createPortal(
          <div className="aid-lightbox" role="dialog" aria-modal="true" onClick={() => setLightbox(null)}>
            <div className="aid-lightbox__panel" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="aid-lightbox__x" aria-label={t('aiDesigner.close')} onClick={() => setLightbox(null)}>×</button>
              <img className="aid-lightbox__img" src={lightbox.url} alt={lightbox.design.name} />
              <div className="aid-lightbox__bar">
                <span className="aid-lightbox__name" title={lightbox.design.name}>{lightbox.design.name}</span>
                <div className="aid-lightbox__actions">
                  <button type="button" className="s-btn" onClick={() => void download(lightbox.url, lightbox.design.name)}>{t('aiDesigner.download')}</button>
                  <button type="button" className="s-btn" onClick={() => { sendToStudio(lightbox.design); setLightbox(null) }}>{t('aiDesigner.openInStudio')}</button>
                  <button type="button" className="s-btn s-btn--accent" disabled={modelBusy.has(lightbox.design.id)} onClick={() => void generateModel(lightbox.design)}>
                    {modelBusy.has(lightbox.design.id) ? t('aiDesigner.shooting') : t('aiDesigner.onModel')}
                  </button>
                  <button type="button" className="s-btn" onClick={() => { const dsg = lightbox.design; setLightbox(null); void removeDesign(dsg) }}>{t('aiDesigner.delete')}</button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

/** One design in the library: front/back toggle, on-model strip, and per-card actions. */
function AIDesignCard(props: {
  design: AIDesign
  onOpen: (url: string) => void
  onFav: () => void
  onDelete: () => void
}) {
  const { design: d, onOpen, onFav, onDelete } = props
  const t = useT()
  const [view, setView] = useState<'front' | 'back'>('front')
  const current = view === 'front' ? d.frontUrl : d.backUrl

  return (
    <article className="aid-card">
      <div className="aid-card__canvas">
        <img className="aid-card__img" src={current} alt={t('aiDesigner.cardAlt', { name: d.name, view: view === 'front' ? t('aiDesigner.front') : t('aiDesigner.back') })} draggable={false} style={{ cursor: 'zoom-in' }} onClick={() => onOpen(current)} />
        <button type="button" className={`aid-card__fav${d.favorite ? ' is-fav' : ''}`} onClick={onFav} aria-label={d.favorite ? t('aiDesigner.unfavorite') : t('aiDesigner.favorite')}>
          <IcoStar width="15" height="15" />
        </button>
        <div className="aid-viewtabs">
          <button type="button" className={view === 'front' ? 'is-active' : ''} onClick={() => setView('front')}>{t('aiDesigner.front')}</button>
          <button type="button" className={view === 'back' ? 'is-active' : ''} onClick={() => setView('back')}>{t('aiDesigner.back')}</button>
        </div>
        {/* Only Delete lives on the card — every other action (download, on-a-model, open in studio)
            is in the lightbox that opens when you click the image. */}
        <div className="aid-toolbar">
          <button className="aid-tool" type="button" aria-label={t('aiDesigner.delete')} onClick={onDelete}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /></svg>
            <span className="aid-tool__tip">{t('aiDesigner.delete')}</span>
          </button>
        </div>
      </div>

      {d.modelUrls.length > 0 && (
        <div className="aid-models">
          {d.modelUrls.map((m, i) => (
            <button key={i} type="button" className="aid-model" onClick={() => onOpen(m)} title={t('aiDesigner.enlargeModel')}>
              <img src={m} alt={t('aiDesigner.onModelAlt', { name: d.name, n: i + 1 })} draggable={false} />
            </button>
          ))}
        </div>
      )}

      <div className="aid-card__meta">
        <span className="aid-card__name" title={d.name}>{d.name}</span>
        <span className="aid-card__style">{d.style}</span>
      </div>
    </article>
  )
}
