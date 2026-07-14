/* ============================================================
   Motion engine — audio.
   The music pillar: upload a track, decode it, draw its waveform,
   detect beats (BPM + beat grid + strong beats / drops), and play
   it back in lockstep with the preview timeline.

   Everything is dependency-free Web Audio. Audio blobs live in
   their own IndexedDB store (they are large); decoded buffers and
   beat analyses are cached in memory per asset id.
   ============================================================ */

import { uid } from '../types'

const DB_NAME = 'loom-explainer-audio'
const STORE = 'audio'

export type AudioMeta = { id: string; name: string; type: string; size: number; duration: number; addedAt: number }
type AudioRow = AudioMeta & { blob: Blob }

/** Result of analysing a track. All times are absolute seconds into the track. */
export type AudioBeats = {
  bpm: number
  /** Even beat grid across the track. */
  beats: number[]
  /** The most energetic beats (downbeats / drops) — good sync targets. */
  strongBeats: number[]
  duration: number
}

/* ---------------- IndexedDB store ---------------- */

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB unavailable'))
  })
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const req = run(t.objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'))
        t.oncomplete = () => db.close()
      }),
  )
}

/* ---------------- shared AudioContext ---------------- */

let ctx: AudioContext | null = null
export function getAudioContext(): AudioContext {
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ctx = new Ctor()
  }
  // Browsers suspend the context until a user gesture; resume opportunistically.
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/* ---------------- caches ---------------- */

const bufferCache = new Map<string, AudioBuffer>()
const beatsCache = new Map<string, AudioBeats>()

/* ---------------- store API ---------------- */

export async function saveAudioAsset(file: File): Promise<AudioMeta> {
  const id = uid()
  // Decode once up front to learn the real duration and warm the cache.
  let duration = 0
  try {
    const buf = await getAudioContext().decodeAudioData(await file.slice().arrayBuffer())
    bufferCache.set(id, buf)
    duration = buf.duration
  } catch {
    throw new Error('That audio file could not be decoded.')
  }
  const row: AudioRow = {
    id,
    name: file.name.slice(0, 80) || 'music',
    type: file.type || 'audio/mpeg',
    size: file.size,
    duration,
    addedAt: Date.now(),
    blob: file,
  }
  await tx('readwrite', (s) => s.put(row))
  return { id, name: row.name, type: row.type, size: row.size, duration, addedAt: row.addedAt }
}

export async function listAudioAssets(): Promise<AudioMeta[]> {
  try {
    const rows = await tx<AudioRow[]>('readonly', (s) => s.getAll() as IDBRequest<AudioRow[]>)
    return rows
      .map(({ id, name, type, size, duration, addedAt }) => ({ id, name, type, size, duration, addedAt }))
      .sort((a, b) => b.addedAt - a.addedAt)
  } catch {
    return []
  }
}

export async function deleteAudioAsset(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id))
  bufferCache.delete(id)
  beatsCache.delete(id)
}

/** Decode (or read from cache) the AudioBuffer for an asset. */
export async function decodeAudioAsset(id: string): Promise<AudioBuffer | null> {
  const cached = bufferCache.get(id)
  if (cached) return cached
  try {
    const row = await tx<AudioRow | undefined>('readonly', (s) => s.get(id) as IDBRequest<AudioRow | undefined>)
    if (!row?.blob) return null
    const buf = await getAudioContext().decodeAudioData(await row.blob.arrayBuffer())
    bufferCache.set(id, buf)
    return buf
  } catch {
    return null
  }
}

/* ---------------- waveform ---------------- */

/** Peak amplitude (0..1) per bucket, for drawing the waveform strip. */
export function computeWaveform(buffer: AudioBuffer, buckets: number): Float32Array {
  const ch = buffer.getChannelData(0)
  const n = ch.length
  const per = Math.max(1, Math.floor(n / buckets))
  const out = new Float32Array(buckets)
  let peak = 1e-6
  for (let b = 0; b < buckets; b++) {
    const start = b * per
    let max = 0
    for (let i = 0; i < per && start + i < n; i++) {
      const v = Math.abs(ch[start + i])
      if (v > max) max = v
    }
    out[b] = max
    if (max > peak) peak = max
  }
  // Normalise so the loudest bucket fills the strip.
  for (let b = 0; b < buckets; b++) out[b] = out[b] / peak
  return out
}

