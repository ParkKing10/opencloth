import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '@/i18n'
import { IcoSparkle } from '../../components/ui/Icons'
import { useToast } from '../../components/ui/Toast'
import { downloadBlob, slugify } from '../../lib/download'
import { generateConcepts, regenerateConcept, isLiveConceptAi, liveConcept, type Concept } from '../../ai/conceptEngine'
import { generateImages, graphicPrompt, garmentEditPrompt, createGarmentPrompt, removeImageBackground, hasImageAi } from '../../ai/imageProvider'
import { blobToDataUrl } from '../../assets/assetThumb'
import { saveGeneratedAsset } from '../../assets/saveGenerated'
import { captureDesignPng } from '../../export/real/capture'
import { hashSeed } from '../../ai/rng'
import './threados-ai.css'

export type AiMode = 'graphic' | 'garment' | 'create'

/** Creative follow-ups the engine can honestly deliver: each re-generates with the added intent. */
const SUGGESTIONS: { k: string; add: string }[] = [
  { k: 'dsAi.sug.chrome', add: 'chrome' },
  { k: 'dsAi.sug.neonGlow', add: 'neon glow' },
  { k: 'dsAi.sug.vintageWash', add: 'vintage distressed' },
  { k: 'dsAi.sug.gothic', add: 'gothic' },
  { k: 'dsAi.sug.gold', add: 'gold metallic' },
  { k: 'dsAi.sug.graffiti', add: 'graffiti spray' },
  { k: 'dsAi.sug.moreAggressive', add: 'aggressive sharp' },
  { k: 'dsAi.sug.cleaner', add: 'clean minimal' },
  { k: 'dsAi.sug.moreLuxurious', add: 'luxury premium' },
]

/** Create-garment directions — each steers a brand-new generated piece toward a look/detail. */
const CREATE_SUGGESTIONS: { k: string; add: string }[] = [
  { k: 'dsAi.csug.streetwear', add: 'streetwear' },
  { k: 'dsAi.csug.luxury', add: 'luxury premium' },
  { k: 'dsAi.csug.oversized', add: 'oversized boxy fit' },
  { k: 'dsAi.csug.techwear', add: 'techwear utility' },
  { k: 'dsAi.csug.vintageWash', add: 'vintage washed' },
  { k: 'dsAi.csug.minimal', add: 'clean minimal' },
  { k: 'dsAi.csug.addHood', add: 'with a hood' },
  { k: 'dsAi.csug.cargoPockets', add: 'with cargo pockets' },
]

/** Garment-edit follow-ups — each appends a real fabric transformation to the prompt. */
const GARMENT_SUGGESTIONS: { k: string; add: string }[] = [
  { k: 'dsAi.gsug.distressed', add: 'heavily distressed and ripped' },
  { k: 'dsAi.gsug.addHoles', add: 'with crazy holes all over' },
  { k: 'dsAi.gsug.acidWash', add: 'acid-washed' },
  { k: 'dsAi.gsug.bleached', add: 'bleach-splattered' },
  { k: 'dsAi.gsug.vintageFaded', add: 'vintage faded' },
  { k: 'dsAi.gsug.oversized', add: 'oversized boxy fit' },
  { k: 'dsAi.gsug.cropped', add: 'cropped' },
  { k: 'dsAi.gsug.patchwork', add: 'patchwork panels' },
]

const HISTORY_KEY = 'threados-ai-history-v1'
const REVEAL_MS = 90

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

type Props = {
  open: boolean
  initialPrompt: string
  initialMode?: AiMode
  /** Signed-in user — every generated image auto-saves to their Asset Library. */
  userId?: string
  onClose: () => void
  onAddToCanvas: (concept: Concept) => void
  /** Apply an edited garment image as the new garment backdrop (Edit Garment mode). */
  onApplyGarment?: (dataUrl: string) => void
  /** Embedded in the Library rail (no portal, no scrim, no close X) — the AI lives in the left panel. */
  embedded?: boolean
}

/**
 * loom studios AI — the creative workspace. Type an idea, get three real transparent vector concepts,
 * keep steering with suggestions, then Add to Canvas. Honest about the engine: on-device vector
 * synthesis today (isLiveConceptAi() === false), same UI when a diffusion model connects later.
 */
