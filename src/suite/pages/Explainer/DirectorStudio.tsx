/* ============================================================
   AI Commercial Director — the studio.

   The user directs, the AI designs. LEFT: the project and its
   clips. CENTER: a huge preview with Accept / Regenerate / Delete.
   RIGHT: the brief (prompt, assets, duration, style) + Generate.
   After clips are accepted, the Project view offers exactly:
   trim, reorder, transitions, music, subtitles, volume, export.
   No keyframes. No timelines. No easing. Ever.
   ============================================================ */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '@/i18n'
import { useToast } from '../../components/ui/Toast'
import { Slider, Switch, fmtTime } from './controls'
import {
  CLIP_TYPES,
  CLIP_STYLES,
  clipTypeDef,
  newClip,
  loadCommercial,
  saveCommercial,
  clipPlayLength,
  DUR_MIN,
  DUR_MAX,
  type Clip,
  type ClipTypeId,
  type ClipVersion,
  type Commercial,
  type TransitionKind,
} from './clipModel'
import { generateSceneVersions, generateFootageVersions } from './clipDirector'
import { buildSegments, segmentsDuration, segmentAt, drawCommercialFrame, syncFootage, exportCommercial, EXPORT_SIZES, type MediaProvider } from './exportCommercial'
import { renderProject } from './engine/render'
import { composeAdFrame, adOutputDuration } from './engine/adCompose'
import { saveAsset, ensureAssetsLoaded, getAssetImage, type AssetMeta } from './engine/assets'
import { saveAudioAsset, decodeAudioAsset } from './engine/audio'
import { analyzeRecording, type RecordingAnalysis } from './engine/recordingAnalysis'
import { hasDirectorAi } from './engine/aiDirector'
import { fileExtFor } from './exporter'
import { pickMime } from './recorder'
import { downloadBlob } from '../../lib/download'
import './explainer.css' // xp-* primitives used by the shared Slider/Switch controls
import './director-studio.css'

/* ---------------- session-local recording registry ---------------- */

type Rec = { url: string; video: HTMLVideoElement; analysis: RecordingAnalysis; name: string }

function makeVideo(url: string): HTMLVideoElement {
  const v = document.createElement('video')
  v.src = url
  v.muted = true
  v.playsInline = true
  v.preload = 'auto'
  return v
}

/* ---------------- duration of a specific version ---------------- */

function versionDuration(clip: Clip, v: ClipVersion): number {
  return v.kind === 'scene' ? clip.durationSec : adOutputDuration(v.plan, v.cfg)
}

/* ============================================================ */

