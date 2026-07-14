/* ============================================================
   Explainer Studio — screen recorder
   Wraps getDisplayMedia + MediaRecorder and, when the user is
   recording the app's own tab, records a pointer timeline so the
   compositor can auto-zoom on clicks.
   ============================================================ */

import type { PointerEvt, Take } from './types'

/** Pick the best supported recording MIME type for this browser. */
export function pickMime(): string {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm',
    'video/mp4',
  ]
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c
  }
  return 'video/webm'
}

export function supportsCapture(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getDisplayMedia === 'function' &&
    typeof MediaRecorder !== 'undefined'
  )
}

type StartOpts = {
  /** Also capture microphone audio and mix it with tab/system audio. */
  micAudio: boolean
  /** Called once the picker resolves and recording is actually live. */
  onStart?: () => void
}

/**
 * A live recording session. Call stop() to resolve the finished Take.
 * The pointer timeline is captured from window events, so it is only
 * meaningful when the user shares *this tab* (coords map 1:1 to viewport).
 */
export class RecordingSession {
  private recorder: MediaRecorder
  private chunks: BlobPart[] = []
  private events: PointerEvt[] = []
  private startedAt = 0
  private displayStream: MediaStream
  private micStream: MediaStream | null
  private track: MediaStreamTrack
  private lastMove = 0
  private settle!: (take: Take) => void
  private done: Promise<Take>

  private constructor(display: MediaStream, mic: MediaStream | null, mime: string) {
    this.displayStream = display
    this.micStream = mic
    this.track = display.getVideoTracks()[0]

    // Mix audio: tab/system audio (if any) + optional mic into one stream.
    const audioTracks = [...display.getAudioTracks(), ...(mic ? mic.getAudioTracks() : [])]
    const combined = new MediaStream([this.track, ...audioTracks])

    this.recorder = new MediaRecorder(combined, { mimeType: mime, videoBitsPerSecond: 8_000_000 })
    this.recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) this.chunks.push(e.data)
    }
    this.done = new Promise<Take>((resolve) => {
      this.settle = resolve
    })
    this.recorder.onstop = () => this.finalise(mime)
  }

  static async start(opts: StartOpts): Promise<RecordingSession> {
    const display = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 30 } as MediaTrackConstraints,
      audio: true,
    })
    let mic: MediaStream | null = null
    if (opts.micAudio) {
      try {
        mic = await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch {
        mic = null // mic denied — carry on with whatever audio the display gave us
      }
    }
    const session = new RecordingSession(display, mic, pickMime())
    session.begin()
    opts.onStart?.()
    return session
  }

  private begin() {
    this.startedAt = performance.now()
    this.recorder.start(250)
    window.addEventListener('pointerdown', this.onDown, true)
    window.addEventListener('pointermove', this.onMove, true)
    // If the user stops sharing from the browser's own chrome, finish cleanly.
    this.track.addEventListener('ended', this.onTrackEnded)
  }

  private now() {
    return (performance.now() - this.startedAt) / 1000
  }

  private onDown = (e: PointerEvent) => {
    this.events.push({ t: this.now(), x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight, click: true })
  }

  private onMove = (e: PointerEvent) => {
    // Throttle move samples to ~50/s to keep the timeline light.
    const t = this.now()
    if (t - this.lastMove < 0.02) return
    this.lastMove = t
    this.events.push({ t, x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight, click: false })
  }

  private onTrackEnded = () => {
    if (this.recorder.state !== 'inactive') this.recorder.stop()
  }

  private teardown() {
    window.removeEventListener('pointerdown', this.onDown, true)
    window.removeEventListener('pointermove', this.onMove, true)
    this.track.removeEventListener('ended', this.onTrackEnded)
    this.displayStream.getTracks().forEach((t) => t.stop())
    this.micStream?.getTracks().forEach((t) => t.stop())
  }

  private finalise(mime: string) {
    this.teardown()
    const settings = this.track.getSettings()
    const blob = new Blob(this.chunks, { type: mime })
    const url = URL.createObjectURL(blob)
    // Heuristic: a "browser" display surface means the user shared a tab.
    const surface = (settings as MediaTrackSettings & { displaySurface?: string }).displaySurface
    const trackedTab = surface === 'browser' && this.events.length > 3
    this.settle({
      blob,
      url,
      duration: 0, // filled in by the editor once <video> metadata loads
      events: this.events,
      width: settings.width ?? 1920,
      height: settings.height ?? 1080,
      trackedTab,
    })
  }

  /** Elapsed recording time in seconds (for a live timer). */
  elapsed(): number {
    return this.now()
  }

  stop(): Promise<Take> {
    if (this.recorder.state !== 'inactive') this.recorder.stop()
    return this.done
  }
}
