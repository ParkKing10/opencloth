/* ============================================================
   Explainer Studio — shared types
   A fully client-side screen-recorder + effects compositor.
   Records the screen (getDisplayMedia), tracks pointer events
   for auto-zoom, then bakes cinematic effects (zoom/pan, cursor
   spotlight, click ripples, padded gradient frame) into a
   downloadable video via a canvas render pipeline.
   ============================================================ */

/** A single pointer sample captured during recording. */
export type PointerEvt = {
  /** Seconds since recording start. */
  t: number
  /** Normalised 0..1 position within the captured viewport. */
  x: number
  y: number
  /** Whether this sample is a click (drives auto-zoom + ripple). */
  click: boolean
}

/** Raw output of a recording session, before any effects. */
export type Take = {
  blob: Blob
  /** Object URL for the raw blob (owned by the caller; revoke on discard). */
  url: string
  /** Duration in seconds (best-effort; may be Infinity until metadata loads). */
  duration: number
  /** Pointer timeline captured while recording (empty if not this-tab). */
  events: PointerEvt[]
  /** Native pixel size of the captured video. */
  width: number
  height: number
  /** True when the source is the app's own tab, so events map 1:1. */
  trackedTab: boolean
}

export type AspectKey = '16:9' | '9:16' | '1:1' | 'source'

export type BgStyle = 'aurora' | 'mesh' | 'sunset' | 'slate' | 'transparent'

/** Every knob the compositor understands — driven live from the UI. */
export type EffectConfig = {
  aspect: AspectKey
  background: BgStyle
  /** Frame inset as a fraction of the smaller output dimension (0..0.25). */
  padding: number
  /** Corner radius of the inset video, in output px. */
  radius: number
  /** Drop shadow strength (0..1). */
  shadow: number
  /** Auto-zoom on/off. */
  autoZoom: boolean
  /** Peak zoom scale on a click (1..3). */
  zoomLevel: number
  /** How long a click keeps the zoom held, seconds. */
  zoomHold: number
  /** Cursor spotlight glow + pointer. */
  cursor: boolean
  /** Click ripple rings. */
  ripples: boolean
  /** Playback / export speed multiplier. */
  speed: number
}

export const DEFAULT_CONFIG: EffectConfig = {
  aspect: '16:9',
  background: 'aurora',
  padding: 0.06,
  radius: 18,
  shadow: 0.55,
  autoZoom: true,
  zoomLevel: 1.9,
  zoomHold: 2.4,
  cursor: true,
  ripples: true,
  speed: 1,
}