/* ---------------- beat detection ---------------- */

/** Downmix to a mono Float32Array. */
function toMono(buffer: AudioBuffer): Float32Array {
  const chs = buffer.numberOfChannels
  const n = buffer.length
  if (chs === 1) return buffer.getChannelData(0)
  const out = new Float32Array(n)
  for (let c = 0; c < chs; c++) {
    const d = buffer.getChannelData(c)
    for (let i = 0; i < n; i++) out[i] += d[i]
  }
  for (let i = 0; i < n; i++) out[i] /= chs
  return out
}

/**
 * Energy-flux onset envelope + autocorrelation tempo + phase-aligned beat grid.
 * Deterministic (no randomness) so the same file always yields the same beats.
 */
export function detectBeats(buffer: AudioBuffer): AudioBeats {
  const sr = buffer.sampleRate
  const mono = toMono(buffer)
  const hop = 512
  const frames = Math.floor(mono.length / hop)
  const secPerFrame = hop / sr

  // Short-time energy → positive flux (onset strength).
  const energy = new Float32Array(frames)
  for (let f = 0; f < frames; f++) {
    let e = 0
    const start = f * hop
    for (let i = 0; i < hop; i++) {
      const v = mono[start + i]
      e += v * v
    }
    energy[f] = e
  }
  const flux = new Float32Array(frames)
  for (let f = 1; f < frames; f++) flux[f] = Math.max(0, energy[f] - energy[f - 1])
  // Normalise flux.
  let fmax = 1e-9
  for (let f = 0; f < frames; f++) if (flux[f] > fmax) fmax = flux[f]
  for (let f = 0; f < frames; f++) flux[f] /= fmax

  // Tempo via autocorrelation of the flux envelope over 60..180 BPM.
  const minBpm = 70
  const maxBpm = 180
  const minLag = Math.max(1, Math.round(60 / maxBpm / secPerFrame))
  const maxLag = Math.round(60 / minBpm / secPerFrame)
  let bestLag = minLag
  let bestScore = -1
  for (let lag = minLag; lag <= maxLag && lag < frames; lag++) {
    let s = 0
    for (let f = 0; f < frames - lag; f++) s += flux[f] * flux[f + lag]
    // Slight preference for tempi near 120 BPM avoids octave errors on sparse tracks.
    const bpm = 60 / (lag * secPerFrame)
    const centred = s * (1 - 0.08 * Math.abs(Math.log2(bpm / 120)))
    if (centred > bestScore) {
      bestScore = centred
      bestLag = lag
    }
  }
  let period = bestLag * secPerFrame // seconds per beat
  let bpm = 60 / period
  // Keep tempo in a musical range by octave folding.
  while (bpm < minBpm) {
    bpm *= 2
    period /= 2
  }
  while (bpm > maxBpm) {
    bpm /= 2
    period *= 2
  }

  // Phase: slide a beat grid and pick the offset that lands most onset energy on beats.
  const periodFrames = Math.max(1, period / secPerFrame)
  let bestPhase = 0
  let bestPhaseScore = -1
  const phaseSteps = Math.min(64, Math.round(periodFrames))
  for (let p = 0; p < phaseSteps; p++) {
    const phase = (p / phaseSteps) * periodFrames
    let s = 0
    for (let f = phase; f < frames; f += periodFrames) {
      const idx = Math.round(f)
      if (idx < frames) s += flux[idx]
    }
    if (s > bestPhaseScore) {
      bestPhaseScore = s
      bestPhase = phase
    }
  }

  // Emit the beat grid + measure each beat's local onset energy.
  const beats: number[] = []
  const beatEnergy: number[] = []
  for (let f = bestPhase; f < frames; f += periodFrames) {
    const idx = Math.round(f)
    const t = idx * secPerFrame
    if (t < 0 || t > buffer.duration) continue
    // Local onset strength in a small window around the beat.
    let e = 0
    for (let k = -2; k <= 2; k++) {
      const j = idx + k
      if (j >= 0 && j < frames) e += flux[j]
    }
    beats.push(t)
    beatEnergy.push(e)
  }

  // Strong beats: those clearly above the median (drops / downbeats), plus every 4th beat as a
  // musical fallback so a flat track still has a downbeat grid.
  const sorted = [...beatEnergy].sort((a, b) => a - b)
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0
  const strongBeats: number[] = []
  for (let i = 0; i < beats.length; i++) {
    if (beatEnergy[i] >= median * 1.6 || i % 4 === 0) strongBeats.push(beats[i])
  }

  return { bpm: Math.round(bpm * 10) / 10, beats, strongBeats, duration: buffer.duration }
}

