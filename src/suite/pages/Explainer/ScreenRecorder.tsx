/* ============================================================
   Screen recorder mode — capture the screen, bake in auto-zoom /
   cursor effects, export. Secondary tab of the Explainer Studio.
   ============================================================ */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useT } from '@/i18n'
import { IcoBolt, IcoSparkle, IcoUpload, IcoEye, IcoCheck } from '../../components/ui/Icons'
import { useToast } from '../../components/ui/Toast'
import { downloadBlob } from '../../lib/download'
import { RecordingSession, supportsCapture, pickMime } from './recorder'
import { Compositor, outputSize } from './composer'
import { exportExplainer, fileExtFor } from './exporter'
import { fmtTime, Slider, Switch } from './controls'
import { DEFAULT_CONFIG, type AspectKey, type BgStyle, type EffectConfig, type Take } from './types'

type Phase = 'idle' | 'recording' | 'editing'

// `label` holds the i18n key; the visible text is resolved with t(...) at the render site.
const ASPECTS: { key: AspectKey; label: string }[] = [
  { key: '16:9', label: 'explainer.aspect.landscape' },
  { key: '9:16', label: 'explainer.aspect.vertical' },
  { key: '1:1', label: 'explainer.aspect.square' },
  { key: 'source', label: 'explainer.aspect.original' },
]

const BACKGROUNDS: { key: BgStyle; label: string; swatch: string }[] = [
  { key: 'aurora', label: 'explainer.bg.aurora', swatch: 'linear-gradient(135deg,#0b1f1a,#13343f,#1d1030)' },
  { key: 'mesh', label: 'explainer.bg.mesh', swatch: 'linear-gradient(135deg,#101018,#1a2340,#2a1140)' },
  { key: 'sunset', label: 'explainer.bg.sunset', swatch: 'linear-gradient(135deg,#2a0f1e,#5a2130,#c76b3f)' },
  { key: 'slate', label: 'explainer.bg.slate', swatch: 'linear-gradient(135deg,#0c0c11,#15151d,#1e1e28)' },
  { key: 'transparent', label: 'explainer.bg.none', swatch: 'repeating-conic-gradient(#2a2a2a 0% 25%,#1a1a1a 0% 50%) 0/16px 16px' },
]

