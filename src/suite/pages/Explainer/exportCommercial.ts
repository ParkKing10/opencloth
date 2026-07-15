/* ============================================================
   Commercial renderer + export.

   ONE draw function walks the accepted-clip sequence and paints
   the frame for any output time t — the preview player and the
   export loop both call it, so what you see is what you export.
   Scene versions render through the pure engine (renderProject);
   footage versions draw the real recording via composeAdFrame.
   Transitions are boundary effects (fade / zoom-dip) so no two
   sources ever need to be warm at once — simple and robust.
   ============================================================ */

import type { Commercial, Clip, ClipVersion } from './clipModel'
import { acceptedClips, acceptedVersion, clipPlayLength } from './clipModel'
import { renderProject } from './engine/render'
import { composeAdFrame, adOutputDuration } from './engine/adCompose'
import { getAudioContext } from './engine/audio'
import { clamp01, easeInOutCubic } from './engine/ease'
import { collectAssetIds, ensureAssetsLoaded } from './engine/assets'
import { pickMime } from './recorder'
import { EXPORT_SIZES, type ExportAudio } from './engine/exportVideo'

export { EXPORT_SIZES }

/** Session-local media that specs can't carry (screen-recording videos). */
export type MediaProvider = { videoFor: (clipId: string) => HTMLVideoElement | null }

export type Segment = { clip: Clip; version: ClipVersion; start: number; len: number }

/** Ordered accepted clips → output segments with absolute start times. */
export function buildSegments(c: Commercial): Segment[] {
  const out: Segment[] = []
  let t = 0
  for (const clip of acceptedClips(c)) {
    const version = acceptedVersion(clip)
    if (!version) continue
    const len = clipPlayLength(clip)
    out.push({ clip, version, start: t, len })
    t += len
  }
  return out
}

export const segmentsDuration = (segs: Segment[]): number => (segs.length ? segs[segs.length - 1].start + segs[segs.length - 1].len : 0)

export function segmentAt(segs: Segment[], t: number): { seg: Segment; local: number } | null {
  for (let i = segs.length - 1; i >= 0; i--) {
    if (t >= segs[i].start - 1e-6) return { seg: segs[i], local: Math.min(segs[i].len, Math.max(0, t - segs[i].start)) }
  }
  return null
}

/** Keep a footage <video> element near the source time the plan asks for.
    Exact seek while paused; only correct drift while it plays. */
export function syncFootage(video: HTMLVideoElement, version: Extract<ClipVersion, { kind: 'footage' }>, localT: number, playing: boolean): void {
  const total = adOutputDuration(version.plan, version.cfg)
  const outT = Math.min(total - 0.001, localT)
  // Map output time → source time by walking the plan's speed-ramped slices.
  let acc = 0
  let src = 0
  for (const c of version.plan.clips) {
    const span = (c.end - c.start) / c.speed
    if (outT <= acc + span) {
      src = c.start + (outT - acc) * c.speed
      break
    }
    acc += span
    src = c.end
  }
  const drift = Math.abs(video.currentTime - src)
  if (!playing) {
    if (drift > 0.033) video.currentTime = src
  } else if (drift > 0.3) {
    video.currentTime = src
  }
}

const TRANS = 0.35

type DrawOpts = { W: number; H: number; media: MediaProvider }

/** Paint output time `t` of the commercial. Pure in (commercial, t) apart from footage videos,
    whose frames the caller keeps warm via syncFootage(). */