export function ThreadosAIModal({ open, initialPrompt, initialMode = 'graphic', userId, onClose, onAddToCanvas, onApplyGarment, embedded = false }: Props) {
  const t = useT()
  const toast = useToast()
  const [mode, setMode] = useState<AiMode>(initialMode)
  const modeRef = useRef<AiMode>(initialMode)
  useEffect(() => {
    modeRef.current = mode
  }, [mode])
  const [prompt, setPrompt] = useState(initialPrompt)
  const [concepts, setConcepts] = useState<Concept[]>([])
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [favs, setFavs] = useState<Concept[]>([])
  const [zoom, setZoom] = useState<Concept | null>(null)
  const [busyIdx, setBusyIdx] = useState<number | null>(null)
  // Concept ids whose transparent cut-out is still processing — their Add/Apply buttons wait so a
  // raw (opaque) image can never be placed on the garment before the background is removed.
  const [finalizingIds, setFinalizingIds] = useState<Set<string>>(() => new Set())
  const [history, setHistory] = useState<string[]>(loadHistory)
  const [historyOpen, setHistoryOpen] = useState(false)
  // When loom studios AI is opened without a committed intent (a bare "Ask loom studios AI" click), ASK
  // first with a big, unmissable choice — Design a graphic vs. Edit the garment — instead of relying
  // on the small header toggle a user would never notice.
  const [choosing, setChoosing] = useState(false)
  const [references, setReferences] = useState<string[]>([])
  // Drag-and-drop reference images: `dragging` drives the drop overlay; the depth counter keeps it
  // stable as the pointer crosses child elements (dragenter/leave fire per element, not per modal).
  const [dragging, setDragging] = useState(false)
  const dragDepth = useRef(0)
  const [live] = useState(() => hasImageAi())
  const inputRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const firstChoiceRef = useRef<HTMLButtonElement>(null)
  const refsRef = useRef<string[]>([])
  const runIdRef = useRef(0)
  const nonceRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  useEffect(() => {
    refsRef.current = references
  }, [references])

  const run = useCallback(
    async (p: string, fresh: boolean) => {
      const clean = p.trim()
      if (!clean) return
      if (fresh) nonceRef.current = 0
      else nonceRef.current += 1
      const base = (hashSeed(clean.toLowerCase()) ^ (nonceRef.current * 0x27d4eb2f)) >>> 0
      const myRun = ++runIdRef.current
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      setGenerating(true)
      setConcepts([])
      setProgress(0)
      setFinalizingIds(new Set())

      // Show the raw image the INSTANT it's generated, then swap to the transparent cut-out when
      // background removal finishes (and save the final asset). This is what makes results appear
      // fast — the user never waits on the extra transparency pass.
      const clearFinalizing = (id: string) => setFinalizingIds((s) => { const n = new Set(s); n.delete(id); return n })
      const finalize = (conceptId: string, rawUrl: string, name: string, category: 'ai-graphic' | 'garment-edit') => {
        setFinalizingIds((s) => new Set(s).add(conceptId))
        removeImageBackground(rawUrl, ctrl.signal)
          .then((cut) => {
            if (runIdRef.current !== myRun) return
            const finalUrl = cut || rawUrl
            if (finalUrl !== rawUrl) {
              // Swap the transparent cut-out into BOTH the grid and any favorite of this concept.
              setConcepts((prev) => prev.map((c) => (c && c.id === conceptId ? { ...c, dataUrl: finalUrl } : c)))
              setFavs((f) => f.map((x) => (x.id === conceptId ? { ...x, dataUrl: finalUrl } : x)))
            }
            if (userId) void saveGeneratedAsset({ userId, dataUrl: finalUrl, name, category })
          })
          .finally(() => clearFinalizing(conceptId))
      }

      // Edit-garment mode: transform the actual garment (add holes, wash, distress…). Requires a
      // real image model — there is no honest on-device way to repaint a garment, and we won't fake it.
      if (modeRef.current === 'garment') {
        if (!hasImageAi()) {
          toast(t('dsAi.toast.garmentNeedsModel'), 'info')
          setGenerating(false)
          return
        }
        let garmentPng: string
        try {
          const blob = await captureDesignPng({ scope: 'garment', background: 'white', scale: 2 })
          garmentPng = await blobToDataUrl(blob)
        } catch {
          if (runIdRef.current === myRun) {
            toast(t('dsAi.toast.cannotRenderGarment'), 'info')
            setGenerating(false)
          }
          return
        }
        let okG = false
        let errG: unknown = null
        await Promise.all(
          [0].map(async (i) => {
            const signal = AbortSignal.any([ctrl.signal, AbortSignal.timeout(120_000)])
            try {
              // Example/reference uploads guide the edit alongside the captured garment.
              const urls = await generateImages(garmentEditPrompt(clean), { n: 1, references: [garmentPng, ...refsRef.current], size: '1024x1536', quality: 'medium', signal })
              if (runIdRef.current !== myRun) return
              if (urls[0]) {
                okG = true
                const c = liveConcept(clean, urls[0], (base + i * 0x9e3779b1) >>> 0)
                setConcepts((prev) => {
                  const next = prev.slice()
                  next[i] = c
                  return next
                })
                setProgress((p) => p + 1)
                finalize(c.id, urls[0], `Garment — ${clean.slice(0, 32)}`, 'garment-edit')
              }
            } catch (err) {
              if (!errG) errG = err
            }
          }),
        )
        if (runIdRef.current !== myRun) return
        setGenerating(false)
        if (okG) setHistory(pushHistory(clean))
        else toast(errG instanceof Error ? errG.message : t('dsAi.toast.garmentEditFailed'), 'info')
        return
      }

      // Create-garment mode: generate a brand-NEW garment from the text alone (no base to capture),
      // then apply it as the backdrop so the user designs on top. Same photoreal engine as Edit Garment.
      if (modeRef.current === 'create') {
        if (!hasImageAi()) {
          toast(t('dsAi.toast.createNeedsModel'), 'info')
          setGenerating(false)
          return
        }
        let okC = false
        let errC: unknown = null
        await Promise.all(
          [0].map(async (i) => {
            const signal = AbortSignal.any([ctrl.signal, AbortSignal.timeout(120_000)])
            try {
              // Optional reference uploads are loose STYLE guidance only (see createGarmentPrompt).
              const urls = await generateImages(createGarmentPrompt(clean, refsRef.current.length > 0), { n: 1, references: refsRef.current, size: '1024x1536', quality: 'medium', signal })
              if (runIdRef.current !== myRun) return
              if (urls[0]) {
                okC = true
                const c = liveConcept(clean, urls[0], (base + i * 0x9e3779b1) >>> 0)
                setConcepts((prev) => {
                  const next = prev.slice()
                  next[i] = c
                  return next
                })
                setProgress((p) => p + 1)
                finalize(c.id, urls[0], `New garment — ${clean.slice(0, 32)}`, 'garment-edit')
              }
            } catch (err) {
              if (!errC) errC = err
            }
          }),
        )
        if (runIdRef.current !== myRun) return
        setGenerating(false)
        if (okC) setHistory(pushHistory(clean))
        else toast(errC instanceof Error ? errC.message : t('dsAi.toast.garmentCreationFailed'), 'info')
        return
      }

      // Real generation with Runware (Nano Banana 2) when a key is configured. Fire THREE independent
      // single-image requests so results stream in one-by-one (not one slow batch), a single
      // failure never kills the others, and a 90s timeout guarantees it can't hang forever.
      if (hasImageAi()) {
        let anyOk = false
        let firstErr: unknown = null
        await Promise.all(
          [0].map(async (i) => {
            const signal = AbortSignal.any([ctrl.signal, AbortSignal.timeout(90_000)])
            try {
              const urls = await generateImages(graphicPrompt(clean), { n: 1, references: refsRef.current, size: '1024x1024', quality: 'medium', signal })
              if (runIdRef.current !== myRun) return
              if (urls[0]) {
                anyOk = true
                const c = liveConcept(clean, urls[0], (base + i * 0x9e3779b1) >>> 0)
                setConcepts((prev) => {
                  const next = prev.slice()
                  next[i] = c
                  return next
                })
                setProgress((p) => p + 1)
                finalize(c.id, urls[0], clean.slice(0, 40) || 'AI graphic', 'ai-graphic')
              }
            } catch (err) {
              if (!firstErr) firstErr = err
            }
          }),
        )
        if (runIdRef.current !== myRun) return
        if (anyOk) {
          setGenerating(false)
          setHistory(pushHistory(clean))
          return
        }
        const msg = firstErr instanceof DOMException && firstErr.name === 'TimeoutError'
          ? t('dsAi.toast.timeout')
          : firstErr instanceof Error ? firstErr.message : t('dsAi.toast.genFailed')
        toast(msg, 'info')
        // fall through to the on-device engine so the user still gets something usable
      }

      // On-device vector concepts (no key, or the live call failed) — revealed as they compose.
      const all = generateConcepts(clean, { baseSeed: base }).slice(0, 1)
      for (let i = 0; i < all.length; i += 1) {
        await new Promise((r) => setTimeout(r, REVEAL_MS))
        if (runIdRef.current !== myRun) return // superseded by a newer run
        setConcepts((prev) => [...prev, all[i]])
        setProgress(i + 1)
      }
      setGenerating(false)
      setHistory(pushHistory(clean))
    },
    [toast, t],
  )

  // Generate whenever the modal opens with a prompt, or the incoming prompt/mode changes.
  useEffect(() => {
    if (!open) return
    setMode(initialMode)
    modeRef.current = initialMode
    setPrompt(initialPrompt)
    // With a real prompt the intent is already known (a routed command). Embedded in the rail we only
    // PRE-FILL it (the panel is always there — auto-running on every mount/switch would be surprising);
    // as a modal we generate straight away. Opened empty → show the Design/Edit-Garment chooser.
    if (initialPrompt.trim()) {
      setChoosing(false)
      if (!embedded) void run(initialPrompt, true)
    } else {
      setChoosing(true)
      if (!embedded) setTimeout(() => firstChoiceRef.current?.focus(), 0) // move focus into the dialog
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialPrompt, initialMode])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      // Non-modal side panel: Escape closes (or exits zoom). Focus is NOT trapped — the canvas stays
      // reachable so you can keep working while the panel is open.
      if (e.key === 'Escape') {
        if (zoom) setZoom(null)
        else onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, zoom])

  // On close, supersede any in-flight run (its post-await/setTimeout work bails at the runId guard),
  // abort a live request, and clear transient per-session UI so nothing leaks into the next open.
  useEffect(() => {
    if (open) return
    runIdRef.current += 1
    abortRef.current?.abort()
    setGenerating(false)
    setProgress(0)
    setZoom(null)
    setFavs([])
    setBusyIdx(null)
    setChoosing(false)
    setHistoryOpen(false)
    setFinalizingIds(new Set())
    setReferences([]) // reference images must not leak into (and silently steer) the next session
    setDragging(false)
    dragDepth.current = 0
  }, [open])

  if (!open) return null

  const submit = () => run(prompt, true)
  // Back to the "Design a Graphic vs Edit the Garment" chooser (e.g. you picked Graphic but meant Garment).
  const backToChooser = () => {
    setChoosing(true)
    setConcepts([])
    setHistoryOpen(false)
  }
  // Commit the upfront choice: set the mode, leave the ask, and focus the prompt so the user types next.
  const pickMode = (m: AiMode) => {
    setMode(m)
    modeRef.current = m
    setConcepts([])
    setChoosing(false)
    setTimeout(() => inputRef.current?.focus(), 0)
  }
  const switchMode = (m: AiMode) => {
    if (m === mode) return
    setMode(m)
    modeRef.current = m
    setConcepts([])
    setReferences([]) // references are mode-specific (graphic style vs garment example) — don't leak
    if (prompt.trim()) void run(prompt, true)
  }
  const applySuggestion = (add: string) => {
    const next = `${prompt.trim()} ${add}`.replace(/\s+/g, ' ').trim()
    setPrompt(next)
    void run(next, true)
  }
  const regenOne = async (idx: number) => {
    const old = concepts[idx]
    if (!old || busyIdx !== null) return
    // Replace the card AND re-key its favorite entry so a favorited card keeps its filled heart.
    const rekey = (next: Concept) => {
      setConcepts((prev) => prev.map((x, i) => (i === idx ? next : x)))
      setFavs((f) => (f.some((x) => x.id === old.id) ? f.map((x) => (x.id === old.id ? next : x)) : f))
    }
    if (old.isLive && hasImageAi()) {
      const myRun = runIdRef.current
      setBusyIdx(idx)
      try {
        const urls = await generateImages(graphicPrompt(old.prompt), { n: 1, references: refsRef.current, size: '1024x1024', quality: 'high', signal: abortRef.current?.signal })
        if (runIdRef.current !== myRun) return // modal closed / superseded
        if (urls[0]) {
          const rawUrl = urls[0]
          const fresh = liveConcept(old.prompt, rawUrl, (old.seed + 0x51ed270b) >>> 0)
          rekey(fresh) // show the raw result immediately
          setFinalizingIds((s) => new Set(s).add(fresh.id))
          removeImageBackground(rawUrl, abortRef.current?.signal).then((cut) => {
            if (runIdRef.current !== myRun) return
            const finalUrl = cut || rawUrl
            if (finalUrl !== rawUrl) {
              setConcepts((prev) => prev.map((c) => (c && c.id === fresh.id ? { ...c, dataUrl: finalUrl } : c)))
              setFavs((f) => f.map((x) => (x.id === fresh.id ? { ...x, dataUrl: finalUrl } : x)))
            }
            if (userId) void saveGeneratedAsset({ userId, dataUrl: finalUrl, name: `${old.prompt.slice(0, 36)} (v2)`, category: mode === 'garment' ? 'garment-edit' : 'ai-graphic' })
          }).finally(() => setFinalizingIds((s) => { const n = new Set(s); n.delete(fresh.id); return n }))
        }
      } catch (err) {
        if (runIdRef.current === myRun) toast(err instanceof Error ? err.message : t('dsAi.toast.regenFailed'), 'info')
      } finally {
        // Always release the busy slot (scoped to this card so it never stomps a newer regenerate).
        // A superseding run() aborts our request but never sets busyIdx, so gating this on runId used
        // to leave the spinner — and every regenerate button — stuck for the rest of the session.
        setBusyIdx((cur) => (cur === idx ? null : cur))
      }
      return
    }
    rekey(regenerateConcept(old.prompt, old.seed, idx))
  }
  const toggleFav = (c: Concept) => {
    setFavs((prev) => (prev.some((f) => f.id === c.id) ? prev.filter((f) => f.id !== c.id) : [...prev, c]))
  }
  const isFav = (c: Concept) => favs.some((f) => f.id === c.id)
  const download = async (c: Concept) => {
    const stem = `${slugify(c.prompt) || 'concept'}-${c.seed.toString(36)}`
    if (c.svg) {
      downloadBlob(new Blob([c.svg], { type: 'image/svg+xml' }), `${stem}.svg`)
      toast(t('dsAi.toast.downloadedSvg'), 'success')
    } else {
      const blob = await fetch(c.dataUrl).then((r) => r.blob())
      downloadBlob(blob, `${stem}.png`)
      toast(t('dsAi.toast.downloadedPng'), 'success')
    }
  }
  const add = (c: Concept) => {
    onAddToCanvas(c)
    onClose()
  }
  // Add one or many images as references (from the file picker OR a drag-and-drop), honoring the
  // 3-image cap. Non-images are ignored with a nudge; an overflow drop fills the remaining slots.
  const addReferenceFiles = async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith('image/'))
    if (images.length === 0) {
      if (files.length > 0) toast(t('dsAi.toast.useImageFiles'), 'info')
      return
    }
    const room = Math.max(0, 3 - refsRef.current.length)
    if (room === 0) {
      toast(t('dsAi.toast.maxReferences'), 'info')
      return
    }
    const dataUrls = await Promise.all(images.slice(0, room).map((f) => blobToDataUrl(f)))
    setReferences((prev) => [...prev, ...dataUrls].slice(0, 3))
    if (images.length > room) toast(t('dsAi.toast.addedSome', { n: room }), 'info')
  }

  // Drag-and-drop reference images anywhere on the modal. Only active once a real image model is
  // connected (`live`) and not while the Design/Edit chooser is up — references do nothing otherwise.
  const dndActive = () => live && !choosing
  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes('Files')
  const onDragEnter = (e: React.DragEvent) => {
    if (!dndActive() || !hasFiles(e)) return
    e.preventDefault()
    dragDepth.current += 1
    setDragging(true)
  }
  const onDragOver = (e: React.DragEvent) => {
    if (!dndActive() || !hasFiles(e)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }
  const onDragLeave = () => {
    if (!dndActive()) return
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDragging(false)
  }
  const onDrop = (e: React.DragEvent) => {
    if (!dndActive()) return
    e.preventDefault()
    dragDepth.current = 0
    setDragging(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length) void addReferenceFiles(files)
  }

  const suggestions = mode === 'garment' ? GARMENT_SUGGESTIONS : mode === 'create' ? CREATE_SUGGESTIONS : SUGGESTIONS
  const engineNote =
    mode === 'garment'
      ? isLiveConceptAi()
        ? t('dsAi.note.garmentLive')
        : t('dsAi.note.garmentDead')
      : mode === 'create'
        ? isLiveConceptAi()
          ? t('dsAi.note.createLive')
          : t('dsAi.note.createDead')
        : isLiveConceptAi()
          ? t('dsAi.note.graphicLive')
          : t('dsAi.note.graphicDead')

  const body = (
    <div className={`suite${embedded ? ' tai-embed-root' : ''}`}>
      {/* No blocking scrim — loom studios AI is a side panel (right-docked as a modal, or embedded in the
          Library rail) so the canvas stays usable while it's open — generation can take a moment. */}
      <div
        className={`tai ${embedded ? 'tai--embed' : 'tai--panel'}`}
        role={embedded ? 'region' : 'dialog'}
        aria-labelledby="tai-title"
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {dragging && (
          <div className="tai__drop" aria-hidden="true">
            <div className="tai__drop-card">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 15V3m0 0L8 7m4-4 4 4" />
                <path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
              </svg>
              <b>{mode === 'garment' ? t('dsAi.drop.example') : mode === 'create' ? t('dsAi.drop.styleRef') : t('dsAi.drop.reference')}</b>
              <span>{mode === 'garment' ? t('dsAi.dropSub.garment') : mode === 'create' ? t('dsAi.dropSub.create') : t('dsAi.dropSub.graphic')}</span>
            </div>
          </div>
        )}
        {/* Header */}
        <header className="tai__head">
          {!choosing && (
            <button type="button" className="tai__back" onClick={backToChooser} title={t('dsAi.back.title')} aria-label={t('dsAi.back.aria')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
          )}
          <span className="tai__title" id="tai-title">
            <IcoSparkle width="18" height="18" />
            loom studios AI
          </span>
          {!choosing && (
            <div className="tai__modes" role="tablist" aria-label={t('dsAi.modes.aria')}>
              <button type="button" role="tab" aria-selected={mode === 'graphic'} className={`tai__mode${mode === 'graphic' ? ' is-active' : ''}`} onClick={() => switchMode('graphic')}>{t('dsAi.mode.graphic')}</button>
              <button type="button" role="tab" aria-selected={mode === 'create'} className={`tai__mode${mode === 'create' ? ' is-active' : ''}`} onClick={() => switchMode('create')}>{t('dsAi.mode.create')}</button>
              <button type="button" role="tab" aria-selected={mode === 'garment'} className={`tai__mode${mode === 'garment' ? ' is-active' : ''}`} onClick={() => switchMode('garment')}>{t('dsAi.mode.edit')}</button>
            </div>
          )}
          {!embedded && (
          <button type="button" className={`tai__x${choosing ? ' tai__x--solo' : ''}`} aria-label={t('dsAi.close')} onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
          )}
        </header>

        {choosing ? (
          <div className="tai-chooser">
            <div className="tai-chooser__head">
              <b>{t('dsAi.chooser.title')}</b>
              <span>{t('dsAi.chooser.sub')}</span>
            </div>
            <div className="tai-chooser__cards">
              <button ref={firstChoiceRef} type="button" className="tai-choice tai-choice--graphic" onClick={() => pickMode('graphic')}>
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
              <button type="button" className="tai-choice tai-choice--create" onClick={() => pickMode('create')}>
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
              <button type="button" className="tai-choice tai-choice--garment" onClick={() => pickMode('garment')}>
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
          </div>
        ) : (
        <>
        {/* Prompt row — the input gets its own full-width line; the actions sit below so nothing is cramped */}
        <div className="tai__prompt">
          <div className="tai__prompt-field">
            <IcoSparkle width="16" height="16" />
            <input
              ref={inputRef}
              className="tai__input"
              value={prompt}
              placeholder={mode === 'garment' ? t('dsAi.ph.garment') : mode === 'create' ? t('dsAi.ph.create') : t('dsAi.ph.graphic')}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              aria-label={t('dsAi.promptAria')}
            />
          </div>
          <div className="tai__prompt-actions">
            {live && (
              <>
                <button type="button" className="tai__ghost" title={mode === 'garment' ? t('dsAi.upload.garmentTitle') : mode === 'create' ? t('dsAi.upload.createTitle') : t('dsAi.upload.graphicTitle')} onClick={() => fileRef.current?.click()} disabled={references.length >= 3}>
                  + {mode === 'garment' ? t('dsAi.upload.example') : mode === 'create' ? t('dsAi.upload.style') : t('dsAi.upload.reference')}
                </button>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => { void addReferenceFiles(Array.from(e.target.files ?? [])); e.target.value = '' }} />
              </>
            )}
            <div className="tai__hist-wrap">
              <button type="button" className="tai__ghost" onClick={() => setHistoryOpen((v) => !v)} aria-expanded={historyOpen} disabled={history.length === 0}>
                {t('dsAi.history')}
              </button>
              {historyOpen && history.length > 0 && (
                <div className="tai__hist" role="menu">
                  {history.map((h) => (
                    <button key={h} type="button" className="tai__hist-item" onClick={() => { setHistoryOpen(false); setPrompt(h); void run(h, true) }}>
                      {h}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button type="button" className="tai__go" onClick={submit} disabled={!prompt.trim() || generating}>
              {generating ? (live ? t('dsAi.generating') : t('dsAi.composing')) : t('dsAi.generate')}
            </button>
          </div>
        </div>

        {references.length > 0 && (
          <div className="tai__refs">
            <span className="tai__refs-label">{mode === 'garment' ? t('dsAi.refs.examples') : mode === 'create' ? t('dsAi.refs.styleRefs') : t('dsAi.refs.references')}</span>
            {references.map((r, i) => (
              <span key={i} className="tai-ref tai-checker">
                <img src={r} alt={t('dsAi.refAlt', { n: i + 1 })} />
                <button type="button" className="tai-ref__x" aria-label={t('dsAi.removeRef')} onClick={() => setReferences((prev) => prev.filter((_, j) => j !== i))}>×</button>
              </span>
            ))}
          </div>
        )}

        {/* Tags + progress */}
        <div className="tai__meta">
          <div className="tai__tags">
            {concepts[0]?.tags.map((t) => (
              <span key={t} className="tai__tag">{t}</span>
            ))}
          </div>
          {generating && <div className="tai__bar" role="progressbar" aria-valuemin={0} aria-valuemax={1} aria-valuenow={progress}><span style={{ width: `${Math.max(8, progress * 100)}%` }} /></div>}
        </div>

        {/* Concepts */}
        <div className="tai__grid">
          {!generating && concepts.length === 0 ? (
            <div className="tai-empty">
              <IcoSparkle width="26" height="26" />
              <b>{mode === 'garment' ? t('dsAi.empty.garmentTitle') : mode === 'create' ? t('dsAi.empty.createTitle') : t('dsAi.empty.graphicTitle')}</b>
              <span>
                {mode === 'garment'
                  ? t('dsAi.empty.garmentDesc')
                  : mode === 'create'
                    ? t('dsAi.empty.createDesc')
                    : t('dsAi.empty.graphicDesc')}
              </span>
            </div>
          ) : (
          [0].map((i) => {
            const c = concepts[i]
            if (!c)
              return (
                <div key={i} className="tai-card tai-card--loading" aria-label={t('dsAi.card.generatingAria')}>
                  <span className="tai-card__spin" />
                  <span className="tai-card__loading-label">{generating ? (live ? t('dsAi.generating') : t('dsAi.composing')) : t('dsAi.ready')}</span>
                </div>
              )
            return (
              <article key={c.id} className="tai-card">
                <div className="tai-card__stage tai-checker">
                  <img src={c.dataUrl} alt={t('dsAi.card.conceptAlt', { prompt: c.prompt, n: i + 1 })} />
                  {busyIdx === i && <span className="tai-card__busy"><span className="tai-card__spin" /></span>}
                  <span className="tai-card__num">{i + 1}</span>
                  <button type="button" className={`tai-card__fav${isFav(c) ? ' is-on' : ''}`} aria-label={isFav(c) ? t('dsAi.unfavorite') : t('dsAi.favorite')} aria-pressed={isFav(c)} onClick={() => toggleFav(c)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill={isFav(c) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8"><path d="M12 20s-7-4.4-9.2-8.3C1 8.5 2.6 5 6 5c2 0 3.2 1.2 4 2.3C10.8 6.2 12 5 14 5c3.4 0 5 3.5 3.2 6.7C19 15.6 12 20 12 20Z" /></svg>
                  </button>
                  <div className="tai-card__hover">
                    <button type="button" title={t('dsAi.zoom')} aria-label={t('dsAi.zoom')} onClick={() => setZoom(c)}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5M11 8v6M8 11h6" /></svg>
                    </button>
                    <button type="button" title={t('dsAi.downloadSvg')} aria-label={t('dsAi.download')} onClick={() => download(c)}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v10m0 0l-4-4m4 4l4-4M5 19h14" /></svg>
                    </button>
                    <button type="button" title={t('dsAi.regenTitle')} aria-label={t('dsAi.regen')} onClick={() => regenOne(i)}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12a8 8 0 0 1 14-5m2-3v5h-5M20 12a8 8 0 0 1-14 5m-2 3v-5h5" /></svg>
                    </button>
                  </div>
                </div>
                <div className="tai-card__foot">
                  <span className="tai-card__style">{mode === 'garment' ? t('dsAi.card.editedGarment') : mode === 'create' ? t('dsAi.card.newGarment') : c.styleLabel}</span>
                  {(mode === 'garment' || mode === 'create') && onApplyGarment ? (
                    <button type="button" className="tai-card__add" disabled={finalizingIds.has(c.id)} onClick={() => { onApplyGarment(c.dataUrl); onClose() }}>{finalizingIds.has(c.id) ? t('dsAi.preparing') : mode === 'create' ? t('dsAi.useGarment') : t('dsAi.applyGarment')}</button>
                  ) : (
                    <button type="button" className="tai-card__add" disabled={finalizingIds.has(c.id)} onClick={() => add(c)}>{finalizingIds.has(c.id) ? t('dsAi.preparing') : t('dsAi.addToCanvas')}</button>
                  )}
                </div>
              </article>
            )
          })
          )}
        </div>

        {/* Keep creating */}
        <div className="tai__suggest">
          <span className="tai__suggest-label">{t('dsAi.keepCreating')}</span>
          <div className="tai__chips">
            {suggestions.map((s) => (
              <button key={s.k} type="button" className="tai__chip" disabled={generating} onClick={() => applySuggestion(s.add)}>
                {t(s.k)}
              </button>
            ))}
            <button type="button" className="tai__chip tai__chip--more" disabled={generating || !prompt.trim()} onClick={() => run(prompt, false)}>
              {t('dsAi.generateMore')}
            </button>
          </div>
        </div>

        {favs.length > 0 && (
          <div className="tai__favs">
            <span className="tai__suggest-label">{t('dsAi.favorites')}</span>
            <div className="tai__favs-strip">
              {favs.map((f) => (
                <button key={f.id} type="button" className="tai-fav tai-checker" title={t('dsAi.fav.title', { prompt: f.prompt })} onClick={() => add(f)}>
                  <img src={f.dataUrl} alt={f.prompt} />
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="tai__note">{engineNote}</p>
        </>
        )}
      </div>

      {zoom && (
        <div className="tai-zoom" onClick={() => setZoom(null)} role="dialog" aria-label={t('dsAi.zoomAria')}>
          <div className="tai-zoom__inner tai-checker" onClick={(e) => e.stopPropagation()}>
            <img src={zoom.dataUrl} alt={zoom.prompt} />
            <div className="tai-zoom__bar">
              <span>{zoom.prompt} · {zoom.styleLabel}</span>
              <div>
                <button type="button" className="tai__ghost" onClick={() => download(zoom)}>{t('dsAi.download')}</button>
                <button type="button" className="tai-card__add" disabled={finalizingIds.has(zoom.id)} onClick={() => add(zoom)}>{finalizingIds.has(zoom.id) ? t('dsAi.preparing') : t('dsAi.addToCanvas')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
  return embedded ? body : createPortal(body, document.body)
}