export function ScreenRecorder() {
  const t = useT()
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
      const msg = err instanceof Error && err.name === 'NotAllowedError' ? t('explainer.toast.shareCancelled') : t('explainer.toast.startFailed')
      toast(msg, 'info')
      setPhase('idle')
    }
  }, [micAudio, toast, t])

  const stopRecording = useCallback(async () => {
    const session = sessionRef.current
    if (!session) return
    if (timerRef.current) window.clearInterval(timerRef.current)
    const finished = await session.stop()
    sessionRef.current = null
    if (finished.blob.size === 0) {
      toast(t('explainer.toast.empty'), 'info')
      setPhase('idle')
      return
    }
    setTake(finished)
    setPhase('editing')
  }, [toast, t])

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
      setTake((t2) => (t2 ? { ...t2, duration: d } : t2))
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
      toast(t('explainer.toast.exported'), 'success')
    } catch (err) {
      if (!abort.signal.aborted) toast(err instanceof Error ? err.message : t('explainer.toast.exportFailed'), 'info')
    } finally {
      setExporting(false)
      abortRef.current = null
    }
  }, [take, toast, t])

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
    <>
      {!supported && (
        <div className="xp-warn">
          {t('explainer.warn.unsupported')}
        </div>
      )}

      {phase === 'idle' && supported && (
        <div className="xp-start">
          <div className="xp-start__card">
            <div className="xp-start__glow" aria-hidden="true" />
            <span className="xp-chip">
              <IcoSparkle width="14" height="14" /> {t('explainer.start.chip')}
            </span>
            <h2>{t('explainer.start.heading')}</h2>
            <p>
              {t('explainer.start.body1')}<b>{t('explainer.start.bodyTabBold')}</b>{t('explainer.start.body2')}
            </p>
            <ul className="xp-feats">
              <li><span>🔍</span> {t('explainer.start.feat1')}</li>
              <li><span>✨</span> {t('explainer.start.feat2')}</li>
              <li><span>🖼️</span> {t('explainer.start.feat3')}</li>
              <li><span>⬇️</span> {t('explainer.start.feat4')}</li>
            </ul>
            <label className="xp-toggle-row">
              <input type="checkbox" checked={micAudio} onChange={(e) => setMicAudio(e.target.checked)} />
              <span>{t('explainer.start.micToggle')}</span>
            </label>
            <button className="xp-btn xp-btn--primary xp-btn--lg" onClick={startRecording}>
              <IcoBolt width="18" height="18" /> {t('explainer.start.startBtn')}
            </button>
            <p className="xp-hint">{t('explainer.start.hintBefore')}<b>{t('explainer.start.hintBold')}</b>{t('explainer.start.hintAfter')}</p>
          </div>
        </div>
      )}

      {phase === 'recording' && (
        <div className="xp-live">
          <div className="xp-live__pulse" aria-hidden="true" />
          <div className="xp-live__dot" />
          <div className="xp-live__time">{fmtTime(elapsed)}</div>
          <p className="xp-live__label">{t('explainer.recording.label')}</p>
          <button className="xp-btn xp-btn--stop xp-btn--lg" onClick={stopRecording}>
            {t('explainer.recording.stopBtn')}
          </button>
        </div>
      )}

      {phase === 'editing' && take && (
        <>
          <div className="xp-bar">
            <span className="xp-bar__hint">{t('explainer.page.subtitle')}</span>
            <div className="xp-bar__actions">
              <button className="xp-btn xp-btn--ghost" onClick={discard} disabled={exporting}>
                {t('explainer.action.newRecording')}
              </button>
              <button className="xp-btn xp-btn--primary" onClick={runExport} disabled={exporting}>
                <IcoUpload width="16" height="16" />
                {exporting ? t('explainer.action.exporting', { p: Math.round(progress * 100) }) : t('explainer.action.exportVideo')}
              </button>
            </div>
          </div>
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
                    <p>{t('explainer.editor.rendering')}</p>
                  </div>
                )}
              </div>

              <div className="xp-transport">
                <button className="xp-play" onClick={togglePlay} disabled={exporting}>
                  {playing ? '❚❚' : '▶'}
                </button>
                <span className="xp-time">{fmtTime(scrub)}</span>
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
                <span className="xp-time">{fmtTime(duration)}</span>
              </div>

              <div className="xp-meta">
                <span><IcoEye width="14" height="14" /> {take.trackedTab ? t('explainer.editor.tabTracked') : t('explainer.editor.screenCapture')}</span>
                <span><IcoCheck width="14" height="14" /> {t('explainer.editor.clicksMeta', { n: clickCount, state: cfg.autoZoom ? t('explainer.common.on') : t('explainer.common.off') })}</span>
              </div>
              {!take.trackedTab && clickCount === 0 && (
                <p className="xp-note">
                  {t('explainer.editor.note')}
                </p>
              )}
            </div>

            {/* ---------------- controls ---------------- */}
            <aside className="xp-panel">
              <section className="xp-sec">
                <h3>{t('explainer.sec.format')}</h3>
                <div className="xp-grid4">
                  {ASPECTS.map((a) => (
                    <button
                      key={a.key}
                      className={`xp-opt${cfg.aspect === a.key ? ' is-on' : ''}`}
                      onClick={() => set('aspect', a.key)}
                    >
                      <span className="xp-opt__k">{a.key}</span>
                      <span className="xp-opt__l">{t(a.label)}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="xp-sec">
                <h3>{t('explainer.sec.background')}</h3>
                <div className="xp-swatches">
                  {BACKGROUNDS.map((b) => (
                    <button
                      key={b.key}
                      className={`xp-swatch${cfg.background === b.key ? ' is-on' : ''}`}
                      style={{ background: b.swatch }}
                      title={t(b.label)}
                      onClick={() => set('background', b.key)}
                    >
                      {cfg.background === b.key && <IcoCheck width="16" height="16" />}
                    </button>
                  ))}
                </div>
              </section>

              <section className="xp-sec">
                <h3>{t('explainer.sec.frame')}</h3>
                <Slider label={t('explainer.slider.padding')} value={cfg.padding} min={0} max={0.2} step={0.005} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set('padding', v)} />
                <Slider label={t('explainer.slider.cornerRadius')} value={cfg.radius} min={0} max={48} step={1} fmt={(v) => `${v}px`} onChange={(v) => set('radius', v)} />
                <Slider label={t('explainer.slider.shadow')} value={cfg.shadow} min={0} max={1} step={0.05} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set('shadow', v)} />
              </section>

              <section className="xp-sec">
                <div className="xp-sec__head">
                  <h3>{t('explainer.sec.autoZoom')}</h3>
                  <Switch on={cfg.autoZoom} onChange={(v) => set('autoZoom', v)} />
                </div>
                <Slider label={t('explainer.slider.zoomLevel')} value={cfg.zoomLevel} min={1.2} max={3} step={0.1} fmt={(v) => `${v.toFixed(1)}×`} onChange={(v) => set('zoomLevel', v)} disabled={!cfg.autoZoom} />
                <Slider label={t('explainer.slider.holdTime')} value={cfg.zoomHold} min={0.8} max={5} step={0.1} fmt={(v) => `${v.toFixed(1)}s`} onChange={(v) => set('zoomHold', v)} disabled={!cfg.autoZoom} />
              </section>

              <section className="xp-sec">
                <div className="xp-sec__head">
                  <h3>{t('explainer.sec.cursorSpotlight')}</h3>
                  <Switch on={cfg.cursor} onChange={(v) => set('cursor', v)} />
                </div>
                <div className="xp-sec__head">
                  <h3>{t('explainer.sec.clickRipples')}</h3>
                  <Switch on={cfg.ripples} onChange={(v) => set('ripples', v)} />
                </div>
              </section>

              <section className="xp-sec">
                <h3>{t('explainer.sec.playback')}</h3>
                <Slider label={t('explainer.slider.speed')} value={cfg.speed} min={0.5} max={2} step={0.25} fmt={(v) => `${v}×`} onChange={(v) => set('speed', v)} />
              </section>
            </aside>
          </div>
        </>
      )}
    </>
  )
}
