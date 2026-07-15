/* ============================================================
   AI Commercial Director — data model.

   A commercial is an ordered list of INDEPENDENT clips. Each clip
   owns its prompt, its assets and its generated versions; the user
   never sees scenes, keyframes or timelines. Under the hood a
   generated version is a deterministic engine spec (one custom
   scene rendered by renderProject) or, for screen recordings, a
   footage plan rendered by composeAdFrame. Specs are tiny JSON —
   they live in localStorage; media lives in IndexedDB (assets.ts).
   ============================================================ */

import type { MotionAspect, Project } from './types'
import { uid } from './types'
import type { AdConfig, } from './engine/adCompose'
import type { AdPlan } from './engine/adPlan'

/* ---------------- clip types (the picker) ---------------- */

export type ClipTypeId =
  | 'ai-scene'
  | 'typography'
  | 'screenshot'
  | 'recording'
  | 'garment'
  | 'shopify'
  | 'logo'
  | 'workflow'
  | 'commercial'
  | 'feature'
  | 'custom'

export type ClipTypeDef = {
  id: ClipTypeId
  emoji: string
  /** i18n keys under director.type.* */
  labelKey: string
  hintKey: string
  /** What the generator can use. 'video' = screen recording. */
  assets: 'none' | 'image' | 'video' | 'optional'
  /** Prefill for the prompt box (i18n key), so Generate works instantly. */
  promptKey: string
}

export const CLIP_TYPES: ClipTypeDef[] = [
  { id: 'ai-scene', emoji: '✨', labelKey: 'director.type.aiScene', hintKey: 'director.type.aiSceneHint', assets: 'optional', promptKey: 'director.prefill.aiScene' },
  { id: 'typography', emoji: '📝', labelKey: 'director.type.typography', hintKey: 'director.type.typographyHint', assets: 'none', promptKey: 'director.prefill.typography' },
  { id: 'screenshot', emoji: '🖼', labelKey: 'director.type.screenshot', hintKey: 'director.type.screenshotHint', assets: 'image', promptKey: 'director.prefill.screenshot' },
  { id: 'recording', emoji: '🎥', labelKey: 'director.type.recording', hintKey: 'director.type.recordingHint', assets: 'video', promptKey: 'director.prefill.recording' },
  { id: 'garment', emoji: '👕', labelKey: 'director.type.garment', hintKey: 'director.type.garmentHint', assets: 'image', promptKey: 'director.prefill.garment' },
  { id: 'shopify', emoji: '🛍', labelKey: 'director.type.shopify', hintKey: 'director.type.shopifyHint', assets: 'optional', promptKey: 'director.prefill.shopify' },
  { id: 'logo', emoji: '🎨', labelKey: 'director.type.logo', hintKey: 'director.type.logoHint', assets: 'image', promptKey: 'director.prefill.logo' },
  { id: 'workflow', emoji: '🤖', labelKey: 'director.type.workflow', hintKey: 'director.type.workflowHint', assets: 'optional', promptKey: 'director.prefill.workflow' },
  { id: 'commercial', emoji: '🎬', labelKey: 'director.type.commercial', hintKey: 'director.type.commercialHint', assets: 'optional', promptKey: 'director.prefill.commercial' },
  { id: 'feature', emoji: '📦', labelKey: 'director.type.feature', hintKey: 'director.type.featureHint', assets: 'optional', promptKey: 'director.prefill.feature' },
  { id: 'custom', emoji: '🚀', labelKey: 'director.type.custom', hintKey: 'director.type.customHint', assets: 'optional', promptKey: 'director.prefill.custom' },
]

export const clipTypeDef = (id: ClipTypeId): ClipTypeDef => CLIP_TYPES.find((c) => c.id === id) ?? CLIP_TYPES[0]

/* ---------------- styles ---------------- */

export type ClipStyle = 'cinematic' | 'minimal' | 'bold' | 'electric'
export const CLIP_STYLES: ClipStyle[] = ['cinematic', 'minimal', 'bold', 'electric']

/* ---------------- versions ---------------- */

export type VersionLabel = 'A' | 'B' | 'C'

/** A generated take. `scene` versions are pure engine specs; `footage`
    versions cut a screen recording (video lives in memory, keyed by clip). */
