/* ============================================================
   Motion engine — video export.
   Renders the project timeline onto an offscreen canvas in real
   time, captures it as a stream, and records it to a downloadable
   video blob. Same renderProject() as the preview → WYSIWYG.
   ============================================================ */

import type { MotionAspect, Project } from '../types'
import { renderProject, totalDuration } from './render'
import { getAudioContext } from './audio'
import { pickMime } from '../recorder'

export const EXPORT_SIZES: Record<MotionAspect, { w: number; h: number }> = {
  '16:9': { w: 1920, h: 1080 },
  '9:16': { w: 1080, h: 1920 },
  '1:1': { w: 1200, h: 1200 },
}

/** Music baked into the export. Times in seconds; when present the video clock follows the audio. */
export type ExportAudio = {
  buffer: AudioBuffer
  volume: number
  fadeIn: number
  fadeOut: number
  offset: number
}

type ExportArgs = {
  project: Project
  audio?: ExportAudio | null
  onProgress?: (fraction: number) => void
  signal?: AbortSignal
}

export async function exportVideo({ project, audio, onProgress, signal }: ExportArgs): Promise<Blob> {
  const dur = totalDuration(project)
  if (dur <= 0) throw new Error('Add at least one scene before exporting.')

  const { w, h } = EXPORT_SIZES[project.aspect]
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  renderProject(ctx, project, 0, w, h) // first frame ready before capture starts

  const stream = canvas.captureStream(30)

  // Mix the music onto the recorded stream (silent to the user — routed only to the recorder).
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
      const now = ac.currentTime
      const startAt = now + 0.12
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
      audioClock = () => ac.currentTime - startAt // video follows the audio for perfect sync
    } catch {
      audioSource = null // export continues silently rather than failing
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
      failed = true // also breaks the render loop below — no fake progress after an encoder death
      reject(new Error('Rendering the video failed.'))
    }
  })
  finished.catch(() => {}) // observed again via `await finished`; this just avoids an unhandled-rejection blast

  // While the tab is hidden rAF stops but MediaRecorder keeps encoding wall time — pause it so
  // a background stint doesn't bake a frozen-frame stretch into the file.
  const onVisibility = () => {
    try {
      if (document.hidden && recorder.state === 'recording') recorder.pause()
      else if (!document.hidden && recorder.state === 'paused') recorder.resume()
    } catch {
      /* recorder already stopped */
    }
  }
  document.addEventListener('visibilitychange', onVisibility)

  recorder.start(200)
  try {
    // Content time advances by CLAMPED frame deltas, not wall clock — dropped frames or a hidden
    // tab slow the render down instead of skipping scenes (the engine is pure in (project, time)).
    let contentT = 0
    let last = performance.now()
    await new Promise<void>((done) => {
      let raf = 0
      const tick = (now: number) => {
        if (signal?.aborted || failed || contentT >= dur) {
          cancelAnimationFrame(raf)
          done()
          return
        }
        // With music, the audio clock is the source of truth so the two never drift; otherwise
        // advance by clamped wall-clock deltas (survives dropped frames / a hidden tab).
        if (audioClock) contentT = Math.max(contentT, audioClock())
        else contentT += Math.min(0.1, Math.max(0, (now - last) / 1000))
        last = now
        renderProject(ctx, project, Math.min(contentT, dur - 0.001), w, h)
        onProgress?.(Math.min(0.99, contentT / dur))
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    })

    renderProject(ctx, project, Math.max(0, dur - 0.001), w, h)
    onProgress?.(1)
    // Give captureStream a beat to grab the final painted frame before stopping.
    await new Promise((r) => setTimeout(r, 80))
  } finally {
    document.removeEventListener('visibilitychange', onVisibility)
    try {
      audioSource?.stop()
    } catch {
      /* already stopped */
    }
    try {
      if (recorder.state !== 'inactive') recorder.stop()
    } catch {
      /* already stopped */
    }
  }
  const blob = await finished
  if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError')
  return blob
}
