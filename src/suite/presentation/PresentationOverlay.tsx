import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePresentation } from './PresentationContext'
import { emitPresentationCue } from './presentationBus'
import { prefersReducedMotion } from './presentation'
import { SCENES, type Scene, type SceneKind } from './scenes'
import {
  DEMO_COLLECTION,
  DEMO_COLORS,
  DEMO_GARMENT_PATHS,
  DEMO_GRAPHICS,
  DEMO_MANUFACTURERS,
  DEMO_MOCKUPS,
  DEMO_TECHPACK,
  type DemoGarmentGlyph,
} from './presentationDemoData'
import './presentation.css'

// The always-mounted presentation surface. Renders NOTHING for normal users (active === false).
// For an admin with Presentation Mode on it shows the launcher; pressing ▶ runs the scripted keynote
// as a cinematic overlay above the real app (which serves as an authentic, animated backdrop).

const COLLECTION_PROMPT = 'Create a luxury streetwear collection'

type StageState = {
  key: number
  kind: SceneKind | null
  typed: string
  caret: boolean
  entered: boolean
  chosen: number // graphics: chosen index
  heroGraphic: boolean // hero hoodie carries the placed graphic
  fabric: string // hero hoodie fabric colour
  colorName: string
  drag: 'idle' | 'grab' | 'move' | 'snap'
  mockup: number // active mockup index (kept for future sound cue granularity)
  tech: number // number of tech-pack sections revealed
}

const INITIAL_STAGE: StageState = {
  key: 0,
  kind: null,
  typed: '',
  caret: true,
  entered: false,
  chosen: 0,
  heroGraphic: false,
  fabric: DEMO_COLLECTION[0].fabric,
  drag: 'idle',
  colorName: '',
  mockup: 0,
  tech: 0,
}