export function DirectorStudio() {
  const t = useT()
  const toast = useToast()

  const [com, setCom] = useState<Commercial>(() => loadCommercial())
  const [view, setView] = useState<'direct' | 'edit'>('direct')
  const [selectedId, setSelectedId] = useState<string | null>(com.clips[0]?.id ?? null)
  const [versionId, setVersionId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(com.clips.length === 0)
  const [generating, setGenerating] = useState(false)
  const [genPhase, setGenPhase] = useState(0)
  const [analyzing, setAnalyzing] = useState(0) // 0..1 while a recording is analysed
  const [exporting, setExporting] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [now, setNow] = useState(0) // preview clock, for the transport UI only

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const timeRef = useRef(0)
  const playingRef = useRef(false)
  const exportingRef = useRef(false)
  const editVideoRef = useRef<HTMLVideoElement | null>(null) // the one footage video rolling in Project view
  const recsRef = useRef(new Map<string, Rec>())
  const metasRef = useRef(new Map<string, AssetMeta>())
  const abortRef = useRef<AbortController | null>(null)
  const genSeq = useRef(0)

  const clip = com.clips.find((c) => c.id === selectedId) ?? null
  const version = clip?.versions.find((v) => v.id === versionId) ?? clip?.versions[0] ?? null
  const typeDef = clip ? clipTypeDef(clip.type) : null
  const segments = useMemo(() => buildSegments(com), [com])
  const projectLen = segmentsDuration(segments)

  const media: MediaProvider = useMemo(() => ({ videoFor: (id) => recsRef.current.get(id)?.video ?? null }), [])

  /* ---------- persistence (specs only — media lives elsewhere) ---------- */
  const storageWarned = useRef(false)
  useEffect(() => {
    if (!saveCommercial(com) && !storageWarned.current) {
      storageWarned.current = true
      toast(t('director.toast.storageFull'), 'info')
    }
  }, [com, toast, t])

  // Warm the image cache for everything the current clips reference.
  useEffect(() => {
    const ids = com.clips.flatMap((c) => c.assetIds)
    if (ids.length) void ensureAssetsLoaded(ids)
  }, [com.clips])

  // Leaving the studio: cancel a running export and free the session recordings
  // (object URLs + video elements would otherwise leak until the tab dies).
  useEffect(
    () => () => {
      abortRef.current?.abort()
      for (const rec of recsRef.current.values()) {
        rec.video.pause()
        rec.video.src = ''
        URL.revokeObjectURL(rec.url)
      }
      recsRef.current.clear()
    },
    [],
  )

  /* ---------- mutations ---------- */
  const patchClip = useCallback((id: string, patch: Partial<Clip>) => {
    setCom((c) => ({ ...c, clips: c.clips.map((k) => (k.id === id ? { ...k, ...patch } : k)) }))
  }, [])

  // Switching / deleting / adding a clip supersedes any in-flight generation — the
  // late result must neither hijack the view nor leave the veil up.
  const cancelGeneration = useCallback(() => {
    genSeq.current++
    setGenerating(false)
  }, [])

  // Duration edits RETIME existing takes instead of desyncing them: element timings
  // are fractions of the scene duration, so updating the baked spec re-times cleanly.
  const setClipDuration = (id: string, v: number) => {
    setCom((c) => ({
      ...c,
      clips: c.clips.map((k) => {
        if (k.id !== id) return k
        const versions = k.versions.map((ver) =>
          ver.kind === 'scene' ? { ...ver, spec: { ...ver.spec, scenes: ver.spec.scenes.map((s) => ({ ...s, duration: v })) } } : ver,
        )
        return { ...k, durationSec: v, versions }
      }),
    }))
  }

  const addClip = (type: ClipTypeId) => {
    cancelGeneration()
    const k = newClip(type)
    setCom((c) => ({ ...c, clips: [...c.clips, k] }))
    setSelectedId(k.id)
    setVersionId(null)
    setPickerOpen(false)
    setView('direct')
  }

  const removeClip = (id: string) => {
    cancelGeneration()
    const rec = recsRef.current.get(id)
    if (rec) {
      rec.video.pause()
      rec.video.src = ''
      URL.revokeObjectURL(rec.url)
      recsRef.current.delete(id)
    }
    setCom((c) => ({ ...c, clips: c.clips.filter((k) => k.id !== id), order: c.order.filter((o) => o !== id) }))
    if (selectedId === id) {
      setSelectedId(null)
      setVersionId(null)
    }
    toast(t('director.toast.clipDeleted'), 'default')
  }

  /* ---------- generation ---------- */
  const generate = async (regenerate = false) => {
    if (!clip || generating) return
    if (clip.type === 'recording' && !recsRef.current.get(clip.id)) {
      toast(t('director.toast.needRecording'), 'info')
      return
    }
    // Assets are never required: image-led types without an upload honestly
    // degrade to the typography recipes inside the generator.
    const seq = ++genSeq.current
    setGenerating(true)
    setGenPhase(0)
    const phaseTimer = window.setInterval(() => setGenPhase((p) => (p + 1) % 4), 900)
    const startedAt = performance.now()
    try {
      let versions: ClipVersion[]
      let footageDuration = 0
      if (clip.type === 'recording') {
        const rec = recsRef.current.get(clip.id)!
        const out = generateFootageVersions(rec.analysis, com.accent)
        versions = out.versions
        // Floor, never round up: a display duration past the plan's cut length would
        // push the final frames into composeAdFrame's outro-card branch.
        footageDuration = Math.floor(out.durations[0] * 10) / 10
      } else {
        await ensureAssetsLoaded(clip.assetIds)
        const metas = clip.assetIds.map((id) => metasRef.current.get(id) ?? { id, name: 'asset', addedAt: 0 })
        versions = await generateSceneVersions(clip, metas, com.accent, com.aspect, regenerate ? Math.floor(Math.random() * 3) + 1 : 0)
      }
      // Direction takes a beat — never flash the result in under a second.
      const min = 1100
      const elapsed = performance.now() - startedAt
      if (elapsed < min) await new Promise((r) => setTimeout(r, min - elapsed))
      if (seq !== genSeq.current) return // superseded (clip switched / deleted)
      // Commit against the LIVE clip (not this closure): if the duration slider moved
      // while the director worked, the fresh takes are retimed to the current value.
      setCom((c) => ({
        ...c,
        clips: c.clips.map((k) => {
          if (k.id !== clip.id) return k
          const dur = clip.type === 'recording' ? footageDuration : k.durationSec
          const retimed = versions.map((v) =>
            v.kind === 'scene' ? { ...v, spec: { ...v.spec, scenes: v.spec.scenes.map((s) => ({ ...s, duration: dur })) } } : v,
          )
          return { ...k, versions: retimed, status: 'ready' as const, acceptedId: undefined, durationSec: dur }
        }),
      }))
      setVersionId(versions[0].id)
      timeRef.current = 0
      setPlaying(true)
      toast(t('director.toast.generated'), 'success')
    } catch {
      if (seq === genSeq.current) toast(t('director.toast.genFailed'), 'info')
    } finally {
      window.clearInterval(phaseTimer)
      if (seq === genSeq.current) setGenerating(false)
    }
  }

  const accept = () => {
    if (!clip || !version) return
    const raw = versionDuration(clip, version)
    // Footage: floor so the stored duration can never overshoot the plan (outro flash).
    const dur = version.kind === 'footage' ? Math.floor(raw * 10) / 10 : Math.round(raw * 10) / 10
    setCom((c) => ({
      ...c,
      clips: c.clips.map((k) => (k.id === clip.id ? { ...k, status: 'accepted', acceptedId: version.id, durationSec: dur, trimStart: 0, trimEnd: 0 } : k)),
      order: c.order.includes(clip.id) ? c.order : [...c.order, clip.id],
    }))
    toast(t('director.toast.accepted'), 'success')
  }

  /* ---------- assets ---------- */
  const onUploadImages = async (files: FileList | null) => {
    if (!clip || !files?.length) return
    try {
      const metas = await Promise.all(Array.from(files).slice(0, 4).map((f) => saveAsset(f)))
      metas.forEach((m) => metasRef.current.set(m.id, m))
      await ensureAssetsLoaded(metas.map((m) => m.id))
      patchClip(clip.id, { assetIds: [...clip.assetIds, ...metas.map((m) => m.id)].slice(0, 8) })
    } catch {
      toast(t('director.toast.uploadFailed'), 'info')
    }
  }

  const onUploadRecording = async (files: FileList | null) => {
    if (!clip || !files?.[0] || analyzing > 0) return // one analysis at a time
    const file = files[0]
    const url = URL.createObjectURL(file)
    setAnalyzing(0.01)
    try {
      const analysis = await analyzeRecording(url, { onProgress: (p) => setAnalyzing(Math.max(0.01, p)) })
      const old = recsRef.current.get(clip.id)
      if (old) URL.revokeObjectURL(old.url)
      recsRef.current.set(clip.id, { url, video: makeVideo(url), analysis, name: file.name })
      patchClip(clip.id, { recordingName: file.name, versions: [], status: 'draft', acceptedId: undefined })
      toast(t('director.toast.recordingReady', { s: Math.round(analysis.duration) }), 'success')
    } catch {
      URL.revokeObjectURL(url)
      toast(t('director.toast.recordingFailed'), 'info')
    } finally {
      setAnalyzing(0)
    }
  }

  const removeAsset = (id: string) => {
    if (!clip) return
    // Detach only — generated/accepted takes may still reference the image, and a
    // hard delete would burn a dashed placeholder into their preview and export.
    patchClip(clip.id, { assetIds: clip.assetIds.filter((a) => a !== id) })
  }

  /* ---------- music ---------- */
  const onUploadMusic = async (files: FileList | null) => {
    if (!files?.[0]) return
    try {
      const meta = await saveAudioAsset(files[0])
      setCom((c) => ({ ...c, music: { assetId: meta.id, name: meta.name, volume: 0.8, fadeOut: 1.5 } }))
      toast(t('director.toast.musicAdded'), 'success')
    } catch {
      toast(t('director.toast.uploadFailed'), 'info')
    }
  }

  /* ---------- export ---------- */
  const doExport = async () => {
    if (segments.length === 0 || exporting !== null) return
    setPlaying(false)
    setExporting(0)
    exportingRef.current = true // freezes the preview loop — the export owns the footage videos
    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      let audio = null
      if (com.music) {
        const buffer = await decodeAudioAsset(com.music.assetId)
        if (buffer) audio = { buffer, volume: com.music.volume, fadeIn: 0, fadeOut: com.music.fadeOut, offset: 0 }
      }
      const blob = await exportCommercial({ commercial: com, media, audio, onProgress: setExporting, signal: ctrl.signal })
      downloadBlob(blob, `loom-commercial.${fileExtFor(pickMime())}`)
      toast(t('director.toast.exported'), 'success')
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) toast(t('director.toast.exportFailed'), 'info')
    } finally {
      exportingRef.current = false
      setExporting(null)
      abortRef.current = null
    }
  }

  /* ---------- the preview loop (one canvas for both views) ---------- */
  const previewLen = view === 'edit' ? projectLen : clip && version ? Math.max(0.1, versionDuration(clip, version)) : 0

  useEffect(() => {
    playingRef.current = playing
    // Clips view: the selected clip's recording follows the transport directly.
    // Project view: the rAF loop rolls exactly ONE footage video (the active segment,
    // like the export loop) — here we only make sure everything stops on pause/switch.
    for (const [id, rec] of recsRef.current) {
      const directActive = view === 'direct' && clip?.id === id && version?.kind === 'footage'
      if (playing && directActive) void rec.video.play().catch(() => {})
      else if (!playing || view === 'direct') rec.video.pause()
    }
    if (view !== 'edit') editVideoRef.current = null
  }, [playing, clip, version, view])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf = 0
    let last = performance.now()
    let uiTick = 0
    const tick = (nowMs: number) => {
      // While an export runs it owns the footage videos — the preview must not
      // seek/pause them underneath the recorder (the veil covers the canvas anyway).
      if (exportingRef.current) {
        last = nowMs
        raf = requestAnimationFrame(tick)
        return
      }
      const dt = Math.min(0.1, (nowMs - last) / 1000)
      last = nowMs
      const len = previewLen
      if (playingRef.current && len > 0) {
        timeRef.current = (timeRef.current + dt) % len
      }
      const tt = Math.min(timeRef.current, Math.max(0, len - 0.001))
      const W = canvas.width
      const H = canvas.height
      if (view === 'edit') {
        // Same discipline as the export loop: keep the ACTIVE footage segment's video
        // on plan time (trims + speed ramps), one video rolling at a time — so the
        // Project preview shows exactly what the export will contain.
        const hit = segmentAt(segments, tt)
        const v = hit && hit.seg.version.kind === 'footage' ? media.videoFor(hit.seg.clip.id) : null
        if (v !== editVideoRef.current) {
          editVideoRef.current?.pause()
          editVideoRef.current = v
        }
        if (hit && v && hit.seg.version.kind === 'footage') {
          if (playingRef.current && v.paused) void v.play().catch(() => {})
          if (!playingRef.current && !v.paused) v.pause()
          syncFootage(v, hit.seg.version, hit.seg.clip.trimStart + hit.local, playingRef.current)
        }
        drawCommercialFrame(ctx, com, segments, tt, { W, H, media })
      } else if (clip && version) {
        if (version.kind === 'scene') {
          renderProject(ctx, version.spec, tt, W, H)
        } else {
          const video = media.videoFor(clip.id)
          if (video) {
            syncFootage(video, version, tt, playingRef.current)
            composeAdFrame(ctx, version.plan, version.cfg, { videos: [video], logo: null }, tt, W, H)
          }
        }
      } else {
        ctx.fillStyle = '#08080b'
        ctx.fillRect(0, 0, W, H)
      }
      if (++uiTick % 6 === 0) setNow(timeRef.current) // transport label at ~10fps, canvas at 60
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [com, segments, clip, version, view, previewLen, media])

  // Canvas backing size follows the aspect (display size is CSS-driven).
  const size = EXPORT_SIZES[com.aspect]
  const cw = Math.round(size.w / 2)
  const ch = Math.round(size.h / 2)

  /* ---------- small helpers ---------- */
  const statusDot = (k: Clip) => (k.status === 'accepted' ? 'is-accepted' : k.status === 'ready' ? 'is-ready' : 'is-draft')
  const scrub = (v: number) => {
    timeRef.current = v
    setNow(v)
  }
  const genPhrases = [t('director.gen.p1'), t('director.gen.p2'), t('director.gen.p3'), t('director.gen.p4')]

  /* ============================ render ============================ */
  return (
    <div className="cdr">
      {/* ─── LEFT: project + clips ─── */}
      <aside className="cdr__left">
        <input
          className="cdr__name"
          value={com.name}
          placeholder={t('director.project.namePh')}
          onChange={(e) => setCom((c) => ({ ...c, name: e.target.value.slice(0, 80) }))}
          aria-label={t('director.project.nameAria')}
        />
        <div className="cdr__viewtabs" role="tablist">
          <button role="tab" aria-selected={view === 'direct'} className={`cdr__viewtab${view === 'direct' ? ' is-on' : ''}`} onClick={() => setView('direct')} disabled={exporting !== null}>
            {t('director.view.clips')}
          </button>
          <button role="tab" aria-selected={view === 'edit'} className={`cdr__viewtab${view === 'edit' ? ' is-on' : ''}`} onClick={() => { setView('edit'); setPlaying(false); timeRef.current = 0 }} disabled={exporting !== null}>
            {t('director.view.project')}
            {com.order.length > 0 && <em>{com.order.length}</em>}
          </button>
        </div>

        <div className="cdr__clips">
          {com.clips.length === 0 && <p className="cdr__empty">{t('director.clips.empty')}</p>}
          {com.clips.map((k) => (
            <button
              key={k.id}
              type="button"
              className={`cdr-clip${k.id === selectedId && view === 'direct' ? ' is-selected' : ''}`}
              disabled={exporting !== null}
              onClick={() => {
                cancelGeneration()
                setSelectedId(k.id)
                setVersionId(k.acceptedId ?? k.versions[0]?.id ?? null)
                setView('direct')
                timeRef.current = 0
              }}
            >
              <span className="cdr-clip__emoji">{clipTypeDef(k.type).emoji}</span>
              <span className="cdr-clip__body">
                <b>{k.title || t(clipTypeDef(k.type).labelKey)}</b>
                <small>{k.status === 'accepted' ? fmtTime(clipPlayLength(k)) : t(`director.status.${k.status}`)}</small>
              </span>
              <i className={`cdr-clip__dot ${statusDot(k)}`} aria-hidden="true" />
            </button>
          ))}
        </div>

        <button type="button" className="cdr__new" onClick={() => setPickerOpen(true)} disabled={exporting !== null}>
          + {t('director.clips.new')}
        </button>
        <p className="cdr__ai-note">{hasDirectorAi() ? t('director.ai.live') : t('director.ai.local')}</p>
      </aside>

      {/* ─── CENTER: the preview ─── */}
      <main className="cdr__stage">
        <div className={`cdr__frame cdr__frame--${com.aspect.replace(':', 'x')}`}>
          <canvas ref={canvasRef} width={cw} height={ch} className="cdr__canvas" />
          {generating && (
            <div className="cdr__veil" role="status">
              <span className="cdr__veil-spin" aria-hidden="true" />
              <b>{genPhrases[genPhase]}</b>
              <small>{t('director.gen.sub')}</small>
            </div>
          )}
          {analyzing > 0 && (
            <div className="cdr__veil" role="status">
              <span className="cdr__veil-spin" aria-hidden="true" />
              <b>{t('director.gen.analyzing')}</b>
              <small>{Math.round(analyzing * 100)}%</small>
            </div>
          )}
          {exporting !== null && (
            <div className="cdr__veil" role="status">
              <span className="cdr__veil-spin" aria-hidden="true" />
              <b>{t('director.export.running', { p: Math.round(exporting * 100) })}</b>
              <button type="button" className="cdr__veil-cancel" onClick={() => abortRef.current?.abort()}>
                {t('director.export.cancel')}
              </button>
            </div>
          )}
          {view === 'direct' && clip && clip.versions.length === 0 && !generating && analyzing === 0 && (
            <div className="cdr__hint">
              <span aria-hidden="true">{typeDef?.emoji}</span>
              <b>{t(typeDef?.labelKey ?? 'director.type.aiScene')}</b>
              <small>{t(typeDef?.hintKey ?? 'director.type.aiSceneHint')}</small>
            </div>
          )}
          {view === 'edit' && segments.length === 0 && (
            <div className="cdr__hint">
              <b>{t('director.edit.emptyTitle')}</b>
              <small>{t('director.edit.emptyBody')}</small>
            </div>
          )}
        </div>

        {/* transport */}
        {previewLen > 0 && (
          <div className="cdr__transport">
            <button type="button" className="cdr__play" onClick={() => setPlaying((p) => !p)} aria-label={playing ? t('director.pause') : t('director.play')}>
              {playing ? '❚❚' : '▶'}
            </button>
            <input type="range" min={0} max={previewLen} step={0.01} value={Math.min(now, previewLen)} onChange={(e) => scrub(parseFloat(e.target.value))} aria-label={t('director.scrub')} />
            <span className="cdr__time">
              {fmtTime(now)} / {fmtTime(previewLen)}
            </span>
          </div>
        )}

        {/* versions + decisions */}
        {view === 'direct' && clip && clip.versions.length > 0 && (
          <div className="cdr__decide">
            <div className="cdr__versions" role="tablist" aria-label={t('director.versions.aria')}>
              {clip.versions.map((v) => (
                <button
                  key={v.id}
                  role="tab"
                  aria-selected={v.id === version?.id}
                  className={`cdr__ver${v.id === version?.id ? ' is-on' : ''}${clip.acceptedId === v.id ? ' is-accepted' : ''}`}
                  onClick={() => {
                    setVersionId(v.id)
                    timeRef.current = 0
                    setPlaying(true)
                  }}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <div className="cdr__actions">
              <button type="button" className="cdr__accept" onClick={accept} disabled={!version || clip.acceptedId === version?.id}>
                {clip.acceptedId === version?.id ? `✓ ${t('director.inProject')}` : t('director.accept')}
              </button>
              <button type="button" className="cdr__ghost" onClick={() => void generate(true)} disabled={generating}>
                {t('director.regenerate')}
              </button>
              <button type="button" className="cdr__ghost cdr__ghost--danger" onClick={() => removeClip(clip.id)}>
                {t('director.delete')}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ─── RIGHT: the brief / the project editor ─── */}
      {view === 'direct' ? (
        <aside className="cdr__right">
          {clip ? (
            <>
              <span className="cdr__sec">{t('director.brief.title')}</span>
              <input className="cdr__input" value={clip.title} placeholder={t('director.brief.titlePh')} onChange={(e) => patchClip(clip.id, { title: e.target.value.slice(0, 80) })} />
              <span className="cdr__sec">{t('director.brief.prompt')}</span>
              <textarea
                className="cdr__prompt"
                rows={4}
                value={clip.prompt}
                placeholder={t(typeDef?.promptKey ?? 'director.prefill.aiScene')}
                onChange={(e) => patchClip(clip.id, { prompt: e.target.value.slice(0, 600) })}
              />

              <span className="cdr__sec">{t('director.brief.assets')}</span>
              {clip.type === 'recording' ? (
                <label className="cdr__upload">
                  <input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(e) => void onUploadRecording(e.target.files)} hidden />
                  🎥 {clip.recordingName ? clip.recordingName : t('director.assets.addRecording')}
                </label>
              ) : (
                <>
                  <div className="cdr__assets">
                    {clip.assetIds.map((id) => {
                      const img = getAssetImage(id)
                      return (
                        <span key={id} className="cdr__asset">
                          {img ? <img src={img.src} alt="" /> : <i />}
                          <button type="button" aria-label={t('director.assets.remove')} onClick={() => removeAsset(id)}>
                            ×
                          </button>
                        </span>
                      )
                    })}
                    <label className="cdr__asset cdr__asset--add">
                      <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif" multiple onChange={(e) => void onUploadImages(e.target.files)} hidden />
                      +
                    </label>
                  </div>
                  <small className="cdr__hint-line">{t('director.assets.optional')}</small>
                </>
              )}

              {clip.type !== 'recording' && (
                <>
                  <span className="cdr__sec">{t('director.brief.duration')}</span>
                  <Slider label="" value={clip.durationSec} min={DUR_MIN} max={DUR_MAX} step={0.5} fmt={(v) => `${v.toFixed(1)}s`} onChange={(v) => setClipDuration(clip.id, v)} />
                </>
              )}

              <span className="cdr__sec">{t('director.brief.style')}</span>
              <div className="cdr__pills">
                {CLIP_STYLES.map((s) => (
                  <button key={s} type="button" className={`cdr__pill${clip.style === s ? ' is-on' : ''}`} onClick={() => patchClip(clip.id, { style: s })}>
                    {t(`director.style.${s}`)}
                  </button>
                ))}
              </div>

              <span className="cdr__sec">{t('director.brief.aspect')}</span>
              <div className="cdr__pills">
                {(['16:9', '9:16', '1:1'] as const).map((a) => (
                  <button key={a} type="button" className={`cdr__pill${com.aspect === a ? ' is-on' : ''}`} onClick={() => setCom((c) => ({ ...c, aspect: a }))}>
                    {a}
                  </button>
                ))}
              </div>

              <button type="button" className="cdr__generate" onClick={() => void generate(false)} disabled={generating || analyzing > 0}>
                {generating ? t('director.generating') : clip.versions.length > 0 ? t('director.regenerate') : `✨ ${t('director.generate')}`}
              </button>
            </>
          ) : (
            <div className="cdr__noclip">
              <p>{t('director.brief.noClip')}</p>
              <button type="button" className="cdr__generate" onClick={() => setPickerOpen(true)}>
                + {t('director.clips.new')}
              </button>
            </div>
          )}
        </aside>
      ) : (
        <aside className="cdr__right">
          <span className="cdr__sec">{t('director.edit.sequence')}</span>
          <div className="cdr__seq">
            {com.order.map((id, i) => {
              const k = com.clips.find((c) => c.id === id)
              if (!k || k.status !== 'accepted') return null
              return (
                <div key={id} className="cdr-seq">
                  <div className="cdr-seq__head">
                    <span className="cdr-seq__label">
                      {clipTypeDef(k.type).emoji} <b>{k.title || t(clipTypeDef(k.type).labelKey)}</b> · {fmtTime(clipPlayLength(k))}
                    </span>
                    <span className="cdr-seq__btns">
                      <button type="button" aria-label={t('director.edit.up')} disabled={i === 0} onClick={() => setCom((c) => { const o = [...c.order]; ;[o[i - 1], o[i]] = [o[i], o[i - 1]]; return { ...c, order: o } })}>↑</button>
                      <button type="button" aria-label={t('director.edit.down')} disabled={i === com.order.length - 1} onClick={() => setCom((c) => { const o = [...c.order]; ;[o[i], o[i + 1]] = [o[i + 1], o[i]]; return { ...c, order: o } })}>↓</button>
                      <button type="button" aria-label={t('director.edit.remove')} onClick={() => setCom((c) => ({ ...c, order: c.order.filter((x) => x !== id) }))}>×</button>
                    </span>
                  </div>
                  <Slider label={t('director.edit.trimStart')} value={k.trimStart} min={0} max={Math.max(0, k.durationSec - k.trimEnd - 0.5)} step={0.1} fmt={(v) => `${v.toFixed(1)}s`} onChange={(v) => patchClip(id, { trimStart: v })} />
                  <Slider label={t('director.edit.trimEnd')} value={k.trimEnd} min={0} max={Math.max(0, k.durationSec - k.trimStart - 0.5)} step={0.1} fmt={(v) => `${v.toFixed(1)}s`} onChange={(v) => patchClip(id, { trimEnd: v })} />
                  <input className="cdr__input cdr__input--sm" value={k.caption ?? ''} placeholder={t('director.edit.captionPh')} onChange={(e) => patchClip(id, { caption: e.target.value.slice(0, 120) || undefined })} />
                </div>
              )
            })}
            {com.order.length === 0 && <p className="cdr__empty">{t('director.edit.emptyBody')}</p>}
          </div>

          <span className="cdr__sec">{t('director.edit.transition')}</span>
          <div className="cdr__pills">
            {(['cut', 'fade', 'zoom'] as TransitionKind[]).map((k) => (
              <button key={k} type="button" className={`cdr__pill${com.transition === k ? ' is-on' : ''}`} onClick={() => setCom((c) => ({ ...c, transition: k }))}>
                {t(`director.transition.${k}`)}
              </button>
            ))}
          </div>

          <span className="cdr__sec">{t('director.edit.music')}</span>
          {com.music ? (
            <>
              <div className="cdr__music">
                <span>🎵 {com.music.name}</span>
                <button type="button" aria-label={t('director.edit.remove')} onClick={() => setCom((c) => ({ ...c, music: undefined }))}>
                  ×
                </button>
              </div>
              <Slider label={t('director.edit.volume')} value={com.music.volume} min={0} max={1} step={0.05} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setCom((c) => (c.music ? { ...c, music: { ...c.music, volume: v } } : c))} />
            </>
          ) : (
            <label className="cdr__upload">
              <input type="file" accept="audio/*" onChange={(e) => void onUploadMusic(e.target.files)} hidden />
              🎵 {t('director.edit.addMusic')}
            </label>
          )}

          <div className="cdr__row">
            <span>{t('director.edit.subtitles')}</span>
            <Switch on={com.subtitles} onChange={(v) => setCom((c) => ({ ...c, subtitles: v }))} />
          </div>

          <button type="button" className="cdr__generate" onClick={() => void doExport()} disabled={segments.length === 0 || exporting !== null}>
            {exporting !== null ? t('director.export.running', { p: Math.round(exporting * 100) }) : `⬇ ${t('director.export.button', { s: fmtTime(projectLen) })}`}
          </button>
        </aside>
      )}

      {/* ─── clip picker ─── */}
      {pickerOpen && (
        <div className="cdr-scrim" role="dialog" aria-modal="true" aria-label={t('director.picker.title')} onClick={() => setPickerOpen(false)}>
          <div className="cdr-picker" onClick={(e) => e.stopPropagation()}>
            <b className="cdr-picker__title">{t('director.picker.title')}</b>
            <p className="cdr-picker__sub">{t('director.picker.sub')}</p>
            <div className="cdr-picker__grid">
              {CLIP_TYPES.map((ct) => (
                <button key={ct.id} type="button" className="cdr-picker__item" onClick={() => addClip(ct.id)}>
                  <span aria-hidden="true">{ct.emoji}</span>
                  <b>{t(ct.labelKey)}</b>
                  <small>{t(ct.hintKey)}</small>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
