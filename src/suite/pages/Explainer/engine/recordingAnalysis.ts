/* ============================================================
   Ad Director — recording analysis.
   The "AI watches your screen recording" magic. We sample the
   uploaded video, measure how much changes frame-to-frame, and
   from that signal detect:
     - KEY MOMENTS  (activity spikes: a click, a menu opening, the
                     product appearing) → where the story happens
     - DEAD ZONES   (long low-activity stretches: loading, nothing
                     happening) → what to trim or speed up

   The signal processing (detectMoments) is a pure function so it is
   fully unit-tested; the video sampling wraps it with real frames.
   ============================================================ */

export type MomentKind = 'action' | 'reveal'
export type Moment = { t: number; strength: number; kind: MomentKind }
export type DeadZone = { start: number; end: number }

export type RecordingAnalysis = {
  duration: number
  /** Normalised activity 0..1 at each sampled time. */
  activity: number[]
  times: number[]
  moments: Moment[]
  deadZones: DeadZone[]
  /** Data-URL thumbnails at the strongest moments (for the storyboard). */
  thumbs: { t: number; url: string }[]
}

export type DetectOptions = {
  /** A moment must stand this many std-devs above the mean. */
  peakZ?: number
  /** Minimum seconds between two moments. */
  minGap?: number
  /** Activity below this (0..1) counts as "dead". */
  deadBelow?: number
  /** A dead zone must last at least this many seconds. */
  minDead?: number
}

const mean = (a: number[]): number => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0)
const std = (a: number[], m: number): number => (a.length ? Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length) : 0)

/** Light 3-tap smoothing to kill single-sample jitter. */
function smooth(a: number[]): number[] {
  if (a.length < 3) return a.slice()
  const out = a.slice()
  for (let i = 1; i < a.length - 1; i++) out[i] = (a[i - 1] + 2 * a[i] + a[i + 1]) / 4
  return out
}

/**
 * Pure detector: given an activity envelope + its sample times, find the key moments (peaks) and
 * the dead zones (long low-activity runs). Deterministic — same input, same output.
 */
export function detectMoments(activityRaw: number[], times: number[], opts: DetectOptions = {}): { moments: Moment[]; deadZones: DeadZone[] } {
  const { peakZ = 1.15, minGap = 0.7, deadBelow = 0.14, minDead = 1.1 } = opts
  const n = activityRaw.length
  if (n === 0) return { moments: [], deadZones: [] }
  const activity = smooth(activityRaw)
  const m = mean(activity)
  const s = std(activity, m)
  const thresh = m + peakZ * s

  // Peaks: local maxima above threshold, spaced at least minGap apart (keep the strongest in a cluster).
  const peaks: Moment[] = []
  for (let i = 0; i < n; i++) {
    const v = activity[i]
    if (v < thresh) continue
    const isLocalMax = (i === 0 || activity[i] >= activity[i - 1]) && (i === n - 1 || activity[i] >= activity[i + 1])
    if (!isLocalMax) continue
    const t = times[i]
    const last = peaks[peaks.length - 1]
    if (last && t - last.t < minGap) {
      if (v > last.strength) peaks[peaks.length - 1] = { t, strength: v, kind: v > m + 2 * s ? 'reveal' : 'action' }
    } else {
      peaks.push({ t, strength: v, kind: v > m + 2 * s ? 'reveal' : 'action' })
    }
  }
  // Normalise strengths to 0..1 for display.
  const maxStrength = peaks.reduce((mx, p) => Math.max(mx, p.strength), 1e-6)
  const moments = peaks.map((p) => ({ ...p, strength: Math.min(1, p.strength / maxStrength) }))

  // Dead zones: contiguous runs below deadBelow lasting at least minDead.
  const deadZones: DeadZone[] = []
  let runStart = -1
  for (let i = 0; i < n; i++) {
    const low = activity[i] < deadBelow
    if (low && runStart < 0) runStart = i
    if ((!low || i === n - 1) && runStart >= 0) {
      const endI = low ? i : i - 1
      const start = times[runStart]
      const end = times[endI]
      if (end - start >= minDead) deadZones.push({ start, end })
      runStart = -1
    }
  }

  return { moments, deadZones }
}

/* ---------------- video sampling ---------------- */

function loadVideo(src: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video')
    v.muted = true
    v.playsInline = true
    v.preload = 'auto'
    v.crossOrigin = 'anonymous'
    v.onloadedmetadata = () => resolve(v)
    v.onerror = () => reject(new Error('Could not read that video.'))
    v.src = src
  })
}

function seek(v: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      v.removeEventListener('seeked', onSeeked)
      resolve()
    }
    v.addEventListener('seeked', onSeeked)
    v.currentTime = Math.min(t, Math.max(0, (v.duration || 0) - 0.05))
  })
}

/**
 * Analyse a screen recording: sample frames, measure frame-to-frame change, and detect the key
 * moments + dead zones. `onProgress` reports 0..1 while sampling.
 */
export async function analyzeRecording(
  src: string,
  opts: DetectOptions & { fps?: number; onProgress?: (p: number) => void } = {},
): Promise<RecordingAnalysis> {
  const { fps = 6, onProgress } = opts
  const video = await loadVideo(src)
  const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0
  if (duration === 0) throw new Error('That video has no readable duration.')

  const W = 160
  const H = Math.max(2, Math.round((video.videoHeight / Math.max(1, video.videoWidth)) * W)) || 90
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!

  const step = 1 / fps
  const times: number[] = []
  const activity: number[] = []
  let prev: Uint8ClampedArray | null = null
  let peakDiff = 1e-6
  const thumbs: { t: number; url: string }[] = []

  const total = Math.max(1, Math.floor(duration / step))
  let idx = 0
  for (let t = 0; t < duration; t += step, idx++) {
    await seek(video, t)
    ctx.drawImage(video, 0, 0, W, H)
    const frame = ctx.getImageData(0, 0, W, H).data
    let diff = 0
    if (prev) {
      // Mean absolute luma difference — cheap, robust to compression noise.
      let acc = 0
      for (let i = 0; i < frame.length; i += 4) {
        const l1 = frame[i] * 0.299 + frame[i + 1] * 0.587 + frame[i + 2] * 0.114
        const l0 = prev[i] * 0.299 + prev[i + 1] * 0.587 + prev[i + 2] * 0.114
        acc += Math.abs(l1 - l0)
      }
      diff = acc / (frame.length / 4)
    }
    prev = frame.slice()
    times.push(t)
    activity.push(diff)
    if (diff > peakDiff) peakDiff = diff
    onProgress?.(idx / total)
  }

  // Normalise activity to 0..1.
  const norm = activity.map((d) => d / peakDiff)
  const { moments, deadZones } = detectMoments(norm, times, opts)

  // Grab thumbnails at the top few moments.
  const top = [...moments].sort((a, b) => b.strength - a.strength).slice(0, 6).sort((a, b) => a.t - b.t)
  for (const mo of top) {
    await seek(video, mo.t)
    ctx.drawImage(video, 0, 0, W, H)
    thumbs.push({ t: mo.t, url: canvas.toDataURL('image/jpeg', 0.6) })
  }

  onProgress?.(1)
  return { duration, activity: norm, times, moments, deadZones, thumbs }
}
