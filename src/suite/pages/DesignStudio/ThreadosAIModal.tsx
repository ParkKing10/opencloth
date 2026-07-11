import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IcoSparkle } from '../../components/ui/Icons'
import { useToast } from '../../components/ui/Toast'
import { downloadBlob, slugify } from '../../lib/download'
import { generateConcepts, regenerateConcept, isLiveConceptAi, type Concept } from '../../ai/conceptEngine'
import { hashSeed } from '../../ai/rng'
import './threados-ai.css'

/** Creative follow-ups the engine can honestly deliver: each re-generates with the added intent. */
const SUGGESTIONS: { label: string; add: string }[] = [
  { label: 'Make it chrome', add: 'chrome' },
  { label: 'Neon glow', add: 'neon glow' },
  { label: 'Vintage wash', add: 'vintage distressed' },
  { label: 'Gothic', add: 'gothic' },
  { label: 'Gold', add: 'gold metallic' },
  { label: 'Graffiti', add: 'graffiti spray' },
  { label: 'More aggressive', add: 'aggressive sharp' },
  { label: 'Cleaner', add: 'clean minimal' },
  { label: 'More luxurious', add: 'luxury premium' },
]

const HISTORY_KEY = 'threados-ai-history-v1'
const REVEAL_MS = 90

function loadHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
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
  onClose: () => void
  onAddToCanvas: (concept: Concept) => void
}

/**
 * THREADOS AI — the creative workspace. Type an idea, get three real transparent vector concepts,
 * keep steering with suggestions, then Add to Canvas. Honest about the engine: on-device vector
 * synthesis today (isLiveConceptAi() === false), same UI when a diffusion model connects later.
 */
