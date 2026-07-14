/* ============================================================
   Ad Director — refine.
   Two ways to steer the finished ad, both in plain language, never
   scene/element jargon:
     1. VIBES (whole ad): "more Apple", "faster", "more zoom",
        "calmer", "more emotional" → nudge a handful of style knobs.
     2. LOCAL EDITS (a point in the video): click at second N and say
        "zoom here", "slower here", "text away here" → a time-anchored
        override the compositor applies.
   Pure + deterministic; the vibe parser mirrors the local command
   parser so common asks need no API round-trip.
   ============================================================ */

/** Whole-ad style knobs (multipliers around 1, except musicVol 0..1). */
export type StyleParams = {
  zoom: number
  pace: number
  accentUse: number
  vignette: number
  musicVol: number
}

export const DEFAULT_STYLE: StyleParams = { zoom: 1, pace: 1, accentUse: 1, vignette: 1, musicVol: 0.8 }

/** A point edit, anchored at an OUTPUT time (where you clicked in the ad). */
export type LocalEditKind = 'zoom' | 'emphasis' | 'noText'
export type LocalEdit = { id: string; at: number; kind: LocalEditKind }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Apply a set of multiplier nudges to the current style, clamped to sane ranges. */
export function applyVibe(s: StyleParams, mult: Partial<StyleParams>): StyleParams {
  return {
    zoom: clamp(s.zoom * (mult.zoom ?? 1), 0.4, 2.2),
    pace: clamp(s.pace * (mult.pace ?? 1), 0.5, 2.2),
    accentUse: clamp(s.accentUse * (mult.accentUse ?? 1), 0, 1.6),
    vignette: clamp(s.vignette * (mult.vignette ?? 1), 0, 1.6),
    musicVol: clamp(mult.musicVol != null ? mult.musicVol : s.musicVol, 0, 1),
  }
}

/**
 * Parse a vibe instruction into style MULTIPLIERS (to compound onto the current style).
 * Returns null when nothing is recognised (→ hand off to the AI, later).
 */
export function parseVibe(text: string): Partial<StyleParams> | null {
  const t = text.toLowerCase()
  const m: Partial<StyleParams> = {}
  const mul = (k: keyof StyleParams, v: number) => (m[k] = (m[k] ?? 1) * v)

  // Calm / premium / Apple → gentler zoom, less accent, a touch slower + more vignette.
  if (/(apple|clean|cleaner|minimal|premium|hochwertig|edel|ruhig|calm|calmer|elegant|classy)/.test(t)) {
    mul('zoom', 0.8)
    mul('accentUse', 0.7)
    mul('pace', 0.9)
    mul('vignette', 1.12)
  }
  // Energy / hype → snappier + punchier + more accent.
  if (/(energy|energetic|energetisch|hype|bold|aggressive|punchy|punchier|krass|wild)/.test(t)) {
    mul('pace', 1.3)
    mul('zoom', 1.15)
    mul('accentUse', 1.25)
  }
  // Emotional → slower, a little more zoom, moodier.
  if (/(emotion|emotional|emotionaler|cinematic|kino|moody|dramatic|dramatisch)/.test(t)) {
    mul('pace', 0.85)
    mul('zoom', 1.1)
    mul('vignette', 1.15)
  }
  // Pace.
  if (/(faster|schneller|snappier|snappy|quick|quicker|zack)/.test(t)) mul('pace', 1.4)
  if (/(slower|langsamer|slow down|entschleun)/.test(t)) mul('pace', 0.72)
  // Zoom.
  if (/(more zoom|mehr zoom|punch in|näher|closer|zoom in|reinzoom)/.test(t)) mul('zoom', 1.4)
  if (/(less zoom|weniger zoom|zoom out|rauszoom|wider|weiter weg)/.test(t)) mul('zoom', 0.7)
  // Accent / glow.
  if (/(more (accent|glow|pop)|mehr (akzent|glow)|flashier)/.test(t)) mul('accentUse', 1.4)
  if (/(less (accent|glow)|weniger (akzent|glow)|subtle|dezent)/.test(t)) mul('accentUse', 0.6)
  // Music.
  const pct = t.match(/([0-9]{1,3})\s*%/)
  if (pct && /(music|musik|volume|lautstärke|lautstaerke)/.test(t)) m.musicVol = clamp(parseInt(pct[1], 10) / 100, 0, 1)
  else if (/(louder|lauter)/.test(t)) m.musicVol = 0.95
  else if (/(quieter|leiser|softer)/.test(t)) m.musicVol = 0.5

  return Object.keys(m).length ? m : null
}

/** Extra zoom (0..~0.18) contributed by local edits near an output time `t`. */
export function localZoomAt(edits: LocalEdit[], t: number): number {
  let z = 0
  for (const e of edits) {
    if (e.kind !== 'zoom' && e.kind !== 'emphasis') continue
    const d = Math.abs(e.at - t)
    if (d < 0.9) z += (e.kind === 'emphasis' ? 0.14 : 0.11) * (1 - d / 0.9)
  }
  return z
}

/** Whether overlays (accent ring, captions) should be hidden near output time `t`. */
export function textHiddenAt(edits: LocalEdit[], t: number): boolean {
  return edits.some((e) => e.kind === 'noText' && Math.abs(e.at - t) < 1.0)
}

/** Whether a moment should be emphasised (extra accent ring) near output time `t`. */
export function emphasisAt(edits: LocalEdit[], t: number): boolean {
  return edits.some((e) => e.kind === 'emphasis' && Math.abs(e.at - t) < 0.9)
}