function Silhouette({ glyph, fill }: { glyph: DemoGarmentGlyph; fill: string }) {
  return (
    <svg className="pm-sil" viewBox="0 0 200 200" aria-hidden="true">
      <path d={DEMO_GARMENT_PATHS[glyph]} fill={fill} stroke="rgba(0,0,0,0.22)" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

export function PresentationOverlay() {
  const { active } = usePresentation()
  const navigate = useNavigate()

  const [playing, setPlaying] = useState(false)
  const [sceneIndex, setSceneIndex] = useState(-1)
  const [caption, setCaption] = useState<{ title: string; subtitle: string } | null>(null)
  const [stage, setStage] = useState<StageState>(INITIAL_STAGE)
  const [cursor, setCursor] = useState<{ x: number; y: number; down: boolean; show: boolean }>({
    x: 0,
    y: 0,
    down: false,
    show: false,
  })
  const [spot, setSpot] = useState<{ x: number; y: number; on: boolean }>({ x: 50, y: 45, on: false })
  const [finished, setFinished] = useState(false)

  // Loop control — a token invalidates any in-flight director when we stop / restart / unmount.
  const tokenRef = useRef(0)
  const stageRef = useRef<StageState>(INITIAL_STAGE)
  stageRef.current = stage
  // Navigate via a ref: react-router changes the navigate() identity on every route change, so
  // depending on it would restart the whole show the moment a scene navigates. The ref stays current.
  const navRef = useRef(navigate)
  navRef.current = navigate

  const patchStage = useCallback((patch: Partial<StageState>) => {
    setStage((s) => ({ ...s, ...patch }))
  }, [])
  const enterStage = useCallback((kind: SceneKind) => {
    setStage((s) => ({ ...INITIAL_STAGE, key: s.key + 1, kind, fabric: s.fabric, heroGraphic: s.heroGraphic }))
  }, [])

  // Expose a click cue for every pointer interaction while presenting (future sound design).
  useEffect(() => {
    if (!active) return
    const onDown = () => emitPresentationCue('click')
    window.addEventListener('pointerdown', onDown, { passive: true })
    return () => window.removeEventListener('pointerdown', onDown)
  }, [active])

  // Kill the show if the admin turns the mode off entirely.
  useEffect(() => {
    if (!active && playing) {
      tokenRef.current++
      setPlaying(false)
    }
  }, [active, playing])

  const stop = useCallback(() => {
    tokenRef.current++
    setPlaying(false)
    setCaption(null)
    setStage(INITIAL_STAGE)
    setCursor((c) => ({ ...c, show: false, down: false }))
    setSpot((s) => ({ ...s, on: false }))
    setSceneIndex(-1)
    setFinished(false)
  }, [])

  const start = useCallback(() => {
    setFinished(false)
    setStage(INITIAL_STAGE)
    setPlaying(true)
  }, [])

  // ── The director loop ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!playing) return
    const token = ++tokenRef.current
    const alive = () => token === tokenRef.current
    const reduce = prefersReducedMotion()
    const T = (ms: number) => (reduce ? Math.min(ms, 120) : ms)

    const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, T(ms)))

    const moveCursor = async (x: number, y: number, ms = 620) => {
      setCursor((c) => ({ ...c, x, y, show: true }))
      await sleep(ms)
    }
    const moveTo = async (sel: string, ms = 620, dx = 0, dy = 0) => {
      const el = document.querySelector(sel)
      if (el) {
        const r = el.getBoundingClientRect()
        await moveCursor(r.left + r.width / 2 + dx, r.top + r.height / 2 + dy, ms)
      } else {
        await sleep(ms)
      }
    }
    const clickCursor = async () => {
      emitPresentationCue('click')
      setCursor((c) => ({ ...c, down: true }))
      await sleep(140)
      setCursor((c) => ({ ...c, down: false }))
      await sleep(120)
    }
    const focusSpot = (x: number, y: number) => setSpot({ x, y, on: true })

    async function runScene(scene: Scene) {
      switch (scene.kind) {
        case 'intro': {
          enterStage('intro')
          focusSpot(50, 46)
          await moveCursor(window.innerWidth * 0.5, window.innerHeight * 0.52, 700)
          await sleep(500)
          break
        }
        case 'type': {
          enterStage('type')
          patchStage({ typed: '', caret: true })
          await moveTo('.pm-prompt__input', 520)
          await sleep(200)
          for (let i = 1; i <= COLLECTION_PROMPT.length; i++) {
            if (!alive()) return
            emitPresentationCue('type')
            patchStage({ typed: COLLECTION_PROMPT.slice(0, i) })
            await sleep(reduce ? 6 : 34 + (COLLECTION_PROMPT[i - 1] === ' ' ? 40 : 0))
          }
          await sleep(360)
          await moveTo('.pm-prompt__go', 420)
          await clickCursor()
          emitPresentationCue('generate')
          patchStage({ entered: true })
          await sleep(360)
          break
        }
        case 'collection': {
          enterStage('collection')
          await sleep(120)
          for (let i = 0; i < DEMO_COLLECTION.length; i++) {
            if (!alive()) return
            emitPresentationCue('reveal')
            patchStage({ tech: i + 1 }) // reuse `tech` as a generic reveal counter
            await sleep(reduce ? 40 : 220)
          }
          emitPresentationCue('complete')
          break
        }
        case 'select': {
          enterStage('select')
          focusSpot(50, 50)
          await moveTo('.pm-hero', 640)
          await clickCursor()
          emitPresentationCue('select')
          patchStage({ entered: true })
          await sleep(500)
          break
        }
        case 'graphics': {
          enterStage('graphics')
          for (let i = 0; i < DEMO_GRAPHICS.length; i++) {
            if (!alive()) return
            emitPresentationCue('reveal')
            patchStage({ tech: i + 1 })
            await sleep(reduce ? 40 : 200)
          }
          await sleep(400)
          await moveTo('.pm-graphic[data-i="0"]', 520)
          await clickCursor()
          emitPresentationCue('select')
          patchStage({ chosen: 0, entered: true })
          await sleep(400)
          break
        }
        case 'drag': {
          enterStage('drag')
          patchStage({ chosen: 0 })
          await sleep(160)
          await moveTo('.pm-graphic[data-i="0"]', 460)
          setCursor((c) => ({ ...c, down: true }))
          emitPresentationCue('drag')
          patchStage({ drag: 'grab' })
          await sleep(280)
          patchStage({ drag: 'move' })
          await moveTo('.pm-hero', 820)
          patchStage({ drag: 'snap', heroGraphic: true })
          emitPresentationCue('snap')
          setCursor((c) => ({ ...c, down: false }))
          await sleep(520)
          break
        }
        case 'recolor': {
          enterStage('recolor')
          patchStage({ heroGraphic: true })
          for (let i = 0; i < DEMO_COLORS.length; i++) {
            if (!alive()) return
            const c = DEMO_COLORS[i]
            await moveTo(`.pm-swatch[data-i="${i}"]`, 380)
            await clickCursor()
            emitPresentationCue('recolor')
            patchStage({ fabric: c.hex, colorName: c.name })
            await sleep(reduce ? 60 : 460)
          }
          break
        }
        case 'mockup': {
          enterStage('mockup')
          for (let i = 0; i < DEMO_MOCKUPS.length; i++) {
            if (!alive()) return
            emitPresentationCue('reveal')
            patchStage({ tech: i + 1, mockup: i })
            await sleep(reduce ? 50 : 240)
          }
          break
        }
        case 'techpack': {
          enterStage('techpack')
          for (let i = 0; i < DEMO_TECHPACK.length; i++) {
            if (!alive()) return
            emitPresentationCue('reveal')
            patchStage({ tech: i + 1 })
            await sleep(reduce ? 40 : 200)
          }
          break
        }
        case 'manufacturers': {
          enterStage('manufacturers')
          for (let i = 0; i < DEMO_MANUFACTURERS.length; i++) {
            if (!alive()) return
            emitPresentationCue('reveal')
            patchStage({ tech: i + 1 })
            await sleep(reduce ? 50 : 240)
          }
          break
        }
        case 'complete': {
          enterStage('complete')
          emitPresentationCue('success')
          await sleep(200)
          break
        }
      }
    }

    async function runShow() {
      for (let i = 0; i < SCENES.length; i++) {
        if (!alive()) return
        const scene = SCENES[i]
        setSceneIndex(i)
        emitPresentationCue('scene', scene.id)
        const prev = i > 0 ? SCENES[i - 1].route : null
        if (scene.route !== prev) {
          emitPresentationCue('whoosh')
          navRef.current(scene.route)
          await sleep(760)
        }
        if (!alive()) return
        setCaption({ title: scene.title, subtitle: scene.subtitle })
        await sleep(140)
        await runScene(scene)
        if (!alive()) return
        await sleep(scene.hold)
        setCaption(null)
        await sleep(reduce ? 80 : 240)
      }
      if (!alive()) return
      setSpot((s) => ({ ...s, on: false }))
      setCursor((c) => ({ ...c, show: false }))
      setFinished(true)
      setPlaying(false)
    }

    void runShow()
    return () => {
      tokenRef.current++
    }
    // enterStage/patchStage are stable (useCallback []); navigate is read via navRef so route
    // changes never restart the show. Only `playing` should (re)start or stop the director.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing])

  if (!active) return null

  const scene = sceneIndex >= 0 ? SCENES[sceneIndex] : null

  return (
    <div className={`pm-root${playing ? ' is-playing' : ''}`} aria-hidden={!playing}>
      {/* Camera spotlight — a soft vignette that tightens around the focus point. */}
      <div
        className={`pm-spot${spot.on ? ' is-on' : ''}`}
        style={{ ['--pm-x' as string]: `${spot.x}%`, ['--pm-y' as string]: `${spot.y}%` }}
      />

      {/* The cinematic stage (presentation-owned demo content). */}
      {playing && (
        <div className="pm-veil">
          <div className="pm-stage" key={stage.key}>
            <StageContent stage={stage} />
          </div>

          {caption && (
            <div className="pm-caption" key={`cap-${scene?.id}`}>
              <div className="pm-caption__eyebrow">loom studios</div>
              <div className="pm-caption__title">{caption.title}</div>
              <div className="pm-caption__sub">{caption.subtitle}</div>
            </div>
          )}
        </div>
      )}

      {/* Animated presentation cursor. */}
      {cursor.show && (
        <div
          className={`pm-cursor${cursor.down ? ' is-down' : ''}`}
          style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)` }}
        >
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
            <path d="M4 2l6 16 2.5-6.5L19 9 4 2z" fill="#fff" stroke="#0b0b10" strokeWidth="1.2" strokeLinejoin="round" />
          </svg>
        </div>
      )}

      {/* Controls. */}
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
          <span className="pm-launch__badge">Presentation complete</span>
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

// ── Stage renderers ───────────────────────────────────────────────────────────────────────────────
function StageContent({ stage }: { stage: StageState }) {
  const hero = DEMO_COLLECTION[0]
  switch (stage.kind) {
    case 'type':
      return (
        <div className="pm-prompt-wrap">
          <div className="pm-prompt">
            <span className="pm-prompt__spark">✦</span>
            <div className="pm-prompt__input" data-hero>
              {stage.typed}
              <span className={`pm-prompt__caret${stage.caret ? ' is-on' : ''}`} />
            </div>
            <button className={`pm-prompt__go${stage.entered ? ' is-armed' : ''}`} type="button">
              Generate
            </button>
          </div>
        </div>
      )
    case 'collection':
      return (
        <div className="pm-grid pm-grid--4">
          {DEMO_COLLECTION.map((g, i) => (
            <article
              key={g.id}
              className={`pm-card${i < stage.tech ? ' is-in' : ''}`}
              style={{ ['--g1' as string]: g.gradient[0], ['--g2' as string]: g.gradient[1], animationDelay: `${i * 80}ms` }}
            >
              <div className="pm-card__art">
                <Silhouette glyph={g.glyph} fill={g.fabric} />
              </div>
              <div className="pm-card__meta">
                <div className="pm-card__name">{g.name}</div>
                <div className="pm-card__line">{g.line}</div>
                <div className="pm-card__price">{g.price}</div>
              </div>
            </article>
          ))}
        </div>
      )
    case 'select':
    case 'graphics':
    case 'drag':
    case 'recolor': {
      const showGraphics = stage.kind === 'graphics' || stage.kind === 'drag'
      const fabric = stage.fabric || hero.fabric
      return (
        <div className="pm-studio">
          <div className={`pm-hero${stage.kind === 'select' ? ' is-focus' : ''}`} style={{ ['--g1' as string]: hero.gradient[0], ['--g2' as string]: hero.gradient[1] }}>
            <div className="pm-hero__stage">
              <Silhouette glyph="hoodie" fill={fabric} />
              {stage.heroGraphic && (
                <div className={`pm-hero__graphic${stage.drag === 'snap' ? ' is-snap' : ''}`}>
                  <GraphicMark index={stage.chosen} />
                </div>
              )}
            </div>
            <div className="pm-hero__label">
              {hero.name}
              {stage.colorName && <span className="pm-hero__chip">{stage.colorName}</span>}
            </div>
          </div>

          {showGraphics && (
            <div className="pm-rail">
              {DEMO_GRAPHICS.map((gr, i) => (
                <button
                  key={gr.id}
                  data-i={i}
                  className={`pm-graphic${i < stage.tech || stage.kind === 'drag' ? ' is-in' : ''}${stage.chosen === i && (stage.kind === 'graphics' || stage.kind === 'drag') ? ' is-chosen' : ''}${stage.kind === 'drag' && i === 0 && stage.drag !== 'idle' ? ` is-drag is-${stage.drag}` : ''}`}
                  type="button"
                  style={{ ['--g1' as string]: gr.gradient[0], ['--g2' as string]: gr.gradient[1], animationDelay: `${i * 70}ms` }}
                >
                  <svg viewBox="0 0 100 100" className="pm-graphic__svg" aria-hidden="true">
                    <defs>
                      <linearGradient id={`chrome-${i}`} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stopColor="#eef1f6" />
                        <stop offset="0.5" stopColor="#aab3c4" />
                        <stop offset="1" stopColor="#5b6273" />
                      </linearGradient>
                    </defs>
                    <g dangerouslySetInnerHTML={{ __html: gr.motif.replace(/url\(#chrome\)/g, `url(#chrome-${i})`) }} />
                  </svg>
                  <span className="pm-graphic__name">{gr.name}</span>
                </button>
              ))}
            </div>
          )}

          {stage.kind === 'recolor' && (
            <div className="pm-swatches">
              {DEMO_COLORS.map((c, i) => (
                <button key={c.id} data-i={i} className={`pm-swatch${stage.fabric === c.hex ? ' is-active' : ''}`} type="button" style={{ background: c.hex }}>
                  <span className="pm-swatch__name">{c.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )
    }
    case 'mockup':
      return (
        <div className="pm-grid pm-grid--4">
          {DEMO_MOCKUPS.map((m, i) => (
            <article key={m.id} className={`pm-mockup${i < stage.tech ? ' is-in' : ''}`} style={{ ['--g1' as string]: m.gradient[0], ['--g2' as string]: m.gradient[1], animationDelay: `${i * 80}ms` }}>
              <div className="pm-mockup__art">
                <Silhouette glyph={m.glyph} fill={DEMO_COLLECTION[0].fabric} />
              </div>
              <div className="pm-mockup__label">{m.label}</div>
            </article>
          ))}
        </div>
      )
    case 'techpack':
      return (
        <div className="pm-techpack">
          {DEMO_TECHPACK.map((sec, i) => (
            <section key={sec.id} className={`pm-tp${i < stage.tech ? ' is-in' : ''}`} style={{ animationDelay: `${i * 70}ms` }}>
              <div className="pm-tp__title">{sec.title}</div>
              {sec.rows.map((r) => (
                <div key={r.label} className="pm-tp__row">
                  <span>{r.label}</span>
                  <b>{r.value}</b>
                </div>
              ))}
            </section>
          ))}
        </div>
      )
    case 'manufacturers':
      return (
        <div className="pm-factories">
          {DEMO_MANUFACTURERS.map((m, i) => (
            <article key={m.id} className={`pm-factory${i < stage.tech ? ' is-in' : ''}`} style={{ animationDelay: `${i * 90}ms` }}>
              <div className="pm-factory__flag">{m.flag}</div>
              <div className="pm-factory__body">
                <div className="pm-factory__name">{m.name}</div>
                <div className="pm-factory__meta">
                  {m.city}, {m.country} · {m.capability}
                </div>
                <div className="pm-factory__stats">
                  <span>★ {m.rating.toFixed(1)}</span>
                  <span>MOQ {m.moq}</span>
                  <span>{m.leadDays}d</span>
                  <span>from {m.priceFrom}</span>
                </div>
              </div>
              <div className="pm-factory__verified">Verified</div>
            </article>
          ))}
        </div>
      )
    case 'complete':
      return (
        <div className="pm-done">
          <div className="pm-done__ring">✓</div>
          <div className="pm-done__title">Collection ready for production</div>
          <div className="pm-done__steps">
            {['Designed', 'Graphics placed', 'Recoloured', 'Mockups', 'Tech pack', 'Manufacturer matched'].map((s, i) => (
              <span key={s} className="pm-done__step" style={{ animationDelay: `${i * 90}ms` }}>
                ✓ {s}
              </span>
            ))}
          </div>
        </div>
      )
    default:
      return null
  }
}

function GraphicMark({ index }: { index: number }) {
  const gr = DEMO_GRAPHICS[index] ?? DEMO_GRAPHICS[0]
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id={`hero-chrome-${index}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#eef1f6" />
          <stop offset="0.5" stopColor="#aab3c4" />
          <stop offset="1" stopColor="#5b6273" />
        </linearGradient>
      </defs>
      <g dangerouslySetInnerHTML={{ __html: gr.motif.replace(/url\(#chrome\)/g, `url(#hero-chrome-${index})`) }} />
    </svg>
  )
}