export function ThreadosAIModal({ open, initialPrompt, onClose, onAddToCanvas }: Props) {
  const toast = useToast()
  const [prompt, setPrompt] = useState(initialPrompt)
  const [concepts, setConcepts] = useState<Concept[]>([])
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [favs, setFavs] = useState<Concept[]>([])
  const [zoom, setZoom] = useState<Concept | null>(null)
  const [history, setHistory] = useState<string[]>(loadHistory)
  const [historyOpen, setHistoryOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const runIdRef = useRef(0)
  const nonceRef = useRef(0)

  const run = useCallback(async (p: string, fresh: boolean) => {
    const clean = p.trim()
    if (!clean) return
    if (fresh) nonceRef.current = 0
    else nonceRef.current += 1
    const base = (hashSeed(clean.toLowerCase()) ^ (nonceRef.current * 0x27d4eb2f)) >>> 0
    const myRun = ++runIdRef.current
    setGenerating(true)
    setConcepts([])
    setProgress(0)
    const all = generateConcepts(clean, { baseSeed: base })
    for (let i = 0; i < all.length; i++) {
      await new Promise((r) => setTimeout(r, REVEAL_MS))
      if (runIdRef.current !== myRun) return // superseded by a newer run
      setConcepts((prev) => [...prev, all[i]])
      setProgress(i + 1)
    }
    setGenerating(false)
    setHistory(pushHistory(clean))
  }, [])

  // Generate whenever the modal opens with a prompt, or the incoming prompt changes.
  useEffect(() => {
    if (!open) return
    setPrompt(initialPrompt)
    void run(initialPrompt, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialPrompt])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (zoom) setZoom(null)
        else onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, zoom])

  if (!open) return null

  const submit = () => run(prompt, true)
  const applySuggestion = (add: string) => {
    const next = `${prompt.trim()} ${add}`.replace(/\s+/g, ' ').trim()
    setPrompt(next)
    void run(next, true)
  }
  const regenOne = (idx: number) => {
    setConcepts((prev) => prev.map((c, i) => (i === idx ? regenerateConcept(c.prompt, c.seed) : c)))
  }
  const toggleFav = (c: Concept) => {
    setFavs((prev) => (prev.some((f) => f.id === c.id) ? prev.filter((f) => f.id !== c.id) : [...prev, c]))
  }
  const isFav = (c: Concept) => favs.some((f) => f.id === c.id)
  const download = (c: Concept) => {
    downloadBlob(new Blob([c.svg], { type: 'image/svg+xml' }), `${slugify(c.prompt) || 'concept'}-${c.seed.toString(36)}.svg`)
    toast('Concept downloaded as SVG.', 'success')
  }
  const add = (c: Concept) => {
    onAddToCanvas(c)
    onClose()
  }

  const engineNote = isLiveConceptAi()
    ? 'Live AI image model connected.'
    : 'THREADOS concept engine · transparent vector graphics generated on-device. Connect an image model later for photoreal renders — same workflow.'

  return createPortal(
    <div className="suite">
      <div className="tai-scrim" onClick={onClose} />
      <div className="tai" role="dialog" aria-modal="true" aria-labelledby="tai-title">
        {/* Header */}
        <header className="tai__head">
          <span className="tai__title" id="tai-title">
            <IcoSparkle width="18" height="18" />
            THREADOS AI
          </span>
          <button type="button" className="tai__x" aria-label="Close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </header>

        {/* Prompt row */}
        <div className="tai__prompt">
          <IcoSparkle width="16" height="16" />
          <input
            ref={inputRef}
            className="tai__input"
            value={prompt}
            placeholder="Describe your graphic — “chrome tribal star”, “vintage skull with roses”…"
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            aria-label="Design prompt"
          />
          <div className="tai__prompt-actions">
            <div className="tai__hist-wrap">
              <button type="button" className="tai__ghost" onClick={() => setHistoryOpen((v) => !v)} aria-expanded={historyOpen} disabled={history.length === 0}>
                History
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
              {generating ? `Composing ${progress}/3…` : 'Generate'}
            </button>
          </div>
        </div>

        {/* Tags + progress */}
        <div className="tai__meta">
          <div className="tai__tags">
            {concepts[0]?.tags.map((t) => (
              <span key={t} className="tai__tag">{t}</span>
            ))}
          </div>
          {generating && <div className="tai__bar"><span style={{ width: `${(progress / 3) * 100}%` }} /></div>}
        </div>

        {/* Concepts */}
        <div className="tai__grid">
          {[0, 1, 2].map((i) => {
            const c = concepts[i]
            if (!c) return <div key={i} className="tai-card tai-card--loading" aria-hidden><span className="tai-card__spin" /></div>
            return (
              <article key={c.id} className="tai-card">
                <div className="tai-card__stage tai-checker">
                  <img src={c.dataUrl} alt={`${c.prompt} concept ${i + 1}`} />
                  <span className="tai-card__num">{i + 1}</span>
                  <button type="button" className={`tai-card__fav${isFav(c) ? ' is-on' : ''}`} aria-label={isFav(c) ? 'Unfavorite' : 'Favorite'} aria-pressed={isFav(c)} onClick={() => toggleFav(c)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill={isFav(c) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8"><path d="M12 20s-7-4.4-9.2-8.3C1 8.5 2.6 5 6 5c2 0 3.2 1.2 4 2.3C10.8 6.2 12 5 14 5c3.4 0 5 3.5 3.2 6.7C19 15.6 12 20 12 20Z" /></svg>
                  </button>
                  <div className="tai-card__hover">
                    <button type="button" title="Zoom" aria-label="Zoom" onClick={() => setZoom(c)}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5M11 8v6M8 11h6" /></svg>
                    </button>
                    <button type="button" title="Download SVG" aria-label="Download" onClick={() => download(c)}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v10m0 0l-4-4m4 4l4-4M5 19h14" /></svg>
                    </button>
                    <button type="button" title="Regenerate this one" aria-label="Regenerate" onClick={() => regenOne(i)}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12a8 8 0 0 1 14-5m2-3v5h-5M20 12a8 8 0 0 1-14 5m-2 3v-5h5" /></svg>
                    </button>
                  </div>
                </div>
                <div className="tai-card__foot">
                  <span className="tai-card__style">{c.styleLabel}</span>
                  <button type="button" className="tai-card__add" onClick={() => add(c)}>Add to Canvas</button>
                </div>
              </article>
            )
          })}
        </div>

        {/* Keep creating */}
        <div className="tai__suggest">
          <span className="tai__suggest-label">Keep creating</span>
          <div className="tai__chips">
            {SUGGESTIONS.map((s) => (
              <button key={s.label} type="button" className="tai__chip" disabled={generating} onClick={() => applySuggestion(s.add)}>
                {s.label}
              </button>
            ))}
            <button type="button" className="tai__chip tai__chip--more" disabled={generating || !prompt.trim()} onClick={() => run(prompt, false)}>
              ↻ Generate 3 more
            </button>
          </div>
        </div>

        {favs.length > 0 && (
          <div className="tai__favs">
            <span className="tai__suggest-label">Favorites</span>
            <div className="tai__favs-strip">
              {favs.map((f) => (
                <button key={f.id} type="button" className="tai-fav tai-checker" title={`${f.prompt} — Add to Canvas`} onClick={() => add(f)}>
                  <img src={f.dataUrl} alt={f.prompt} />
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="tai__note">{engineNote}</p>
      </div>

      {zoom && (
        <div className="tai-zoom" onClick={() => setZoom(null)} role="dialog" aria-label="Concept preview">
          <div className="tai-zoom__inner tai-checker" onClick={(e) => e.stopPropagation()}>
            <img src={zoom.dataUrl} alt={zoom.prompt} />
            <div className="tai-zoom__bar">
              <span>{zoom.prompt} · {zoom.styleLabel}</span>
              <div>
                <button type="button" className="tai__ghost" onClick={() => download(zoom)}>Download</button>
                <button type="button" className="tai-card__add" onClick={() => add(zoom)}>Add to Canvas</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}
