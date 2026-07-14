/* ============================================================
   Ad Director — the footage-first flow.
   Upload one OR MANY real screen recordings (+ logo + music), write
   ONE prompt, and the director watches every clip: it finds the
   clicks, the loading, the boring parts and the moments that matter,
   then cuts them into a single ad and lays out a storyboard. No
   scenes. No motion-designer head. You refine by talking, or by
   clicking a moment on the timeline.
   ============================================================ */

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { IcoBolt, IcoSparkle, IcoUpload } from '../../components/ui/Icons'
import { useToast } from '../../components/ui/Toast'
import { downloadBlob } from '../../lib/download'
import { fmtTime } from './controls'
import { AudioPlayer, detectBeats, getAudioContext, type AudioBeats } from './engine/audio'
import { analyzeRecording, type RecordingAnalysis } from './engine/recordingAnalysis'
import { buildAdPlan, type AdPlan } from './engine/adPlan'
import { adOutputDuration, composeAdFrame, DEFAULT_AD_CONFIG, mapOutputToSource, type AdConfig } from './engine/adCompose'
import { applyVibe, DEFAULT_STYLE, parseVibe, type LocalEdit, type LocalEditKind, type StyleParams } from './engine/adRefine'
import { pickMime } from './recorder'
import { fileExtFor } from './exporter'
import './director.css'

const VIBE_CHIPS: { label: string; mult: Partial<StyleParams> }[] = [
  { label: 'More Apple', mult: { zoom: 0.8, accentUse: 0.7, pace: 0.9, vignette: 1.12 } },
  { label: 'Faster', mult: { pace: 1.4 } },
  { label: 'Slower', mult: { pace: 0.72 } },
  { label: 'More zoom', mult: { zoom: 1.4 } },
  { label: 'More energy', mult: { pace: 1.3, zoom: 1.15, accentUse: 1.25 } },
  { label: 'More emotional', mult: { pace: 0.85, zoom: 1.1, vignette: 1.15 } },
]

const EDIT_KINDS: { kind: LocalEditKind; label: string }[] = [
  { kind: 'zoom', label: 'Zoom in here' },
  { kind: 'emphasis', label: 'Emphasize here' },
  { kind: 'noText', label: 'Hide graphics here' },
]

type Upload = { url: string; name: string }

/** A punchy headline from the first line of the prompt. */
function headlineFrom(prompt: string): string {
  const first = prompt.split(/[.\n]/)[0].trim()
  const words = first.split(/\s+/).slice(0, 5).join(' ')
  return words || 'Watch this'
}

/** Output formats — TikTok/Reels vertical first, classic landscape, square feed. */
const OUT = {
  '9:16': { w: 1080, h: 1920, label: '9:16 · TikTok' },
  '16:9': { w: 1920, h: 1080, label: '16:9 · YouTube' },
  '1:1': { w: 1080, h: 1080, label: '1:1 · Feed' },
} as const
type OutFormat = keyof typeof OUT

const EXAMPLE =
  'Show how I generate a hoodie from a prompt, then add distressed holes, then create a mockup. End with the logo and a CTA.'

