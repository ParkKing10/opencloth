/* ============================================================
   Clip Director — turns (type + prompt + assets) into THREE
   distinct versions the user can pick from.

   Scene modes emit deterministic engine specs (one `custom`
   scene: elements + camera + cursor) rendered by renderProject —
   the user never sees any of that vocabulary. The uploaded
   screenshot/image IS the pixels on screen (never a fake UI; the
   generator never emits `mockup` elements). Recording mode cuts
   real footage via recordingAnalysis → adPlan → adCompose.

   When an OpenAI key is configured (Settings → AI), version A is
   drafted by the model; B and C stay deterministic so Generate
   always returns three takes. No key → all three are local.
   ============================================================ */

import type { CameraKey, Project, Scene, SceneElement } from './types'
import { uid } from './types'
import type { Clip, ClipVersion, VersionLabel } from './clipModel'
import type { AssetMeta } from './engine/assets'
import { hasDirectorAi, draftProject } from './engine/aiDirector'
import { DEFAULT_AD_CONFIG, type AdConfig } from './engine/adCompose'
import { buildAdPlan } from './engine/adPlan'
import type { RecordingAnalysis } from './engine/recordingAnalysis'

/* ---------------- prompt → copy ---------------- */

/** Pull the words the clip should SAY: quoted text first, else the prompt itself, else the title. */
export function headlineFrom(clip: Clip): string {
  const quoted = clip.prompt.match(/["“„']([^"”“„']{2,60})["”“']/)
  if (quoted) return quoted[1]
  const clean = clip.prompt.replace(/\s+/g, ' ').trim()
  if (clean.length > 0) return clean.length > 48 ? `${clean.slice(0, 45)}…` : clean
  return clip.title || 'loom studios'
}

const short = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

/* ---------------- spec building blocks ---------------- */

type Recipe = { elements: SceneElement[]; camera?: CameraKey[]; orbs: boolean }

function spec(clip: Clip, accent: string, aspect: Project['aspect'], r: Recipe): ClipVersion {
  const scene: Scene = {
    id: uid(),
    type: 'custom',
    duration: clip.durationSec,
    props: { label: clip.title || clip.type, elements: r.elements, camera: r.camera, orbs: r.orbs },
  }
  const project: Project = {
    version: 1,
    brand: { product: 'loom studios', accent, bg: 'midnight' },
    aspect,
    scenes: [scene],
  }
  return { id: uid(), label: 'A', kind: 'scene', spec: project }
}

const text = (t: string, x: number, y: number, size: 'sm' | 'md' | 'lg' | 'xl', color: 'white' | 'muted' | 'accent', at: number, opts: Partial<SceneElement> = {}): SceneElement =>
  ({ id: uid(), kind: 'text', text: t, size, color, x, y, maxWidth: 0.82, enter: { effect: 'rise', at, dur: 0.22 }, ...opts }) as SceneElement

const image = (assetId: string, x: number, y: number, w: number, at: number, opts: Partial<SceneElement> = {}): SceneElement =>
  ({ id: uid(), kind: 'image', assetId, x, y, w, radius: 14, shadow: true, enter: { effect: 'rise', at, dur: 0.25 }, ...opts }) as SceneElement

const line = (x: number, y: number, w: number, at: number): SceneElement =>
  ({ id: uid(), kind: 'shape', shape: 'line', x, y, w, h: 0.006, color: 'accent', enter: { effect: 'wipe', at, dur: 0.2 } }) as SceneElement

const circle = (x: number, y: number, w: number, at: number, opacity: number): SceneElement =>
  ({ id: uid(), kind: 'shape', shape: 'circle', x, y, w, h: w, color: 'accent', opacity, enter: { effect: 'pop', at, dur: 0.3 } }) as SceneElement

const chip = (label: string, x: number, y: number, at: number): SceneElement =>
  ({ id: uid(), kind: 'chip', label: short(label, 26), x, y, enter: { effect: 'pop', at, dur: 0.2 } }) as SceneElement

const cursorPath = (points: { at: number; x: number; y: number; click?: boolean }[]): SceneElement =>
  ({ id: uid(), kind: 'cursor', x: points[0].x, y: points[0].y, path: points }) as SceneElement

/** Slow push-in — the cinematic default. */
const pushIn = (cx = 0.5, cy = 0.5, to = 1.08): CameraKey[] => [
  { at: 0, scale: 1, x: 0.5, y: 0.5 },
  { at: 1, scale: to, x: cx, y: cy },
]
/** Zoom onto a point after `when`, then hold. */
const zoomTo = (cx: number, cy: number, when: number, scale: number): CameraKey[] => [
  { at: 0, scale: 1, x: 0.5, y: 0.5 },
  { at: when, scale: 1, x: 0.5, y: 0.5 },
  { at: Math.min(1, when + 0.22), scale, x: cx, y: cy },
  { at: 1, scale, x: cx, y: cy },
]

/* ---------------- per-type recipes (A/B/C) ----------------
   A = cinematic & calm, B = dynamic, C = bold/typographic.
   `style` nudges all three (minimal kills orbs, electric adds pulses). */