export function drawCommercialFrame(ctx: CanvasRenderingContext2D, c: Commercial, segs: Segment[], t: number, { W, H, media }: DrawOpts): void {
  ctx.fillStyle = '#08080b'
  ctx.fillRect(0, 0, W, H)
  const hit = segmentAt(segs, t)
  if (!hit) return
  const { seg, local } = hit

  // Boundary transition: fade / zoom-dip inside the first & last TRANS seconds of a segment.
  const idx = segs.indexOf(seg)
  const inP = idx > 0 ? clamp01(local / TRANS) : 1
  const outP = idx < segs.length - 1 ? clamp01((seg.len - local) / TRANS) : 1
  const vis = c.transition === 'cut' ? 1 : easeInOutCubic(Math.min(inP, outP))

  ctx.save()
  if (c.transition === 'zoom' && vis < 1) {
    const s = 1 + (1 - vis) * 0.06
    ctx.translate(W / 2, H / 2)
    ctx.scale(s, s)
    ctx.translate(-W / 2, -H / 2)
  }

  const sourceT = seg.clip.trimStart + local
  if (seg.version.kind === 'scene') {
    renderProject(ctx, seg.version.spec, Math.min(sourceT, seg.clip.durationSec - 0.001), W, H)
  } else {
    const video = media.videoFor(seg.clip.id)
    if (video && video.readyState >= 2) {
      // Clamp to the plan's real length — durationSec is rounded for display, and a
      // value past cutDuration would flip composeAdFrame into its outro-card branch.
      const planT = Math.min(sourceT, adOutputDuration(seg.version.plan, seg.version.cfg) - 0.001)
      composeAdFrame(ctx, seg.version.plan, seg.version.cfg, { videos: [video], logo: null }, planT, W, H)
    } else {
      // Recording blob is gone (page reload) — honest placeholder, never a fake frame.
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      ctx.font = `500 ${Math.round(H * 0.03)}px Inter, system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText('⟳', W / 2, H / 2)
    }
  }
  ctx.restore()

  // Burned-in subtitle (project editor: per-clip caption).
  if (c.subtitles && seg.clip.caption) {
    const size = Math.round(H * 0.034)
    ctx.font = `600 ${size}px Inter, system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const tw = ctx.measureText(seg.clip.caption).width
    const y = H * 0.92
    ctx.fillStyle = 'rgba(8,8,11,0.72)'
    const padX = size * 0.9
    const bh = size * 1.9
    ctx.beginPath()
    ctx.roundRect(W / 2 - tw / 2 - padX, y - bh / 2, tw + padX * 2, bh, bh / 2)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.fillText(seg.clip.caption, W / 2, y + 1)
  }

  // Transition fade runs above everything (incl. subtitles) so cuts feel intentional.
  if (c.transition !== 'cut' && vis < 1) {
    ctx.fillStyle = `rgba(8,8,11,${(1 - vis).toFixed(3)})`
    ctx.fillRect(0, 0, W, H)
  }
}

/* ---------------- export ---------------- */

type ExportArgs = {
  commercial: Commercial
  media: MediaProvider
  audio?: ExportAudio | null
  onProgress?: (fraction: number) => void
  signal?: AbortSignal
}

export async function exportCommercial({ commercial, media, audio, onProgress, signal }: ExportArgs): Promise<Blob> {
  const segs = buildSegments(commercial)
  const dur = segmentsDuration(segs)
  if (dur <= 0) throw new Error('empty')

  const { w, h } = EXPORT_SIZES[commercial.aspect]
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!

  // Warm up: the asset store's contract — export MUST await ensureAssetsLoaded, or
  // scene specs bake dashed placeholders instead of the real screenshots/logos.
  const assetIds = segs.flatMap((s) => (s.version.kind === 'scene' ? collectAssetIds(s.version.spec) : []))
  if (assetIds.length) await ensureAssetsLoaded(assetIds)

  // Footage videos: seek each to its segment's first frame but do NOT start them —
  // a video that free-runs from t=0 is at the wrong source time (or already ended)
  // when its segment finally begins. The render loop below plays exactly one at a time.
  const footage = segs.filter((s): s is Segment & { version: Extract<ClipVersion, { kind: 'footage' }> } => s.version.kind === 'footage')
  for (const s of footage) {
    const v = media.videoFor(s.clip.id)
    if (v) {
      v.muted = true
      v.pause()
      syncFootage(v, s.version, s.clip.trimStart, false)
    }
  }
  drawCommercialFrame(ctx, commercial, segs, 0, { W: w, H: h, media })

  const stream = canvas.captureStream(30)

  let audioSource: AudioBufferSourceNode | null = null
  let audioClock: (() => number) | null = null
  if (audio) {
    try {
      const ac = getAudioContext()
      await ac.resume()
      const src = ac.createBufferSource()
      src.buffer = audio.buffer
      const gain = ac.createGain()
      const dest = ac.createMediaStreamDestination()
      src.connect(gain).connect(dest)
      const startAt = ac.currentTime + 0.12
      const g = gain.gain
      g.setValueAtTime(audio.fadeIn > 0 ? 0.0001 : audio.volume, startAt)
      if (audio.fadeIn > 0) g.linearRampToValueAtTime(audio.volume, startAt + audio.fadeIn)
      if (audio.fadeOut > 0) {
        g.setValueAtTime(audio.volume, startAt + Math.max(0, dur - audio.fadeOut))
        g.linearRampToValueAtTime(0.0001, startAt + dur)
      }
      src.start(startAt, audio.offset)
      src.stop(startAt + dur + 0.05)
      stream.addTrack(dest.stream.getAudioTracks()[0])
      audioSource = src
      audioClock = () => ac.currentTime - startAt
    } catch {
      audioSource = null // silent export beats a failed one
    }
  }

  const mime = pickMime()
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12_000_000 })
  const chunks: BlobPart[] = []
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }
  let failed = false
  const finished = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mime }))
    recorder.onerror = () => {
      failed = true
      reject(new Error('encoder'))
    }
  })
  finished.catch(() => {})

  const onVisibility = () => {
    try {
      if (document.hidden && recorder.state === 'recording') recorder.pause()
      else if (!document.hidden && recorder.state === 'paused') recorder.resume()
    } catch {
      /* stopped */
    }
  }
  document.addEventListener('visibilitychange', onVisibility)

  recorder.start(200)
  try {
    let contentT = 0
    let last = performance.now()
    let activeVideo: HTMLVideoElement | null = null // exactly one footage video rolls at a time
    await new Promise<void>((done) => {
      let raf = 0
      const tick = (now: number) => {
        if (signal?.aborted || failed || contentT >= dur) {
          cancelAnimationFrame(raf)
          done()
          return
        }
        if (audioClock) contentT = Math.max(contentT, audioClock())
        else contentT += Math.min(0.1, Math.max(0, (now - last) / 1000))
        last = now
        const hit = segmentAt(segs, contentT)
        const v = hit && hit.seg.version.kind === 'footage' ? media.videoFor(hit.seg.clip.id) : null
        if (v !== activeVideo) {
          activeVideo?.pause()
          activeVideo = v
        }
        if (hit && v && hit.seg.version.kind === 'footage') {
          if (v.paused) void v.play().catch(() => {})
          syncFootage(v, hit.seg.version, hit.seg.clip.trimStart + hit.local, true)
        }
        drawCommercialFrame(ctx, commercial, segs, Math.min(contentT, dur - 0.001), { W: w, H: h, media })
        onProgress?.(Math.min(0.99, contentT / dur))
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    })
    drawCommercialFrame(ctx, commercial, segs, Math.max(0, dur - 0.001), { W: w, H: h, media })
    onProgress?.(1)
    await new Promise((r) => setTimeout(r, 80))
  } finally {
    document.removeEventListener('visibilitychange', onVisibility)
    for (const s of footage) media.videoFor(s.clip.id)?.pause()
    try {
      audioSource?.stop()
    } catch {
      /* stopped */
    }
    try {
      if (recorder.state !== 'inactive') recorder.stop()
    } catch {
      /* stopped */
    }
  }
  const blob = await finished
  if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError')
  return blob
}
