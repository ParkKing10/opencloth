import { useCallback, useEffect, useRef, useState } from 'react'
import { usePresentation } from './PresentationContext'
import { emitPresentationCue } from './presentationBus'
import { prefersReducedMotion } from './presentation'
import { SCENES, type TxKind } from './scenes'
import { BUTTERFLY_MOTIF, DISTRESS_HOLES, HOODIE_IMG, MODEL_IMG, WASHED_BLACK } from './presentationDemoData'
import './presentation.css'

// The always-mounted presentation surface. Renders NOTHING for normal users (active === false).
// For an admin with Presentation Mode on it shows the launcher; ▶ plays the ~15s spot: ONE hoodie,
// six prompts, transformed live on a solid-black stage. The hoodie is never replaced — each command
// mutates the same garment.

// The garment's cumulative state. Flags only ever turn ON during a run (start() resets them).
type Tx = {
  typed: string
  caret: boolean
  armed: boolean // Generate pressed
  generating: boolean // brief "thinking" shimmer
  created: boolean
  oversized: boolean
  holes: boolean
  butterfly: boolean
  color: string // '' or hex
  mockup: boolean
  endmark: boolean // closing wordmark over the mockup
}

const INITIAL: Tx = {
  typed: '',
  caret: true,
  armed: false,
  generating: false,
  created: false,
  oversized: false,
  holes: false,
  butterfly: false,
  color: '',
  mockup: false,
  endmark: false,
}

