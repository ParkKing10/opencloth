/* ============================================================
   Explainer Studio — exporter
   Renders the composed explainer (effects baked in) back to a
   downloadable video. Plays the source <video> at the chosen
   speed, draws each frame through the Compositor into an offscreen
   canvas, captures that canvas as a stream, muxes the original
   audio track, and records the result with MediaRecorder.
   ============================================================ */

import { Compositor, outputSize } from './composer'
import { pickMime } from './recorder'
import type { EffectConfig, PointerEvt } from './types'

type ExportArgs = {
  sourceUrl: string
  events: PointerEvt[]
  cfg: EffectConfig
  onProgress?: (fraction: number) => void
  signal?: AbortSignal
}

/**
 * Produce the final explainer as a webm/mp4 Blob with all effects rendered in.
 * Resolves with the finished file, ready for download.
 */
export async function exportExplainer({ sourceUrl, events, cfg, onProgress, signal }: ExportArgs): Promise<Blob> {
  // Dedicated source element so we don't disturb the live preview.
  const video = document.createElement('video')
  video.src = sourceUrl
  video.muted = false
  video.playsInline = true
  video.preload = 'auto'

  await new Promise<void>((res, rej) => {
    video.onloadedmetadata = () => res()
    video.onerror = () => rej(new Error('Could not load the recording for export.'))
  })

  const duration = isFinite(video.duration) && video.duration > 0 ? video.duration : await probeDuration(video)
  const out = outputSize(cfg.aspect, video.videoWidth, video.videoHeight)

  const canvas = document.createElement('canvas')
  canvas.width = out.w
  canvas.height = out.h
  const ctx = canvas.getContext('2d')!

  const fps = 30
  const canvasStream = canvas.captureStream(fps)

  // Pull the original audio (narration / system) into the export.
  const captureable = video as HTMLVideoElement & { captureStream?: () => MediaStream; mozCaptureStream?: () => MediaStream }
  const media = captureable.captureStream?.() ?? captureable.mozCaptureStream?.()
  media?.getAudioTracks().forEach((tr) => canvasStream.addTrack(tr))

  const mime = pickMime()
  const recorder = new MediaRecorder(canvasStream, { mimeType: mime, videoBitsPerSecond: 10_000_000 })
  const chunks: BlobPart[] = []
  recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data)

  const comp = new Compositor()
  comp.reset()

  const finished = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mime }))
    recorder.onerror = () => reject(new Error('Recording the export failed.'))
  })

  recorder.start(200)
  video.playbackRate = cfg.speed
  await video.play()

  let raf = 0
  const tick = () => {
    if (signal?.aborted) {
      video.pause()
      if (recorder.state !== 'inactive') recorder.stop()
      cancelAnimationFrame(raf)
      return
    }
    comp.draw(ctx, video, video.currentTime, cfg, events, out)
    onProgress?.(Math.min(0.99, video.currentTime / duration))
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)

  await new Promise<void>((res) => {
    video.onended = () => res()
    // Safety: some webm blobs report Infinity duration; stop on a stall past duration.
    const guard = setInterval(() => {
      if (video.currentTime >= duration - 0.05 || video.ended) {
        clearInterval(guard)
        res()
      }
    }, 200)
  })

  cancelAnimationFrame(raf)
  onProgress?.(1)
  // Flush a final frame then stop.
  comp.draw(ctx, video, Math.max(0, duration - 0.001), cfg, events, out)
  if (recorder.state !== 'inactive') recorder.stop()
  return finished
}

/** Some MediaRecorder webm blobs don't expose duration until you seek. */
async function probeDuration(video: HTMLVideoElement): Promise<number> {
  return new Promise((resolve) => {
    const onSeek = () => {
      video.currentTime = 0
      video.removeEventListener('seeked', onSeek)
      resolve(isFinite(video.duration) ? video.duration : 0)
    }
    video.addEventListener('seeked', onSeek)
    video.currentTime = 1e6 // force the browser to compute the real end
    setTimeout(() => resolve(isFinite(video.duration) ? video.duration : 0), 1500)
  })
}

export function fileExtFor(mime: string): string {
  return mime.includes('mp4') ? 'mp4' : 'webm'
}