export type ClipVersion =
  | { id: string; label: VersionLabel; kind: 'scene'; spec: Project }
  | { id: string; label: VersionLabel; kind: 'footage'; plan: AdPlan; cfg: AdConfig }

/* ---------------- clip ---------------- */

export type ClipStatus = 'draft' | 'generating' | 'ready' | 'accepted'

export type Clip = {
  id: string
  title: string
  type: ClipTypeId
  prompt: string
  /** Image assets owned by this clip (assets.ts ids). */
  assetIds: string[]
  /** Screen-recording file name, when a recording is attached (blob is session-local). */
  recordingName?: string
  /** Target length in seconds (2–8). */
  durationSec: number
  style: ClipStyle
  status: ClipStatus
  versions: ClipVersion[]
  /** Which version the user accepted into the commercial. */
  acceptedId?: string
  /** Post-accept trim, seconds cut from the start/end (project editor). */
  trimStart: number
  trimEnd: number
  /** Optional subtitle line burned in under the clip. */
  caption?: string
}

export const DUR_MIN = 2
export const DUR_MAX = 8

export function newClip(type: ClipTypeId): Clip {
  return {
    id: uid(),
    title: '',
    type,
    prompt: '',
    assetIds: [],
    durationSec: 5,
    style: 'cinematic',
    status: 'draft',
    versions: [],
    trimStart: 0,
    trimEnd: 0,
  }
}

/* ---------------- the commercial (project) ---------------- */

export type TransitionKind = 'cut' | 'fade' | 'zoom'

export type Commercial = {
  version: 2
  id: string
  name: string
  aspect: MotionAspect
  accent: string
  clips: Clip[]
  /** Accepted clip order (ids into clips). */
  order: string[]
  transition: TransitionKind
  /** Music references the audio asset store (engine/audio.ts). */
  music?: { assetId: string; name: string; volume: number; fadeOut: number }
  subtitles: boolean
}

export function newCommercial(): Commercial {
  return {
    version: 2,
    id: uid(),
    name: '',
    aspect: '16:9',
    accent: '#d1f94f',
    clips: [],
    order: [],
    transition: 'fade',
    subtitles: true,
  }
}

/** Accepted clips in play order. */
export function acceptedClips(c: Commercial): Clip[] {
  return c.order.map((id) => c.clips.find((k) => k.id === id)).filter((k): k is Clip => !!k && k.status === 'accepted')
}

export function acceptedVersion(clip: Clip): ClipVersion | undefined {
  return clip.versions.find((v) => v.id === clip.acceptedId)
}

/** Effective play length of an accepted clip after trims. */
export function clipPlayLength(clip: Clip): number {
  return Math.max(0.5, clip.durationSec - clip.trimStart - clip.trimEnd)
}

export function commercialDuration(c: Commercial): number {
  return acceptedClips(c).reduce((s, k) => s + clipPlayLength(k), 0)
}

/* ---------------- persistence ----------------
   Specs are compact JSON (no media) → localStorage is fine. Media
   (images) live in IndexedDB via assets.ts; recordings are session-
   local blobs and deliberately NOT persisted. */

const KEY = 'loom-director-v2'