function recipesFor(clip: Clip, headline: string, nonce: number): Recipe[] {
  const sub = clip.title && clip.title !== headline ? clip.title : ''
  const img = clip.assetIds[0]
  const electric = clip.style === 'electric'
  const orbs = clip.style !== 'minimal'
  const pulse = electric ? { pulseAt: [0.55, 0.8] } : {}
  // Regenerate must feel like new direction: the nonce rotates hotspots & nudges the camera.
  const jitter = (nonce % 3) * 0.05

  /* -- image-led modes -- */
  if (img && (clip.type === 'screenshot' || clip.type === 'shopify' || clip.type === 'workflow')) {
    // The REAL screenshot is the star: cursor moves over it, clicks, camera zooms in.
    // Without vision AI we aim at three different likely hotspots — one per version.
    const base = [
      { x: 0.74, y: 0.3 }, // top-right actions (Generate/Export live here in most apps)
      { x: 0.5, y: 0.52 }, // dead centre — hero content
      { x: 0.26, y: 0.68 }, // lower-left nav / list
    ]
    const targets = base.map((p, i) => base[(i + nonce) % 3] ?? p).map((p) => ({ x: Math.min(0.9, p.x + jitter), y: Math.max(0.1, p.y - jitter) }))
    return targets.map((tgt, i) => ({
      orbs: false,
      elements: [
        image(img, 0.5, 0.52, i === 1 ? 0.9 : 0.82, 0.02, { frame: 'browser', enter: { effect: i === 2 ? 'pop' : 'rise', at: 0.02, dur: 0.22 } }),
        cursorPath([
          { at: 0.18, x: 0.42, y: 0.62 },
          { at: 0.42, x: tgt.x, y: tgt.y },
          { at: 0.5, x: tgt.x, y: tgt.y, click: true },
          { at: 0.9, x: tgt.x + 0.02, y: tgt.y + 0.02 },
        ]),
        ...(headline ? [chip(headline, 0.5, 0.08, 0.62)] : []),
      ],
      camera: zoomTo(tgt.x, tgt.y, 0.48, i === 2 ? 1.75 : 1.5),
    }))
  }

  if (img && (clip.type === 'garment' || clip.type === 'commercial' || clip.type === 'feature' || clip.type === 'ai-scene' || clip.type === 'custom')) {
    // Cinematic product/garment reveal around the real image.
    return [
      {
        orbs,
        elements: [circle(0.5, 0.5, 0.5, 0, 0.1), image(img, 0.5, 0.46, 0.42, 0.06), text(headline, 0.5, 0.85, 'md', 'white', 0.4, pulse)],
        camera: pushIn(0.5, 0.46, 1.1),
      },
      {
        orbs,
        elements: [image(img, 0.62, 0.5, 0.44, 0.04, { enter: { effect: 'slide-left', at: 0.04, dur: 0.26 } }), text(headline, 0.24, 0.42, 'lg', 'white', 0.2, { maxWidth: 0.34 }), line(0.24, 0.56, 0.16, 0.42), ...(sub ? [text(short(sub, 60), 0.24, 0.64, 'sm', 'muted', 0.5, { maxWidth: 0.34 })] : [])],
        camera: [{ at: 0, scale: 1.04, x: 0.6, y: 0.5 }, { at: 1, scale: 1, x: 0.5, y: 0.5 }],
      },
      {
        orbs: false,
        elements: [image(img, 0.5, 0.5, 0.56, 0, { enter: { effect: 'pop', at: 0, dur: 0.3 } }), text(headline.toUpperCase(), 0.5, 0.9, 'sm', 'accent', 0.5)],
        camera: zoomTo(0.5, 0.42, 0.45, 1.35),
      },
    ]
  }

  if (img && clip.type === 'logo') {
    const name = sub || headlineFrom(clip)
    return [
      { orbs, elements: [circle(0.5, 0.46, 0.34, 0, 0.12), image(img, 0.5, 0.46, 0.2, 0.1, { radius: 0, shadow: false, enter: { effect: 'pop', at: 0.1, dur: 0.3 } }), text(name, 0.5, 0.68, 'md', 'white', 0.45, pulse)], camera: pushIn(0.5, 0.48, 1.06) },
      { orbs: false, elements: [image(img, 0.5, 0.44, 0.16, 0.05, { radius: 0, shadow: false, enter: { effect: 'wipe', at: 0.05, dur: 0.3 } }), line(0.5, 0.58, 0.1, 0.4), text(name, 0.5, 0.66, 'sm', 'muted', 0.5)], camera: undefined },
      { orbs: false, elements: [image(img, 0.5, 0.5, 0.24, 0.15, { radius: 0, shadow: false, enter: { effect: 'fade', at: 0.15, dur: 0.4 } })], camera: [{ at: 0, scale: 1.15, x: 0.5, y: 0.5 }, { at: 1, scale: 1, x: 0.5, y: 0.5 }] },
    ]
  }

  /* -- pure typography / no assets -- */
  const words = headline
  const kicker = clip.type === 'shopify' ? 'NOW LIVE' : clip.type === 'workflow' ? 'AI WORKFLOW' : ''
  return [
    {
      orbs,
      elements: [...(kicker ? [chip(kicker, 0.5, 0.34, 0.05)] : []), text(words, 0.5, 0.48, 'xl', 'white', 0.15, { kinetic: true, ...pulse }), line(0.5, 0.62, 0.12, 0.55), ...(sub ? [text(short(sub, 70), 0.5, 0.7, 'sm', 'muted', 0.65)] : [])],
      camera: pushIn(0.5, 0.5, 1.07),
    },
    {
      orbs,
      elements: [text(words, 0.42, 0.5, 'lg', 'white', 0.1, { kinetic: true, maxWidth: 0.55, enter: { effect: 'slide-right', at: 0.1, dur: 0.25 } }), circle(0.82, 0.32, 0.2, 0.3, 0.16), circle(0.88, 0.7, 0.12, 0.45, 0.12), ...(sub ? [text(short(sub, 60), 0.42, 0.68, 'sm', 'accent', 0.55, { maxWidth: 0.5 })] : [])],
      camera: [{ at: 0, scale: 1, x: 0.45, y: 0.5 }, { at: 1, scale: 1.09, x: 0.55, y: 0.48 }],
    },
    {
      orbs: false,
      elements: [text(words.toUpperCase(), 0.5, 0.5, 'xl', 'accent', 0.08, { kinetic: true, pulseAt: electric ? [0.5, 0.7, 0.9] : [0.6] })],
      camera: [{ at: 0, scale: 1.18, x: 0.5, y: 0.5 }, { at: 0.5, scale: 1, x: 0.5, y: 0.5 }, { at: 1, scale: 1.03, x: 0.5, y: 0.5 }],
    },
  ]
}