export function PresentationOverlay() {
  const { active } = usePresentation()

  const [playing, setPlaying] = useState(false)
  const [sceneIndex, setSceneIndex] = useState(-1)
  const [tx, setTx] = useState<Tx>(INITIAL)
  const [cursor, setCursor] = useState<{ x: number; y: number; down: boolean; show: boolean }>({ x: 0, y: 0, down: false, show: false })
  const [finished, setFinished] = useState(false)

  const tokenRef = useRef(0)
  const patch = useCallback((p: Partial<Tx>) => setTx((s) => ({ ...s, ...p })), [])

  // Expose a click cue for every pointer interaction while presenting (future sound design).
  useEffect(() => {
    if (!active) return
    const onDown = () => emitPresentationCue('click')
    window.addEventListener('pointerdown', onDown, { passive: true })
    return () => window.removeEventListener('pointerdown', onDown)
  }, [active])

  // Kill the show if the admin turns the mode off.
  useEffect(() => {
    if (!active && playing) {
      tokenRef.current++
      setPlaying(false)
    }
  }, [active, playing])

  const stop = useCallback(() => {
    tokenRef.current++
    setPlaying(false)
    setTx(INITIAL)
    setCursor((c) => ({ ...c, show: false, down: false }))
    setSceneIndex(-1)
    setFinished(false)
  }, [])

  const start = useCallback(() => {
    setFinished(false)
    setTx(INITIAL)
    setPlaying(true)
  }, [])

  // ── Director — one continuous conversation with the hoodie ──────────────────────────────────────
  useEffect(() => {
    if (!playing) return
    const token = ++tokenRef.current
    const alive = () => token === tokenRef.current
    const reduce = prefersReducedMotion()
    const T = (ms: number) => (reduce ? Math.min(ms, 80) : ms)
    const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, T(ms)))

    const moveCursor = async (x: number, y: number, ms = 500) => {
      setCursor((c) => ({ ...c, x, y, show: true }))
      await sleep(ms)
    }
    const moveTo = async (sel: string, ms = 500) => {
      const el = document.querySelector(sel)
      if (el) {
        const r = el.getBoundingClientRect()
        await moveCursor(r.left + r.width / 2, r.top + r.height / 2, ms)
      } else {
        await sleep(ms)
      }
    }
    const click = async () => {
      emitPresentationCue('click')
      setCursor((c) => ({ ...c, down: true }))
      await sleep(120)
      setCursor((c) => ({ ...c, down: false }))
      await sleep(70)
    }
    const type = async (text: string) => {
      for (let i = 1; i <= text.length; i++) {
        if (!alive()) return
        emitPresentationCue('type')
        patch({ typed: text.slice(0, i) })
        await sleep(reduce ? 4 : 24)
      }
    }

    async function runShow() {
      await sleep(360)
      await moveTo('.pm-prompt__input', 520)
      for (let i = 0; i < SCENES.length; i++) {
        if (!alive()) return
        const sc = SCENES[i]
        setSceneIndex(i)
        emitPresentationCue('scene', sc.id)
        // fresh command
        patch({ typed: '', armed: false })
        await sleep(160)
        await type(sc.prompt)
        await sleep(240)
        // press Generate
        await moveTo('.pm-prompt__go', 360)
        await click()
        emitPresentationCue('generate')
        patch({ armed: true, generating: true })
        await sleep(reduce ? 100 : 520) // the garment "thinks"
        if (!alive()) return
        patch({ generating: false })
        applyTx(sc.apply, patch)
        emitPresentationCue(sc.apply === 'mockup' ? 'success' : 'reveal')
        // let the transformation settle
        await sleep(reduce ? 160 : sc.apply === 'mockup' ? 900 : 820)
        if (sc.apply === 'mockup') {
          patch({ endmark: true })
          await sleep(reduce ? 200 : 1500)
        }
      }
      if (!alive()) return
      setCursor((c) => ({ ...c, show: false }))
      setFinished(true)
      setPlaying(false)
    }

    void runShow()
    return () => {
      tokenRef.current++
    }
    // Only `playing` (re)starts or stops the director; patch is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing])

  if (!active) return null

  return (
    <div className={`pm-root${playing ? ' is-playing' : ''}`} aria-hidden={!playing}>
      {playing && (
        <div className="pm-veil pm-veil--tx">
          <div className="pm-stage pm-stage--tx">
            <div
              className={`pm-tx${tx.created ? ' is-created' : ''}${tx.oversized ? ' is-oversized' : ''}${tx.mockup ? ' is-mockup' : ''}`}
            >
              <div className="pm-tx__flat">
                <img className="pm-tx__hoodie" src={HOODIE_IMG} alt="" draggable={false} />
                {tx.color && (
                  <div
                    className="pm-tx__recolor"
                    style={{ background: tx.color, WebkitMaskImage: `url(${HOODIE_IMG})`, maskImage: `url(${HOODIE_IMG})` }}
                  />
                )}
                {tx.holes && (
                  <div className="pm-tx__holes">
                    {DISTRESS_HOLES.map((h) => (
                      <span
                        key={h.id}
                        className="pm-tx__hole"
                        style={{ left: h.x, top: h.y, transform: `translate(-50%, -50%) scale(${h.scale}) rotate(${h.rot}deg)` }}
                      >
                        <HoleMark />
                      </span>
                    ))}
                  </div>
                )}
                {tx.butterfly && (
                  <div className="pm-tx__print">
                    <ButterflyPrint />
                  </div>
                )}
                {tx.generating && <span className="pm-tx__shimmer" aria-hidden="true" />}
              </div>
              <img className="pm-tx__model" src={MODEL_IMG} alt="" draggable={false} />
              {tx.endmark && (
                <div className="pm-tx__endmark">
                  <div className="pm-tx__brand">loom studios</div>
                  <div className="pm-tx__tag">Just describe it.</div>
                </div>
              )}
            </div>

            <div className="pm-prompt-wrap">
              <div className={`pm-prompt${tx.generating ? ' is-busy' : ''}`}>
                <span className="pm-prompt__spark">✦</span>
                <div className="pm-prompt__input">
                  {tx.typed}
                  <span className={`pm-prompt__caret${tx.caret ? ' is-on' : ''}`} />
                </div>
                <button className={`pm-prompt__go${tx.armed ? ' is-armed' : ''}`} type="button">
                  {tx.generating ? 'Generating…' : 'Generate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {cursor.show && (
        <div className={`pm-cursor${cursor.down ? ' is-down' : ''}`} style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)` }}>
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
            <path d="M4 2l6 16 2.5-6.5L19 9 4 2z" fill="#fff" stroke="#0b0b10" strokeWidth="1.2" strokeLinejoin="round" />
          </svg>
        </div>
      )}

      {!playing && !finished && (
        <div className="pm-launch">
          <span className="pm-launch__badge">Presentation Mode</span>
          <button className="pm-launch__btn" type="button" onClick={start}>
            <span className="pm-launch__play">▶</span> Start Presentation
          </button>
        </div>
      )}

      {playing && (
        <div className="pm-hud">
          <div className="pm-hud__dots">
            {SCENES.map((s, i) => (
              <span key={s.id} className={`pm-dot${i === sceneIndex ? ' is-active' : ''}${i < sceneIndex ? ' is-done' : ''}`} />
            ))}
          </div>
          <button className="pm-hud__exit" type="button" onClick={stop}>
            Exit
          </button>
        </div>
      )}

      {finished && (
        <div className="pm-launch">
          <span className="pm-launch__badge">Replay the spot</span>
          <button className="pm-launch__btn" type="button" onClick={start}>
            <span className="pm-launch__play">↻</span> Replay
          </button>
          <button className="pm-launch__ghost" type="button" onClick={() => setFinished(false)}>
            Close
          </button>
        </div>
      )}
    </div>
  )
}

function applyTx(kind: TxKind, patch: (p: Partial<Tx>) => void) {
  switch (kind) {
    case 'create':
      patch({ created: true })
      break
    case 'oversized':
      patch({ oversized: true })
      break
    case 'holes':
      patch({ holes: true })
      break
    case 'butterfly':
      patch({ butterfly: true })
      break
    case 'color':
      patch({ color: WASHED_BLACK })
      break
    case 'mockup':
      patch({ mockup: true })
      break
  }
}

function ButterflyPrint() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id="pmchrome" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f2f4f8" />
          <stop offset="0.5" stopColor="#aab3c4" />
          <stop offset="1" stopColor="#5b6273" />
        </linearGradient>
      </defs>
      <g dangerouslySetInnerHTML={{ __html: BUTTERFLY_MOTIF }} />
    </svg>
  )
}

// A distress rip — a dark torn opening with a few frayed threads.
function HoleMark() {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <path d="M8 19 Q13 10 22 13 Q31 11 33 22 Q29 31 18 29 Q10 31 8 19Z" fill="rgba(6,6,9,0.94)" />
      <path
        d="M12 16 L20 25 M25 14 L18 27 M14 23 L27 20"
        stroke="rgba(206,200,188,0.55)"
        strokeWidth="0.8"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}
