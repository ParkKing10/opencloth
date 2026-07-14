/* ============================================================
   Explainer Studio — shared types.

   Two creation modes live on this page:
   1. MOTION — an After-Effects-style, fully code-driven explainer:
      scenes (intro / statement / feature demo / stats / CTA) are
      rendered procedurally on canvas and exported as video.
   2. RECORD — the screen recorder with baked-in zoom effects.
   ============================================================ */

/* ---------------- motion mode ---------------- */

export type MotionAspect = '16:9' | '9:16' | '1:1'

export type BgKey = 'midnight' | 'aurora' | 'sunset' | 'mono'

export type Brand = {
  /** Product name shown in logo, mock UI and CTA. */
  product: string
  /** Accent hex colour driving every highlight in the video. */
  accent: string
  bg: BgKey
}

export type DemoKind = 'dashboard' | 'analytics'

export type IntroProps = { title: string; tagline: string }
export type StatementProps = { text: string; highlight: string }
export type FeatureProps = {
  heading: string
  caption: string
  demo: DemoKind
  calloutA: string
  calloutB: string
}
export type StatItem = { value: number; suffix: string; label: string }
export type StatsProps = { heading: string; stats: StatItem[] }
export type CtaProps = { title: string; sub: string; button: string; url: string }

/* ---- free composition (AI-directed "custom" scenes) ----
   All positions are normalised 0..1 of the canvas (x,y = element centre).
   All times (`at`, `dur`) are FRACTIONS of the scene duration — that is how
   the AI reasons about beats, and it survives duration edits. */

export type AnimEffect = 'fade' | 'rise' | 'drop' | 'slide-left' | 'slide-right' | 'pop' | 'wipe'
export type Anim = { effect: AnimEffect; at: number; dur: number }

type ElementBase = {
  id: string
  x: number
  y: number
  enter?: Anim
  exit?: Anim
  /** Beat times (fractions) at which the element briefly pulses for emphasis. */
  pulseAt?: number[]
}

export type TextEl = ElementBase & {
  kind: 'text'
  text: string
  size: 'sm' | 'md' | 'lg' | 'xl'
  color: 'white' | 'muted' | 'accent'
  /** Reveal word-by-word instead of as a block. */
  kinetic?: boolean
  /** Max width as fraction of canvas width (wrapping). */
  maxWidth?: number
}
export type ImageEl = ElementBase & {
  kind: 'image'
  /** References an uploaded asset (screenshot / logo). */
  assetId: string
  /** Width as fraction of canvas width; height follows the image ratio. */
  w: number
  frame?: 'none' | 'browser'
  radius?: number
  shadow?: boolean
}
export type ShapeEl = ElementBase & {
  kind: 'shape'
  shape: 'rect' | 'circle' | 'line'
  w: number
  h: number
  color: 'accent' | 'white' | 'muted' | 'panel'
  radius?: number
  opacity?: number
}
export type ButtonEl = ElementBase & { kind: 'button'; label: string; clickAt?: number }
export type ChipEl = ElementBase & { kind: 'chip'; label: string }
export type ChartEl = ElementBase & { kind: 'chart'; chart: 'line' | 'bars'; w: number; h: number }
export type MockupEl = ElementBase & { kind: 'mockup'; w: number; demo: DemoKind }
export type CursorEl = ElementBase & {
  kind: 'cursor'
  path: { at: number; x: number; y: number; click?: boolean }[]
}

export type SceneElement = TextEl | ImageEl | ShapeEl | ButtonEl | ChipEl | ChartEl | MockupEl | CursorEl
export type ElementKind = SceneElement['kind']

export type CameraKey = { at: number; scale: number; x: number; y: number }

export type CustomProps = {
  /** Short label shown in the scene list. */
  label: string
  elements: SceneElement[]
  camera?: CameraKey[]
  /** Floating bokeh orbs behind the elements. */
  orbs?: boolean
}

export type Scene =
  | { id: string; type: 'intro'; duration: number; props: IntroProps }
  | { id: string; type: 'statement'; duration: number; props: StatementProps }
  | { id: string; type: 'feature'; duration: number; props: FeatureProps }
  | { id: string; type: 'stats'; duration: number; props: StatsProps }
  | { id: string; type: 'cta'; duration: number; props: CtaProps }
  | { id: string; type: 'custom'; duration: number; props: CustomProps }

export type SceneType = Scene['type']

/* ---- audio ----
   The project references ONE uploaded music track (asset id in the audio store) plus a mix.
   Beat analysis is derived data cached per asset in the audio store — never in the project. */
export type ProjectAudio = {
  /** Id in the audio asset store (engine/audio.ts). */
  assetId: string
  name: string
  /** Music level 0..1. */
  volume: number
  /** Fade in / out in seconds. */
  fadeIn: number
  fadeOut: number
  /** Seconds into the track where the video starts (lets the user pick a section). */
  offset: number
}

export type Project = {
  version: 1
  brand: Brand
  aspect: MotionAspect
  scenes: Scene[]
  /** Background music track + mix, if the user added one. */
  audio?: ProjectAudio
}

export const uid = (): string => Math.random().toString(36).slice(2, 10)

/** Fresh scene of the given type with sensible starter copy. */
export function defaultScene(type: SceneType): Scene {
  switch (type) {
    case 'intro':
      return {
        id: uid(),
        type: 'intro',
        duration: 4,
        props: { title: 'Meet loom studios', tagline: 'The operating system for fashion brands' },
      }
    case 'statement':
      return {
        id: uid(),
        type: 'statement',
        duration: 3.5,
        props: { text: 'Designing a collection shouldn’t take months', highlight: 'months' },
      }
    case 'feature':
      return {
        id: uid(),
        type: 'feature',
        duration: 8,
        props: {
          heading: 'One studio for every garment',
          caption: 'Design, iterate and approve — in real time',
          demo: 'dashboard',
          calloutA: 'Live analytics',
          calloutB: 'One-click approve',
        },
      }
    case 'stats':
      return {
        id: uid(),
        type: 'stats',
        duration: 5,
        props: {
          heading: 'Teams ship faster with loom',
          stats: [
            { value: 12, suffix: 'k+', label: 'Designs shipped' },
            { value: 4.9, suffix: '★', label: 'Average rating' },
            { value: 68, suffix: '%', label: 'Faster to production' },
          ],
        },
      }
    case 'cta':
      return {
        id: uid(),
        type: 'cta',
        duration: 4.5,
        props: {
          title: 'Start creating today',
          sub: 'Free for your first collection',
          button: 'Try it free',
          url: 'loomstudios.app',
        },
      }
    case 'custom':
      return {
        id: uid(),
        type: 'custom',
        duration: 5,
        props: {
          label: 'New scene',
          orbs: true,
          elements: [
            {
              id: uid(),
              kind: 'text',
              text: 'Describe this scene to the AI →',
              size: 'lg',
              color: 'white',
              x: 0.5,
              y: 0.5,
              kinetic: true,
              enter: { effect: 'rise', at: 0.05, dur: 0.25 },
            },
          ],
        },
      }
  }
}

/** The starter template: a complete 5-scene SaaS explainer (~25s). */
export function defaultProject(): Project {
  return {
    version: 1,
    brand: { product: 'loom studios', accent: '#d1f94f', bg: 'midnight' },
    aspect: '16:9',
    scenes: [defaultScene('intro'), defaultScene('statement'), defaultScene('feature'), defaultScene('stats'), defaultScene('cta')],
  }
}

/* ---------------- record mode (screen recorder) ---------------- */

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

/** Every knob the screen-recording compositor understands. */
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