export function AdDirector() {
  const toast = useToast()
  const [recordings, setRecordings] = useState<Upload[]>([])
  const [logo, setLogo] = useState<Upload | null>(null)
  const [music, setMusic] = useState<{ name: string; beats: AudioBeats | null; buffer: AudioBuffer | null } | null>(null)
  const [prompt, setPrompt] = useState('')
  const [progress, setProgress] = useState(-1) // -1 idle, 0..1 analysing
  const [analyses, setAnalyses] = useState<RecordingAnalysis[]>([])
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [expPct, setExpPct] = useState(0)
  // Refine: whole-ad style + time-anchored local edits.
  const [style, setStyle] = useState<StyleParams>(DEFAULT_STYLE)
  const [edits, setEdits] = useState<LocalEdit[]>([])
  const [refineText, setRefineText] = useState('')
  const [editMenu, setEditMenu] = useState(false)
  const [format, setFormat] = useState<OutFormat>('9:16')

  const recRef = useRef<HTMLInputElement>(null)
  const logoRef = useRef<HTMLInputElement>(null)
  const musicRef = useRef<HTMLInputElement>(null)
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]) // hidden source videos (one per clip)
  const canvasRef = useRef<HTMLCanvasElement>(null) // composed output
  const logoImgRef = useRef<HTMLImageElement | null>(null)
  const audioRef = useRef<AudioPlayer>(new AudioPlayer())
  const urlsRef = useRef<string[]>([])
  const outRef = useRef(0)
  const playingRef = useRef(false)
  const exportingRef = useRef(false)
  const rafRef = useRef(0)
  const lastRef = useRef(0)

  useEffect(() => () => {
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u))
    audioRef.current.stop()
    cancelAnimationFrame(rafRef.current)
  }, [])

  const track = (url: string) => {
    urlsRef.current.push(url)
    return url
  }

  const onRecordings = (files: FileList | null) => {
    if (!files || !files.length) return
    const vids = Array.from(files).filter((f) => f.type.startsWith('video/'))
    if (!vids.length) return toast('Drop screen recordings (.webm or .mp4).', 'info')
    setRecordings((rs) => [...rs, ...vids.map((f) => ({ url: track(URL.createObjectURL(f)), name: f.name }))])
    setAnalyses([]) // the set changed → the old cut is stale
  }
  const removeRecording = (i: number) => {
    setRecordings((rs) => rs.filter((_, idx) => idx !== i))
    setAnalyses([])
  }
  const onLogo = (f: File | undefined) => {
    if (!f) return
    const url = track(URL.createObjectURL(f))
    setLogo({ url, name: f.name })
    const img = new Image()
    img.onload = () => (logoImgRef.current = img)
    img.src = url
  }
  const onMusic = async (f: File | undefined) => {
    if (!f) return
    setMusic({ name: f.name, beats: null, buffer: null })
    try {
      const buf = await getAudioContext().decodeAudioData(await f.arrayBuffer())
      audioRef.current.setBuffer(buf)
      audioRef.current.setMix({ volume: 0.8, fadeIn: 0.3, fadeOut: 1.2, offset: 0 })
      setMusic({ name: f.name, beats: detectBeats(buf), buffer: buf })
    } catch {
      toast('Could not read that music file.', 'info')
    }
  }

  const plan: AdPlan | null = useMemo(
    () => (analyses.length ? buildAdPlan(analyses, { beats: music?.beats?.beats, deadSpeed: 4 * style.pace }) : null),
    [analyses, music, style.pace],
  )

  const adCfg: AdConfig = useMemo(
    () => ({
      ...DEFAULT_AD_CONFIG,
      headline: headlineFrom(prompt),
      cta: 'Try it now',
      intro: 1.4 / Math.sqrt(style.pace),
      outro: 2.0 / Math.sqrt(style.pace),
      zoom: style.zoom,
      accentUse: style.accentUse,
      vignette: style.vignette,
      edits,
    }),
    [prompt, style, edits],
  )
  const outDur = plan ? adOutputDuration(plan, adCfg) : 0

  // Combined SOURCE timeline: where each clip starts on one shared ruler, and the total.
  const { offsets: srcOffsets, total: totalSrc } = useMemo(() => {
    const offsets: number[] = []
    let acc = 0
    for (const a of analyses) {
      offsets.push(acc)
      acc += a.duration
    }
    return { offsets, total: Math.max(acc, 0.001) }
  }, [analyses])

  // Keep the music level in sync with the vibe.
  useEffect(() => {
    audioRef.current.setMix({ volume: style.musicVol, fadeIn: 0.3, fadeOut: 1.2, offset: 0 })
  }, [style.musicVol])

  const pauseAllVideos = () => videoRefs.current.forEach((v) => v && !v.paused && v.pause())

  /** Paint one composed frame at output time `outT` (positions the active source video, then draws). */
  const paint = (outT: number) => {
    const canvas = canvasRef.current
    if (!canvas || !plan) return
    const { w, h } = OUT[format]
    if (canvas.width !== w) canvas.width = w
    if (canvas.height !== h) canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rolling = playingRef.current || exportingRef.current
    const map = mapOutputToSource(plan, adCfg, outT)
    if (map.section === 'body') {
      const clip = plan.clips[map.clip]
      const v = videoRefs.current[map.video]
      if (v && v.readyState >= 2) {
        // Paused → seek exactly (crisp scrubbing). Rolling → seek only on drift (let it play).
        const drift = Math.abs(v.currentTime - map.srcTime)
        if (!rolling ? drift > 0.05 : drift > 0.34) v.currentTime = map.srcTime
        v.playbackRate = Math.min(4, Math.max(0.25, clip?.speed ?? 1))
      }
      // Only the clip currently on screen should be rolling.
      videoRefs.current.forEach((vv, idx) => {
        if (!vv) return
        if (rolling && idx === map.video) {
          if (vv.paused) void vv.play().catch(() => {})
        } else if (!vv.paused) vv.pause()
      })
    } else {
      pauseAllVideos() // intro / outro cards — no footage on screen
    }
    composeAdFrame(ctx, plan, adCfg, { videos: videoRefs.current, logo: logoImgRef.current }, outT, w, h)
  }

  // Preview loop: advance the output clock, keep the footage rolling, paint the composed frame.
  useEffect(() => {
    const loop = (now: number) => {
      if (playingRef.current) {
        outRef.current += (now - lastRef.current) / 1000
        if (outRef.current >= outDur) {
          outRef.current = outDur
          playingRef.current = false
          setPlaying(false)
          audioRef.current.stop()
          pauseAllVideos()
        }
        setTime(outRef.current)
        paint(outRef.current)
      }
      lastRef.current = now
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, outDur, adCfg, format])

  // Repaint a still frame when the plan/config changes but we're paused.
  useEffect(() => {
    if (!playingRef.current && plan) paint(Math.min(outRef.current, outDur))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, adCfg, logo, format])

  const togglePlay = () => {
    if (!plan) return
    if (playingRef.current) {
      playingRef.current = false
      setPlaying(false)
      audioRef.current.stop()
      pauseAllVideos()
      return
    }
    if (outRef.current >= outDur - 0.05) {
      outRef.current = 0
      setTime(0)
    }
    playingRef.current = true
    setPlaying(true)
    paint(outRef.current) // kicks the active clip into play
    if (music?.buffer) audioRef.current.start(Math.max(0, outRef.current - adCfg.intro), outDur - adCfg.intro)
  }

  const exportAd = async () => {
    const canvas = canvasRef.current
    if (!plan || !canvas || exporting) return
    playingRef.current = false
    setPlaying(false)
    exportingRef.current = true
    setExporting(true)
    setExpPct(0)
    const { w, h } = OUT[format]
    canvas.width = w
    canvas.height = h
    paint(0)
    const stream = canvas.captureStream(30)
    // Mux the music (silent to the user — routed to the recorder only).
    let src: AudioBufferSourceNode | null = null
    if (music?.buffer) {
      try {
        const ac = getAudioContext()
        await ac.resume()
        src = ac.createBufferSource()
        src.buffer = music.buffer
        const dest = ac.createMediaStreamDestination()
        src.connect(dest)
        src.start()
        stream.addTrack(dest.stream.getAudioTracks()[0])
      } catch {
        src = null
      }
    }
    const mime = pickMime()
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12_000_000 })
    const chunks: BlobPart[] = []
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    const done = new Promise<Blob>((res) => (rec.onstop = () => res(new Blob(chunks, { type: mime }))))
    rec.start(200)
    try {
      let t = 0
      let last = performance.now()
      await new Promise<void>((finish) => {
        const tick = (now: number) => {
          t += (now - last) / 1000
          last = now
          if (t >= outDur) {
            finish()
            return
          }
          paint(t)
          setExpPct(Math.min(0.99, t / outDur))
          requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      })
      paint(outDur - 0.01)
      await new Promise((r) => setTimeout(r, 80))
    } finally {
      try {
        src?.stop()
      } catch {
        /* noop */
      }
      if (rec.state !== 'inactive') rec.stop()
      exportingRef.current = false
      pauseAllVideos()
    }
    const blob = await done
    downloadBlob(blob, `loom-ad-${format.replace(':', 'x')}.${fileExtFor(mime)}`)
    setExporting(false)
    setExpPct(0)
    toast('Ad exported — check your downloads.', 'success')
  }

  const generate = async () => {
    if (!recordings.length || progress >= 0) return
    setProgress(0)
    setAnalyses([])
    setEdits([])
    outRef.current = 0
    setTime(0)
    try {
      const out: RecordingAnalysis[] = []
      for (let i = 0; i < recordings.length; i++) {
        const res = await analyzeRecording(recordings[i].url, { onProgress: (p) => setProgress((i + p) / recordings.length) })
        out.push(res)
      }
      setAnalyses(out)
      const moments = out.reduce((s, a) => s + a.moments.length, 0)
      const deads = out.reduce((s, a) => s + a.deadZones.length, 0)
      const n = recordings.length
      toast(`Cut ready — ${n} clip${n > 1 ? 's' : ''}, ${moments} key moments, ${deads} dead spots trimmed.`, 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not analyse those recordings.', 'info')
    } finally {
      setProgress(-1)
    }
  }

  const seek = (outT: number) => {
    outRef.current = Math.max(0, Math.min(outT, outDur))
    setTime(outRef.current)
    paint(outRef.current)
    if (playingRef.current && music?.buffer) audioRef.current.start(Math.max(0, outRef.current - adCfg.intro), outDur - adCfg.intro)
  }

  const nudge = (mult: Partial<StyleParams>) => setStyle((s) => applyVibe(s, mult))
  const submitVibe = () => {
    const text = refineText.trim()
    if (!text) return
    const m = parseVibe(text)
    if (m) {
      setStyle((s) => applyVibe(s, m))
      toast('Ad restyled — watch the preview.', 'success')
    } else {
      toast('Not sure yet — try “faster”, “more zoom”, “more Apple”, or “more emotional”.', 'info')
    }
    setRefineText('')
  }
  const addEdit = (kind: LocalEditKind) => {
    setEdits((e) => [...e, { id: `e${Date.now().toString(36)}`, at: Math.round(outRef.current * 20) / 20, kind }])
    setEditMenu(false)
    toast('Added at the playhead.', 'default')
  }
  const removeEdit = (id: string) => setEdits((e) => e.filter((x) => x.id !== id))

  const analysing = progress >= 0
  const ready = analyses.length > 0 && recordings.length > 0 && !!plan
  const momentsTotal = analyses.reduce((s, a) => s + a.moments.length, 0)
  const deadsTotal = analyses.reduce((s, a) => s + a.deadZones.length, 0)

  // Map a SOURCE point (clip index + time within that clip) to the OUTPUT time where it plays.
  const srcToOut = (video: number, srcT: number): number => {
    if (!plan) return 0
    let acc = adCfg.intro
    for (const c of plan.clips) {
      if (c.video === video && srcT <= c.end) return acc + Math.max(0, srcT - c.start) / c.speed
      acc += (c.end - c.start) / c.speed
    }
    return acc
  }
  // Where the current OUTPUT time sits on the shared source ruler (for the analysis playhead).
  const curFrac = plan
    ? (() => {
        const m = mapOutputToSource(plan, adCfg, time)
        if (m.section === 'body') return (srcOffsets[m.video] + m.srcTime) / totalSrc
        return m.section === 'intro' ? 0 : 1
      })()
    : 0

  const recTileName = recordings.length === 1 ? recordings[0].name : recordings.length > 1 ? `${recordings.length} clips` : undefined

  return (
    <div className="dir">
      {/* uploads */}
      <div className="dir-uploads">
        <UploadTile
          label="Screen recordings"
          hint=".webm / .mp4 — add several"
          icon="🎬"
          filled={recordings.length > 0}
          name={recTileName}
          onClick={() => recRef.current?.click()}
          primary
        />
        <UploadTile label="Logo" hint="PNG / SVG" icon="✦" filled={!!logo} name={logo?.name} onClick={() => logoRef.current?.click()} />
        <UploadTile
          label="Music"
          hint={music?.beats ? `${music.beats.bpm} BPM detected` : 'MP3 / WAV'}
          icon="🎵"
          filled={!!music}
          name={music?.name}
          onClick={() => musicRef.current?.click()}
        />
      </div>
      <input ref={recRef} type="file" accept="video/*,.webm,.mp4,.mov" multiple hidden onChange={(e) => { onRecordings(e.target.files); e.target.value = '' }} />
      <input ref={logoRef} type="file" accept="image/*" hidden onChange={(e) => { onLogo(e.target.files?.[0]); e.target.value = '' }} />
      <input ref={musicRef} type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg" hidden onChange={(e) => { void onMusic(e.target.files?.[0]); e.target.value = '' }} />

      {/* the clips, in the order they'll be cut together */}
      {recordings.length > 0 && (
        <div className="dir-cliplist">
          {recordings.map((r, i) => (
            <span key={r.url} className="dir-clip">
              <span className="dir-clip__n">{i + 1}</span>
              <span className="dir-clip__name" title={r.name}>{r.name}</span>
              <button type="button" onClick={() => removeRecording(i)} aria-label="Remove clip">×</button>
            </span>
          ))}
          <button type="button" className="dir-clip-add" onClick={() => recRef.current?.click()}>+ Add clip</button>
        </div>
      )}

      {/* one prompt */}
      <div className="dir-prompt">
        <label className="dir-prompt__label">What should the video show?</label>
        <textarea
          className="dir-prompt__area"
          rows={3}
          placeholder={EXAMPLE}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <button className="dir-generate" type="button" onClick={generate} disabled={!recordings.length || analysing}>
          {analysing ? (
            <>Watching your {recordings.length > 1 ? 'recordings' : 'recording'}… {Math.round(progress * 100)}%</>
          ) : (
            <>
              <IcoSparkle width="18" height="18" /> Generate the ad
            </>
          )}
        </button>
        {!recordings.length && <p className="dir-hint">Drop your screen recordings above to start — the director does the rest.</p>}
      </div>

      {analysing && (
        <div className="dir-progress">
          <div className="dir-progress__bar" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}

      {/* result: the finished ad (real footage + motion graphics), plus what the director found */}
      {ready && (
        <div className="dir-result">
          {recordings.map((r, i) => (
            <video
              key={r.url}
              ref={(el) => { videoRefs.current[i] = el }}
              src={r.url}
              muted
              playsInline
              preload="auto"
              style={{ display: 'none' }}
              onLoadedData={() => paint(outRef.current)}
            />
          ))}
          {/* output format — TikTok vertical is the default */}
          <div className="dir-formats" role="group" aria-label="Output format">
            {(Object.keys(OUT) as OutFormat[]).map((f) => (
              <button
                key={f}
                type="button"
                className={`dir-format${format === f ? ' is-on' : ''}`}
                onClick={() => setFormat(f)}
                disabled={exporting}
              >
                {OUT[f].label}
              </button>
            ))}
          </div>
          <div className="dir-stage">
            <canvas ref={canvasRef} className="dir-video" />
            {exporting && (
              <div className="dir-export-veil">
                <div className="dir-export-ring">{Math.round(expPct * 100)}%</div>
                <p>Rendering your ad…</p>
              </div>
            )}
          </div>

          {/* transport over the OUTPUT (the cut ad) */}
          <div className="dir-transport">
            <button className="dir-play" type="button" onClick={togglePlay} disabled={exporting}>
              {playing ? '❚❚' : '▶'}
            </button>
            <span className="dir-time">{fmtTime(time)}</span>
            <input
              className="dir-scrub"
              type="range"
              min={0}
              max={Math.max(outDur, 0.001)}
              step={0.02}
              value={Math.min(time, outDur)}
              onChange={(e) => seek(parseFloat(e.target.value))}
              disabled={exporting}
            />
            <span className="dir-time">{fmtTime(outDur)}</span>
            <div className="dir-edithere">
              <button className="dir-export" type="button" onClick={() => setEditMenu((o) => !o)} disabled={exporting}>
                ✎ Edit here
              </button>
              {editMenu && (
                <div className="dir-editmenu">
                  <span className="dir-editmenu__t">At {fmtTime(time)}</span>
                  {EDIT_KINDS.map((k) => (
                    <button key={k.kind} type="button" onClick={() => addEdit(k.kind)}>
                      {k.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="dir-export" type="button" onClick={exportAd} disabled={exporting}>
              <IcoUpload width="15" height="15" /> {exporting ? `Exporting ${Math.round(expPct * 100)}%` : 'Export'}
            </button>
          </div>

          <div className="dir-summary">
            <span className="dir-chip dir-chip--accent">
              <IcoBolt width="13" height="13" /> {momentsTotal} key moments
            </span>
            <span className="dir-chip">{recordings.length} clip{recordings.length > 1 ? 's' : ''} joined</span>
            <span className="dir-chip">{deadsTotal} dead spots trimmed</span>
            <span className="dir-chip">{Math.round(plan.deadTrimmed * 10) / 10}s of nothing removed</span>
            <span className="dir-chip">final cut ~{Math.round(outDur)}s</span>
            {music?.beats && <span className="dir-chip">synced to {music.beats.bpm} BPM</span>}
          </div>

          {/* what the director found across ALL clips — click a moment to jump there in the cut */}
          <div className="dir-timeline">
            {analyses.map((a, vi) => {
              const off = srcOffsets[vi]
              return (
                <Fragment key={vi}>
                  {vi > 0 && <div className="dir-tl__cut" style={{ left: `${(off / totalSrc) * 100}%` }} title={`Clip ${vi + 1}`} />}
                  {a.deadZones.map((z, i) => (
                    <div
                      key={`d${vi}-${i}`}
                      className="dir-tl__dead"
                      style={{ left: `${((off + z.start) / totalSrc) * 100}%`, width: `${((z.end - z.start) / totalSrc) * 100}%` }}
                      title="Dead / loading — sped up"
                    />
                  ))}
                  {a.moments.map((m, i) => (
                    <button
                      key={`m${vi}-${i}`}
                      className={`dir-tl__moment dir-tl__moment--${m.kind}`}
                      style={{ left: `${((off + m.t) / totalSrc) * 100}%`, height: `${40 + m.strength * 55}%` }}
                      title={`${m.kind === 'reveal' ? 'Reveal' : 'Action'} · clip ${vi + 1} @ ${fmtTime(m.t)}`}
                      onClick={() => seek(srcToOut(vi, m.t))}
                    />
                  ))}
                </Fragment>
              )
            })}
            <div className="dir-tl__head" style={{ left: `${curFrac * 100}%` }} />
          </div>

          {/* the auto storyboard — plain-language, never scene/element jargon */}
          <div className="dir-story">
            {plan.story.map((s, i) => (
              <button key={i} className={`dir-step dir-step--${s.kind}`} type="button" onClick={() => seek(srcToOut(s.video, s.t))}>
                <span className="dir-step__thumb">
                  {s.thumb ? <img src={s.thumb} alt="" /> : <span className="dir-step__ico">{s.kind === 'hook' ? '✦' : s.kind === 'outro' ? '⤷' : '›'}</span>}
                </span>
                <span className="dir-step__label">{s.label}</span>
                <span className="dir-step__time">{fmtTime(srcToOut(s.video, s.t))}</span>
              </button>
            ))}
          </div>

          {/* refine: talk to the director in vibes, or edit at a point */}
          <div className="dir-refine">
            <div className="dir-refine__row">
              <input
                className="dir-input"
                placeholder="Tell the director a vibe — “more Apple”, “faster”, “more emotional”…"
                value={refineText}
                onChange={(e) => setRefineText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitVibe()}
              />
              <button className="s-btn s-btn--accent" type="button" onClick={submitVibe} disabled={!refineText.trim()}>
                Apply
              </button>
            </div>
            <div className="dir-chips">
              {VIBE_CHIPS.map((c) => (
                <button key={c.label} type="button" className="dir-vibe" onClick={() => nudge(c.mult)}>
                  {c.label}
                </button>
              ))}
            </div>
            {edits.length > 0 && (
              <div className="dir-edits">
                {edits.map((e) => (
                  <span key={e.id} className="dir-edit">
                    {e.kind === 'zoom' ? 'Zoom' : e.kind === 'emphasis' ? 'Emphasis' : 'No graphics'} @ {fmtTime(e.at)}
                    <button type="button" onClick={() => removeEdit(e.id)} aria-label="Remove">
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function UploadTile({
  label,
  hint,
  icon,
  filled,
  name,
  onClick,
  primary,
}: {
  label: string
  hint: string
  icon: string
  filled: boolean
  name?: string
  onClick: () => void
  primary?: boolean
}) {
  return (
    <button className={`dir-tile${filled ? ' is-filled' : ''}${primary ? ' dir-tile--primary' : ''}`} type="button" onClick={onClick}>
      <span className="dir-tile__icon">{filled ? '✓' : icon}</span>
      <span className="dir-tile__label">{label}</span>
      <span className="dir-tile__hint">{filled && name ? name : hint}</span>
      {!filled && <span className="dir-tile__up"><IcoUpload width="14" height="14" /></span>}
    </button>
  )
}
