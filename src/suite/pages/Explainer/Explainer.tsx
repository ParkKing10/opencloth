import { useCallback, useEffect, useRef, useState } from 'react'
import { SuitePage } from '../_shared/SuitePage'
import { IcoBolt, IcoSparkle, IcoUpload, IcoEye, IcoCheck } from '../../components/ui/Icons'
import { useToast } from '../../components/ui/Toast'
import { downloadBlob } from '../../lib/download'
import { RecordingSession, supportsCapture, pickMime } from './recorder'
import { Compositor, outputSize } from './composer'
import { exportExplainer, fileExtFor } from './exporter'
import { DEFAULT_CONFIG, type AspectKey, type BgStyle, type EffectConfig, type Take } from './types'
import './explainer.css'

type Phase = 'idle' | 'recording' | 'editing'

const ASPECTS: { key: AspectKey; label: string }[] = [
  { key: '16:9', label: 'Landscape' },
  { key: '9:16', label: 'Vertical' },
  { key: '1:1', label: 'Square' },
  { key: 'source', label: 'Original' },
]

const BACKGROUNDS: { key: BgStyle; label: string; swatch: string }[] = [
  { key: 'aurora', label: 'Aurora', swatch: 'linear-gradient(135deg,#0b1f1a,#13343f,#1d1030)' },
  { key: 'mesh', label: 'Mesh', swatch: 'linear-gradient(135deg,#101018,#1a2340,#2a1140)' },
  { key: 'sunset', label: 'Sunset', swatch: 'linear-gradient(135deg,#2a0f1e,#5a2130,#c76b3f)' },
  { key: 'slate', label: 'Slate', swatch: 'linear-gradient(135deg,#0c0c11,#15151d,#1e1e28)' },
  { key: 'transparent', label: 'None', swatch: 'repeating-conic-gradient(#2a2a2a 0% 25%,#1a1a1a 0% 50%) 0/16px 16px' },
]