/* ---------------- AI draft (optional, honest fallback) ---------------- */

async function aiRecipe(clip: Clip, assets: AssetMeta[], accent: string): Promise<Recipe | null> {
  if (!hasDirectorAi()) return null
  const brief = `ONE clip for a commercial, ${clip.durationSec}s, style "${clip.style}", type "${clip.type}".
${clip.prompt || clip.title}
HARD RULES: return exactly ONE scene of type "custom". Never use "mockup" elements — if an ASSET image exists, show the real asset (kind "image"). Keep it minimal and premium.`
  const res = await draftProject(brief, { product: 'loom studios', accent, bg: 'midnight' }, assets.filter((a) => clip.assetIds.includes(a.id)))
  if (!res.ok) return null
  const scene = res.value.find((s): s is Extract<Scene, { type: 'custom' }> => s.type === 'custom')
  if (!scene) return null
  // The one rule the model must not break: no fake UI.
  const elements = scene.props.elements.filter((e) => e.kind !== 'mockup')
  if (elements.length === 0) return null
  return { elements, camera: scene.props.camera, orbs: scene.props.orbs !== false }
}

/* ---------------- public: scene modes ---------------- */

export async function generateSceneVersions(clip: Clip, assets: AssetMeta[], accent: string, aspect: Project['aspect'], nonce = 0): Promise<ClipVersion[]> {
  const headline = headlineFrom(clip)
  const local = recipesFor(clip, headline, nonce)
  const ai = await aiRecipe(clip, assets, accent).catch(() => null)
  const picked: Recipe[] = ai ? [ai, local[1], local[2]] : local
  const labels: VersionLabel[] = ['A', 'B', 'C']
  return picked.map((r, i) => ({ ...spec(clip, accent, aspect, r), label: labels[i] }))
}

/* ---------------- public: recording mode ---------------- */

/** Three cuts of the same footage: cinematic / fast / raw. Intro & outro are 0 —
    a clip is independent; cards and CTAs are their own clips now. */
export function generateFootageVersions(analysis: RecordingAnalysis, accent: string): { versions: ClipVersion[]; durations: number[] } {
  const takes: { deadSpeed: number; cfg: Partial<AdConfig> }[] = [
    { deadSpeed: 8, cfg: { zoom: 1.15, vignette: 1.15, accentUse: 1 } },
    { deadSpeed: 14, cfg: { zoom: 1.35, vignette: 1, accentUse: 1.2 } },
    { deadSpeed: 5, cfg: { zoom: 0.9, vignette: 0.8, accentUse: 0.6 } },
  ]
  const labels: VersionLabel[] = ['A', 'B', 'C']
  const versions: ClipVersion[] = []
  const durations: number[] = []
  takes.forEach((t, i) => {
    const plan = buildAdPlan(analysis, { deadSpeed: t.deadSpeed })
    const cfg: AdConfig = { ...DEFAULT_AD_CONFIG, ...t.cfg, intro: 0, outro: 0, headline: '', accent, edits: [] }
    versions.push({ id: uid(), label: labels[i], kind: 'footage', plan, cfg })
    durations.push(plan.cutDuration)
  })
  return { versions, durations }
}