/** Analyse (or read from cache) the beats of an asset. */
export async function analyzeBeats(id: string): Promise<AudioBeats | null> {
  const cached = beatsCache.get(id)
  if (cached) return cached
  const buf = await decodeAudioAsset(id)
  if (!buf) return null
  const beats = detectBeats(buf)
  beatsCache.set(id, beats)
  return beats
}

/** Nearest beat time (absolute track seconds) to `t`; optionally only strong beats. */
export function nearestBeat(beats: AudioBeats, t: number, strongOnly = false): number | null {
  const list = strongOnly ? beats.strongBeats : beats.beats
  if (!list.length) return null
  let best = list[0]
  let bestD = Math.abs(list[0] - t)
  for (const b of list) {
    const d = Math.abs(b - t)
    if (d < bestD) {
      bestD = d
      best = b
    }
  }
  return best
}

/* ---------------- synced playback ---------------- */

/**
 * Plays an AudioBuffer locked to the preview transport. The editor owns the clock;
 * it calls start(atProjectTime) on play and stop() on pause/scrub, so audio never
 * drifts from the visuals.
 */
export class AudioPlayer {
  private buffer: AudioBuffer | null = null
  private source: AudioBufferSourceNode | null = null
  private gain: GainNode | null = null
  private mix = { volume: 0.8, fadeIn: 0.4, fadeOut: 0.8, offset: 0 }
  private muted = false

  setBuffer(buf: AudioBuffer | null): void {
    this.buffer = buf
  }
  setMix(mix: { volume: number; fadeIn: number; fadeOut: number; offset: number }): void {
    this.mix = mix
    if (this.gain) this.gain.gain.value = this.muted ? 0 : mix.volume
  }
  setMuted(m: boolean): void {
    this.muted = m
    if (this.gain) this.gain.gain.value = m ? 0 : this.mix.volume
  }

  /** Begin playback so that preview time `projectTime` is heard now. `totalDuration` bounds fade-out. */
  start(projectTime: number, totalDuration: number): void {
    this.stop()
    if (!this.buffer || this.muted) return
    const ac = getAudioContext()
    void ac.resume()
    const src = ac.createBufferSource()
    src.buffer = this.buffer
    const gain = ac.createGain()
    src.connect(gain).connect(ac.destination)

    const trackTime = this.mix.offset + Math.max(0, projectTime)
    if (trackTime >= this.buffer.duration) return
    const now = ac.currentTime
    const vol = this.mix.volume

    // Fade in only when starting from the very top; fade out approaching the video end.
    const g = gain.gain
    g.cancelScheduledValues(now)
    if (projectTime <= 0.02 && this.mix.fadeIn > 0) {
      g.setValueAtTime(0.0001, now)
      g.linearRampToValueAtTime(vol, now + this.mix.fadeIn)
    } else {
      g.setValueAtTime(vol, now)
    }
    const remaining = totalDuration - projectTime
    if (this.mix.fadeOut > 0 && remaining > 0) {
      const fadeStart = now + Math.max(0, remaining - this.mix.fadeOut)
      g.setValueAtTime(vol, fadeStart)
      g.linearRampToValueAtTime(0.0001, now + remaining)
    }

    src.start(now, trackTime)
    this.source = src
    this.gain = gain
  }

  stop(): void {
    if (this.source) {
      try {
        this.source.stop()
      } catch {
        /* already stopped */
      }
      try {
        this.source.disconnect()
      } catch {
        /* noop */
      }
      this.source = null
    }
    this.gain = null
  }
}