function fmt(s: number): string {
  if (!isFinite(s) || s < 0) s = 0
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export function Explainer() {
  const toast = useToast()
  const [phase, setPhase] = useState<Phase>('idle')
  const [cfg, setCfg] = useState<EffectConfig>(DEFAULT_CONFIG)
  const [micAudio, setMicAudio] = useState(false)
  const [take, setTake] = useState<Take | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [scrub, setScrub] = useState(0)
  const [duration, setDuration] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState(0)

  const sessionRef = useRef<RecordingSession | null>(null)
  const timerRef = useRef<number | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const compRef = useRef(new Compositor())
  const rafRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const cfgRef = useRef(cfg)
  cfgRef.current = cfg

  const supported = supportsCapture()

  /* ---------------- recording ---------------- */

  const startRecording = useCallback(async () => {
    try {
      const session = await RecordingSession.start({
        micAudio,
        onStart: () => {
          setPhase('recording')
          setElapsed(0)
          timerRef.current = window.setInterval(() => setElapsed(session.elapsed()), 250)
        },
      })
      sessionRef.current = session
    } catch (err) {
      const msg = err instanceof Error && err.name === 'NotAllowedError' ? 'Screen sharing was cancelled.' : 'Could not start the recording.'
      toast(msg, 'info')
      setPhase('idle')
    }
  }, [micAudio, toast])

  const stopRecording = useCallback(async () => {
    const session = sessionRef.current
    if (!session) return
    if (timerRef.current) window.clearInterval(timerRef.current)
    const finished = await session.stop()
    sessionRef.current = null
    if (finished.blob.size === 0) {
      toast('The recording came back empty — try again.', 'info')
      setPhase('idle')
      return
    }
    setTake(finished)
    setPhase('editing')
  }, [toast])

  /* ---------------- editor preview loop ---------------- */

  // Wire the source video once we enter editing.
  useEffect(() => {
    if (phase !== 'editing' || !take) return
    const video = videoRef.current
    if (!video) return
    video.src = take.url
    video.load()
    const onMeta = () => {
      const d = isFinite(video.duration) && video.duration > 0 ? video.duration : 0
      setDuration(d)
      setTake((t) => (t ? { ...t, duration: d } : t))
    }
    video.addEventListener('loadedmetadata', onMeta)
    return () => video.removeEventListener('loadedmetadata', onMeta)
  }, [phase, take])

  // rAF render loop — draws the composed frame + tracks scrubber.
  useEffect(() => {
    if (phase !== 'editing') return
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video || !take) return
    const ctx = canvas.getContext('2d')!
    compRef.current.reset()

    const loop = () => {
      const out = outputSize(cfgRef.current.aspect, video.videoWidth || take.width, video.videoHeight || take.height)
      if (canvas.width !== out.w || canvas.height !== out.h) {
        canvas.width = out.w
        canvas.height = out.h
      }
      if (video.readyState >= 2) {
        compRef.current.draw(ctx, video, video.currentTime, cfgRef.current, take.events, out)
        setScrub(video.currentTime)
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [phase, take])

  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      video.playbackRate = cfgRef.current.speed
      if (video.currentTime >= duration - 0.05) video.currentTime = 0
      void video.play()
      setPlaying(true)
    } else {
      video.pause()
      setPlaying(false)
    }
  }, [duration])

  const onScrub = useCallback((v: number) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = v
    setScrub(v)
    compRef.current.reset()
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onEnd = () => setPlaying(false)
    video.addEventListener('ended', onEnd)
    return () => video.removeEventListener('ended', onEnd)
  }, [phase])

  /* ---------------- export ---------------- */

  const runExport = useCallback(async () => {
    if (!take) return
    videoRef.current?.pause()
    setPlaying(false)
    setExporting(true)
    setProgress(0)
    const abort = new AbortController()
    abortRef.current = abort
    try {
      const blob = await exportExplainer({
        sourceUrl: take.url,
        events: take.events,
        cfg: cfgRef.current,
        onProgress: setProgress,
        signal: abort.signal,
      })
      const ext = fileExtFor(pickMime())
      downloadBlob(blob, `explainer-${Date.now()}.${ext}`)
      toast('Explainer exported — check your downloads.', 'success')
    } catch (err) {
      if (!abort.signal.aborted) toast(err instanceof Error ? err.message : 'Export failed.', 'info')
    } finally {
      setExporting(false)
      abortRef.current = null
    }
  }, [take, toast])

  const discard = useCallback(() => {
    if (take) URL.revokeObjectURL(take.url)
    setTake(null)
    setPhase('idle')
    setPlaying(false)
    setScrub(0)
    setDuration(0)
  }, [take])

  // Cleanup on unmount.
  useEffect(
    () => () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
      abortRef.current?.abort()
      sessionRef.current?.stop().catch(() => {})
    },
    [],
  )

  const set = <K extends keyof EffectConfig>(key: K, value: EffectConfig[K]) => setCfg((c) => ({ ...c, [key]: value }))

  /* ---------------- render ---------------- */

  const clickCount = take?.events.filter((e) => e.click).length ?? 0

  return (
    <SuitePage
      eyebrow="Studio"
      title="Explainer Studio"
      subtitle="Record your screen, auto-zoom on every click, and export a polished product tutorial — all in the browser."
      actions={
        phase === 'editing' ? (
          <div className="page__actions">
            <button className="xp-btn xp-btn--ghost" onClick={discard} disabled={exporting}>
              New recording
            </button>
            <button className="xp-btn xp-btn--primary" onClick={runExport} disabled={exporting}>
              <IcoUpload width="16" height="16" />
              {exporting ? `Exporting ${Math.round(progress * 100)}%` : 'Export video'}
            </button>
          </div>
        ) : undefined
      }
    >
      {!supported && (
        <div className="xp-warn">
          Your browser doesn’t support screen capture (getDisplayMedia / MediaRecorder). Try the latest Chrome, Edge, or Firefox on desktop.
        </div>
      )}

      {phase === 'idle' && supported && (
        <div className="xp-start">
          <div className="xp-start__card">
            <div className="xp-start__glow" aria-hidden="true" />
            <span className="xp-chip">
              <IcoSparkle width="14" height="14" /> Screen Studio-style effects
            </span>
            <h2>Record a tutorial that looks produced.</h2>
            <p>
              Capture any window or your whole screen. When you record <b>this browser tab</b>, every click is tracked so the
              camera auto-zooms and follows your cursor — no editing required.
            </p>
            <ul className="xp-feats">
              <li><span>🔍</span> Auto-zoom &amp; pan on clicks</li>
              <li><span>✨</span> Cursor spotlight + click ripples</li>
              <li><span>🖼️</span> Gradient stage &amp; rounded frame</li>
              <li><span>⬇️</span> One-click video export</li>
            </ul>
            <label className="xp-toggle-row">
              <input type="checkbox" checked={micAudio} onChange={(e) => setMicAudio(e.target.checked)} />
              <span>Also record my microphone (narration)</span>
            </label>
            <button className="xp-btn xp-btn--primary xp-btn--lg" onClick={startRecording}>
              <IcoBolt width="18" height="18" /> Start recording
            </button>
            <p className="xp-hint">Tip: in the share dialog choose <b>“This Tab”</b> for click-tracked auto-zoom.</p>
          </div>
        </div>
      )}

      {phase === 'recording' && (
        <div className="xp-live">
          <div className="xp-live__pulse" aria-hidden="true" />
          <div className="xp-live__dot" />
          <div className="xp-live__time">{fmt(elapsed)}</div>
          <p className="xp-live__label">Recording… interact with your app, then stop.</p>
          <button className="xp-btn xp-btn--stop xp-btn--lg" onClick={stopRecording}>
            Stop &amp; edit
          </button>
        </div>
      )}

      {phase === 'editing' && take && (
        <div className="xp-editor">
          <div className="xp-stage-col">
            <div className="xp-stage">
              <canvas ref={canvasRef} className="xp-canvas" />
              <video ref={videoRef} className="xp-src" playsInline muted={false} />
              {exporting && (
                <div className="xp-export-veil">
                  <div className="xp-export-ring" style={{ ['--p' as string]: progress }}>
                    <span>{Math.round(progress * 100)}%</span>
                  </div>
                  <p>Rendering effects into your video…</p>
                </div>
              )}
            </div>

            <div className="xp-transport">
              <button className="xp-play" onClick={togglePlay} disabled={exporting}>
                {playing ? '❚❚' : '▶'}
              </button>
              <span className="xp-time">{fmt(scrub)}</span>
              <div className="xp-track">
                <input
                  type="range"
                  min={0}
                  max={duration || 0.001}
                  step={0.01}
                  value={scrub}
                  onChange={(e) => onScrub(parseFloat(e.target.value))}
                  disabled={exporting}
                />
                {duration > 0 &&
                  take.events
                    .filter((e) => e.click)
                    .map((e, i) => <span key={i} className="xp-mark" style={{ left: `${(e.t / duration) * 100}%` }} />)}
              </div>
              <span className="xp-time">{fmt(duration)}</span>
            </div>

            <div className="xp-meta">
              <span><IcoEye width="14" height="14" /> {take.trackedTab ? 'Tab tracked' : 'Screen capture'}</span>
              <span><IcoCheck width="14" height="14" /> {clickCount} clicks · auto-zoom {cfg.autoZoom ? 'on' : 'off'}</span>
            </div>
            {!take.trackedTab && clickCount === 0 && (
              <p className="xp-note">
                No click track was captured (you shared a window/screen rather than this tab). Framing, background and cursor
                effects still apply — record “This Tab” next time for automatic click-zoom.
              </p>
            )}
          </div>

          {/* ---------------- controls ---------------- */}
          <aside className="xp-panel">
            <section className="xp-sec">
              <h3>Format</h3>
              <div className="xp-grid4">
                {ASPECTS.map((a) => (
                  <button
                    key={a.key}
                    className={`xp-opt${cfg.aspect === a.key ? ' is-on' : ''}`}
                    onClick={() => set('aspect', a.key)}
                  >
                    <span className="xp-opt__k">{a.key}</span>
                    <span className="xp-opt__l">{a.label}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="xp-sec">
              <h3>Background</h3>
              <div className="xp-swatches">
                {BACKGROUNDS.map((b) => (
                  <button
                    key={b.key}
                    className={`xp-swatch${cfg.background === b.key ? ' is-on' : ''}`}
                    style={{ background: b.swatch }}
                    title={b.label}
                    onClick={() => set('background', b.key)}
                  >
                    {cfg.background === b.key && <IcoCheck width="16" height="16" />}
                  </button>
                ))}
              </div>
            </section>

            <section className="xp-sec">
              <h3>Frame</h3>
              <Slider label="Padding" value={cfg.padding} min={0} max={0.2} step={0.005} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set('padding', v)} />
              <Slider label="Corner radius" value={cfg.radius} min={0} max={48} step={1} fmt={(v) => `${v}px`} onChange={(v) => set('radius', v)} />
              <Slider label="Shadow" value={cfg.shadow} min={0} max={1} step={0.05} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set('shadow', v)} />
            </section>

            <section className="xp-sec">
              <div className="xp-sec__head">
                <h3>Auto-zoom</h3>
                <Switch on={cfg.autoZoom} onChange={(v) => set('autoZoom', v)} />
              </div>
              <Slider label="Zoom level" value={cfg.zoomLevel} min={1.2} max={3} step={0.1} fmt={(v) => `${v.toFixed(1)}×`} onChange={(v) => set('zoomLevel', v)} disabled={!cfg.autoZoom} />
              <Slider label="Hold time" value={cfg.zoomHold} min={0.8} max={5} step={0.1} fmt={(v) => `${v.toFixed(1)}s`} onChange={(v) => set('zoomHold', v)} disabled={!cfg.autoZoom} />
            </section>

            <section className="xp-sec">
              <div className="xp-sec__head">
                <h3>Cursor spotlight</h3>
                <Switch on={cfg.cursor} onChange={(v) => set('cursor', v)} />
              </div>
              <div className="xp-sec__head">
                <h3>Click ripples</h3>
                <Switch on={cfg.ripples} onChange={(v) => set('ripples', v)} />
              </div>
            </section>

            <section className="xp-sec">
              <h3>Playback</h3>
              <Slider label="Speed" value={cfg.speed} min={0.5} max={2} step={0.25} fmt={(v) => `${v}×`} onChange={(v) => set('speed', v)} />
            </section>
          </aside>
        </div>
      )}
    </SuitePage>
  )
}

/* ---------------- small controls ---------------- */

function Slider({
  label,
  value,
  min,
  max,
  step,
  fmt,
  onChange,
  disabled,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  fmt: (v: number) => string
  onChange: (v: number) => void
  disabled?: boolean
}) {
  return (
    <label className={`xp-slider${disabled ? ' is-disabled' : ''}`}>
      <span className="xp-slider__top">
        <span>{label}</span>
        <b>{fmt(value)}</b>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </label>
  )
}

function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button className={`xp-switch${on ? ' is-on' : ''}`} onClick={() => onChange(!on)} role="switch" aria-checked={on}>
      <span />
    </button>
  )
}
