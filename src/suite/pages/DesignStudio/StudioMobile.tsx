import { useCallback, useEffect, useRef, useState } from 'react'
import { useT } from '@/i18n'
import { IcoSparkle, IcoPlus } from '../../components/ui/Icons'
import { useToast } from '../../components/ui/Toast'
import { useAuth } from '../../auth/auth'
import {
  generateImages,
  graphicPrompt,
  createGarmentPrompt,
  garmentEditPrompt,
  removeImageBackground,
  hasImageAi,
} from '../../ai/imageProvider'
import { generateConcepts } from '../../ai/conceptEngine'
import { hashSeed } from '../../ai/rng'
import { blobToDataUrl } from '../../assets/assetThumb'
import { saveGeneratedAsset } from '../../assets/saveGenerated'
import { createGarment } from '../../garment-model/garmentLibrary'
import { makeEmptyGarment } from '../../garment-model/garmentGeneration'
import { saveDoc } from './designDoc'
import { downloadBlob, slugify } from '../../lib/download'
import { COSTS } from '../../economy/economy'
import { usePaywall } from '../../economy/PaywallProvider'
import './threados-ai.css' // .tai-choice / .tai-chooser chooser styles (reused for the mobile picker)
import './studio-mobile.css'

type Mode = 'graphic' | 'create' | 'edit'
type Result = { id: string; url: string; mode: Mode; prompt: string; saved: boolean }

const GEN_TIMEOUT_MS = 120_000
// Which coin bucket each mode charges (and which free-trial it consumes). Mirrors the desktop AI.
const KIND: Record<Mode, keyof typeof COSTS> = { graphic: 'design', create: 'garment', edit: 'edit' }

/**
 * Mobile Design Studio. The desktop canvas editor is impractical on a phone, so instead of a dead-end
 * "open on desktop" gate we give phones an AI-first launcher: the same 3-choice chooser as the Studio's
 * loom studios AI (design a graphic / create a garment / edit a garment) wired to standalone,
 * canvas-free generation. Graphics auto-save to the Asset Library; garments save to the user's library.
 */