const num = (v: unknown, lo: number, hi: number, dflt: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt
const str = (v: unknown, dflt = ''): string => (typeof v === 'string' ? v : dflt)

/** A stored version is only usable when its render payload is intact: scene versions
    need a spec with at least one scene, footage versions a plan + cfg (renderProject /
    composeAdFrame would otherwise throw and kill the preview loop). */
function okVersion(v: unknown): v is ClipVersion {
  if (!v || typeof v !== 'object') return false
  const x = v as { id?: unknown; label?: unknown; kind?: unknown; spec?: { scenes?: unknown }; plan?: { clips?: unknown }; cfg?: unknown }
  if (typeof x.id !== 'string' || (x.label !== 'A' && x.label !== 'B' && x.label !== 'C')) return false
  if (x.kind === 'scene') return !!x.spec && Array.isArray(x.spec.scenes) && x.spec.scenes.length > 0
  if (x.kind === 'footage') return !!x.plan && Array.isArray(x.plan.clips) && !!x.cfg && typeof x.cfg === 'object'
  return false
}

/** Rebuild every clip field explicitly (never spread the raw object — hostile payloads
    must not smuggle junk fields or override the validated type/id/status). */
function sanitize(raw: unknown): Commercial | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Partial<Commercial>
  if (r.version !== 2 || !Array.isArray(r.clips)) return null
  const base = newCommercial()
  const clips: Clip[] = (r.clips as unknown[])
    .filter((k): k is Record<string, unknown> => !!k && typeof k === 'object')
    .slice(0, 40)
    .map((raw) => {
      const k = raw as Partial<Clip>
      const fresh = newClip(CLIP_TYPES.some((t) => t.id === k.type) ? (k.type as ClipTypeId) : 'ai-scene')
      let versions = Array.isArray(k.versions) ? k.versions.filter(okVersion).slice(0, 3) : []
      // Footage versions reference session-local blobs — after a reload the video is
      // gone, so those clips honestly fall back to draft (regenerate re-attaches).
      const accepted = versions.find((v) => v.id === k.acceptedId)
      if ((accepted && accepted.kind === 'footage') || (versions.length > 0 && versions.every((v) => v.kind === 'footage'))) {
        versions = []
      }
      const acceptedId = k.status === 'accepted' && typeof k.acceptedId === 'string' && versions.some((v) => v.id === k.acceptedId) ? k.acceptedId : undefined
      const status: ClipStatus = acceptedId ? 'accepted' : versions.length > 0 ? 'ready' : 'draft'
      return {
        ...fresh,
        id: str(k.id, fresh.id),
        title: str(k.title).slice(0, 80),
        prompt: str(k.prompt).slice(0, 600),
        assetIds: Array.isArray(k.assetIds) ? k.assetIds.filter((a): a is string => typeof a === 'string').slice(0, 8) : [],
        recordingName: k.recordingName ? str(k.recordingName).slice(0, 120) : undefined,
        durationSec: num(k.durationSec, DUR_MIN, fresh.type === 'recording' ? DUR_MAX * 8 : DUR_MAX, 5), // only footage may exceed 8s
        style: CLIP_STYLES.includes(k.style as ClipStyle) ? (k.style as ClipStyle) : 'cinematic',
        status,
        versions,
        acceptedId,
        trimStart: num(k.trimStart, 0, DUR_MAX * 8, 0),
        trimEnd: num(k.trimEnd, 0, DUR_MAX * 8, 0),
        caption: k.caption ? str(k.caption).slice(0, 120) : undefined,
      }
    })
  // The sequence may only reference clips that are still genuinely accepted —
  // footage resets above must not leave ghost entries (they inflate the Project badge).
  const acceptedIds = new Set(clips.filter((k) => k.status === 'accepted').map((k) => k.id))
  return {
    ...base,
    id: str(r.id, base.id),
    name: str(r.name).slice(0, 80),
    aspect: r.aspect === '9:16' || r.aspect === '1:1' ? r.aspect : '16:9',
    accent: /^#[0-9a-fA-F]{6}$/.test(str(r.accent)) ? (r.accent as string) : base.accent,
    clips,
    order: Array.isArray(r.order) ? r.order.filter((id): id is string => typeof id === 'string' && acceptedIds.has(id)) : [],
    transition: r.transition === 'cut' || r.transition === 'zoom' ? r.transition : 'fade',
    music: r.music && typeof r.music === 'object' && typeof (r.music as { assetId?: unknown }).assetId === 'string'
      ? { assetId: (r.music as { assetId: string }).assetId, name: str((r.music as { name?: unknown }).name), volume: num((r.music as { volume?: unknown }).volume, 0, 1, 0.8), fadeOut: num((r.music as { fadeOut?: unknown }).fadeOut, 0, 5, 1.5) }
      : undefined,
    subtitles: r.subtitles !== false,
  }
}

export function loadCommercial(): Commercial {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = sanitize(JSON.parse(raw))
      if (parsed) return parsed
    }
  } catch {
    /* corrupted → fresh */
  }
  return newCommercial()
}

export function saveCommercial(c: Commercial): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(c))
    return true
  } catch {
    return false // quota — the UI surfaces this honestly
  }
}