export function StudioMobile() {
  const t = useT()
  const toast = useToast()
  const { user } = useAuth()
  const { requireGeneration } = usePaywall()
  const [live] = useState(() => hasImageAi())

  const [mode, setMode] = useState<Mode | null>(null)
  const [prompt, setPrompt] = useState('')
  const [base, setBase] = useState<string | null>(null) // edit-mode: photo of the real garment
  const [results, setResults] = useState<Result[]>([])
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Abort any in-flight generation on unmount.
  useEffect(() => () => abortRef.current?.abort(), [])

  const pick = (m: Mode) => {
    setMode(m)
    setPrompt('')
    setBase(null)
    setResults([])
  }
  const back = () => {
    abortRef.current?.abort()
    setMode(null)
    setBusy(false)
  }

  async function addPhoto(file: File | undefined) {
    if (!file || !file.type.startsWith('image/')) return
    setBase(await blobToDataUrl(file))
  }

  const generate = useCallback(async () => {
    if (!mode || !user || busy) return
    const clean = prompt.trim()
    if (!clean) return toast(t('studioMobile.describeFirst'), 'info')
    if (mode === 'edit' && !base) return toast(t('studioMobile.edit.needPhoto'), 'info')

    // Paywall: first of each kind is free, then Free-plan users hit the wall and paid users spend coins.
    const gate = requireGeneration(KIND[mode])
    if (!gate.allow) return
    // create / edit need a real image model; graphic falls back to the on-device engine.
    if (mode !== 'graphic' && !live) return toast(t('studioMobile.needKey'), 'info')

    const ctrl = new AbortController()
    abortRef.current = ctrl
    setBusy(true)
    try {
      const signal = AbortSignal.any([ctrl.signal, AbortSignal.timeout(GEN_TIMEOUT_MS)])
      let raw: string | undefined

      if (mode === 'graphic') {
        if (live) raw = (await generateImages(graphicPrompt(clean), { n: 1, size: '1024x1024', quality: 'medium', signal }))[0]
        if (!raw) raw = generateConcepts(clean, { baseSeed: hashSeed(clean.toLowerCase()) })[0]?.dataUrl
      } else if (mode === 'create') {
        raw = (await generateImages(createGarmentPrompt(clean), { n: 1, size: '1024x1536', quality: 'medium', signal }))[0]
      } else {
        raw = (await generateImages(garmentEditPrompt(clean), { n: 1, references: [base as string], size: '1024x1536', quality: 'medium', signal }))[0]
      }
      if (ctrl.signal.aborted) return
      if (!raw) throw new Error(t('studioMobile.failed'))

      gate.commit() // charge only for a result that actually landed

      let finalUrl = raw
      if (mode === 'graphic') {
        // Cut the background so the graphic is a clean, drop-anywhere transparent PNG, then archive it.
        if (live) {
          const cut = await removeImageBackground(raw, ctrl.signal).catch(() => '')
          if (cut) finalUrl = cut
        }
        void saveGeneratedAsset({ userId: user.id, dataUrl: finalUrl, name: clean.slice(0, 40) || 'AI graphic', category: 'ai-graphic' })
      }

      setResults((prev) => [{ id: crypto.randomUUID(), url: finalUrl, mode, prompt: clean, saved: false }, ...prev])
      toast(mode === 'graphic' ? t('studioMobile.readyGraphic') : t('studioMobile.readyGarment'), 'success')
    } catch (err) {
      if (!ctrl.signal.aborted) toast(err instanceof Error ? err.message : t('studioMobile.failed'), 'info')
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null
      setBusy(false)
    }
  }, [mode, user, busy, prompt, base, requireGeneration, live, toast, t])

  function saveAsGarment(r: Result) {
    if (!user) return
    const name = r.prompt.slice(0, 40) || t('studioMobile.newGarment')
    const summary = createGarment(user.id, makeEmptyGarment(), { name, category: 'AI', origin: 'ai' })
    saveDoc(summary.id, { layers: [], hidden: {}, designName: name, garmentEdit: r.url, updatedAt: Date.now() })
    setResults((prev) => prev.map((x) => (x.id === r.id ? { ...x, saved: true } : x)))
    toast(t('studioMobile.savedGarment', { name }), 'success')
  }

  async function download(r: Result) {
    try {
      const blob = await fetch(r.url).then((res) => res.blob())
      downloadBlob(blob, `loom-${slugify(r.prompt) || 'design'}.png`)
    } catch {
      toast(t('studioMobile.downloadFail'), 'info')
    }
  }

  // ── Chooser (image-2): the three ways to create on mobile ────────────────────────────────────────
  if (!mode) {
    return (
      <div className="smob">
        <header className="smob__head">
          <span className="smob__eyebrow"><IcoSparkle width="15" height="15" /> {t('studioMobile.eyebrow')}</span>
          <h1>{t('dsAi.chooser.title')}</h1>
          <p>{t('dsAi.chooser.sub')}</p>
        </header>

        <div className="tai-chooser__cards smob__cards">
          <button type="button" className="tai-choice tai-choice--graphic" onClick={() => pick('graphic')}>
            <span className="tai-choice__icon" aria-hidden>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2.5l1.7 4.8 4.8 1.7-4.8 1.7L12 15.5l-1.7-4.8L5.5 9l4.8-1.7z" />
                <path d="M18.5 15l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z" />
              </svg>
            </span>
            <b>{t('dsAi.choice.graphicTitle')}</b>
            <small>{t('dsAi.choice.graphicDesc')}</small>
            <span className="tai-choice__go">{t('dsAi.choice.graphicGo')}</span>
          </button>

          <button type="button" className="tai-choice tai-choice--create" onClick={() => pick('create')}>
            <span className="tai-choice__icon" aria-hidden>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />
                <path d="M12 9.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" />
              </svg>
            </span>
            <b>{t('dsAi.choice.createTitle')}{!live && <span className="tai-choice__badge">{t('dsAi.choice.needsKeyBadge')}</span>}</b>
            <small>{t('dsAi.choice.createDesc')}</small>
            <span className="tai-choice__go">{live ? t('dsAi.choice.createGo') : t('dsAi.choice.addKeyGo')}</span>
          </button>

          <button type="button" className="tai-choice tai-choice--garment" onClick={() => pick('edit')}>
            <span className="tai-choice__icon" aria-hidden>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />
              </svg>
            </span>
            <b>{t('dsAi.choice.garmentTitle')}{!live && <span className="tai-choice__badge">{t('dsAi.choice.needsKeyBadge')}</span>}</b>
            <small>{t('dsAi.choice.garmentDesc')}</small>
            <span className="tai-choice__go">{live ? t('dsAi.choice.garmentGo') : t('dsAi.choice.addKeyGo')}</span>
          </button>
        </div>

        <p className="smob__note">{t('studioMobile.deskNote')}</p>
      </div>
    )
  }

  // ── Generation sheet for the picked mode ─────────────────────────────────────────────────────────
  const placeholder = mode === 'edit' ? t('dsAi.ph.garment') : mode === 'create' ? t('dsAi.ph.create') : t('dsAi.ph.graphic')
  const title = mode === 'edit' ? t('dsAi.choice.garmentTitle') : mode === 'create' ? t('dsAi.choice.createTitle') : t('dsAi.choice.graphicTitle')

  return (
    <div className="smob">
      <header className="smob__sheet-head">
        <button type="button" className="smob__back" onClick={back} aria-label={t('studioMobile.back')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          {t('studioMobile.back')}
        </button>
        <span className="smob__sheet-title">{title}</span>
      </header>

      {mode === 'edit' && (
        <button type="button" className={`smob__upload${base ? ' is-filled' : ''}`} onClick={() => fileRef.current?.click()}>
          {base ? (
            <>
              <img src={base} alt="" className="smob__upload-img" />
              <span className="smob__upload-replace">{t('studioMobile.edit.replace')}</span>
            </>
          ) : (
            <>
              <span className="smob__upload-ico"><IcoPlus width="20" height="20" /></span>
              <b>{t('studioMobile.edit.addPhoto')}</b>
              <small>{t('studioMobile.edit.addPhotoHint')}</small>
            </>
          )}
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { void addPhoto(e.target.files?.[0]); e.target.value = '' }} />

      <div className="smob__prompt">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          rows={3}
        />
      </div>

      <button className="s-btn s-btn--accent smob__go" type="button" disabled={busy || !prompt.trim()} onClick={() => void generate()}>
        <IcoSparkle width="17" height="17" />
        {busy ? t('studioMobile.generating') : t('studioMobile.generate')}
      </button>

      <div className="smob__results">
        <span className="smob__results-label">{t('studioMobile.results')}</span>
        {busy && (
          <div className="smob-card smob-card--loading">
            <span className="smob-card__spin" />
            <span>{t('studioMobile.generating')}</span>
          </div>
        )}
        {!busy && results.length === 0 && <p className="smob__empty">{t('studioMobile.empty')}</p>}
        {results.map((r) => (
          <article key={r.id} className="smob-card">
            <div className={`smob-card__stage${r.mode === 'graphic' ? ' smob-card__stage--checker' : ''}`}>
              <img src={r.url} alt={r.prompt} />
            </div>
            <div className="smob-card__actions">
              <button type="button" className="s-btn" onClick={() => void download(r)}>{t('studioMobile.download')}</button>
              {r.mode === 'graphic' ? (
                <span className="smob-card__saved">{t('studioMobile.savedAsset')}</span>
              ) : (
                <button type="button" className="s-btn s-btn--accent" disabled={r.saved} onClick={() => saveAsGarment(r)}>
                  {r.saved ? t('studioMobile.savedShort') : t('studioMobile.saveGarment')}
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
