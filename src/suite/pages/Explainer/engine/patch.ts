/* ============================================================
   Motion engine — the AI patch system.
   The AI never rewrites a whole project. It returns a list of small
   OPERATIONS that surgically change one thing each (an element prop,
   a scene, the brand, the aspect, the music, a beat alignment). Every
   op is validated + clamped through the sanitizer, so a bad op is
   skipped — it can never corrupt the project or crash the renderer.

   This is what makes the video "fully editable via AI": one command
   box can change anything, and everything else stays exactly as it was.
   ============================================================ */

import type { AudioBeats } from './audio'
import { nearestBeat } from './audio'
import { sanitizeElement, sanitizeScene } from './sanitize'
import { sceneStarts } from './render'
import type { BgKey, MotionAspect, Project, Scene, SceneElement } from '../types'

const ASPECTS: readonly MotionAspect[] = ['16:9', '9:16', '1:1']
const BGS: readonly BgKey[] = ['midnight', 'aurora', 'sunset', 'mono']

/** Every operation the AI (or a local command) may emit. One surgical change each. */
export type PatchOp =
  // ---- element edits (custom scenes) ----
  | { op: 'setElement'; sceneId: string; elementId: string; props: Record<string, unknown> }
  | { op: 'addElement'; sceneId: string; element: Record<string, unknown> }
  | { op: 'removeElement'; sceneId: string; elementId: string }
  | { op: 'reorderElement'; sceneId: string; elementId: string; toIndex: number }
  // ---- scene edits (template + custom) ----
  | { op: 'setScene'; sceneId: string; duration?: number; props?: Record<string, unknown> }
  | { op: 'replaceScene'; sceneId: string; scene: Record<string, unknown> }
  | { op: 'addScene'; scene: Record<string, unknown>; atIndex?: number }
  | { op: 'removeScene'; sceneId: string }
  | { op: 'reorderScene'; sceneId: string; toIndex: number }
  // ---- project edits ----
  | { op: 'setAspect'; aspect: MotionAspect }
  | { op: 'setBrand'; product?: string; accent?: string; bg?: BgKey }
  | { op: 'setAudio'; volume?: number; fadeIn?: number; fadeOut?: number; offset?: number }
  // ---- beat sync ----
  | { op: 'alignToBeat'; sceneId: string; strongOnly?: boolean }

export type Patch = { ops: PatchOp[]; summary?: string }

export type PatchResult = { project: Project; applied: number; skipped: number; notes: string[] }

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
const clampHex = (h: unknown, fallback: string): string =>
  isStr(h) && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(h) ? h : fallback

/* ---------------- op validation ---------------- */

const ELEMENT_PROP_KEYS = new Set([
  'x', 'y', 'text', 'size', 'color', 'kinetic', 'maxWidth', 'assetId', 'w', 'h', 'frame', 'radius',
  'shadow', 'shape', 'opacity', 'label', 'clickAt', 'chart', 'demo', 'path', 'enter', 'exit', 'pulseAt',
])

/** Validate one raw op from the model into a typed PatchOp (or null to skip). */
export function sanitizeOp(v: unknown): PatchOp | null {
  if (!isObj(v) || !isStr(v.op)) return null
  switch (v.op) {
    case 'setElement': {
      if (!isStr(v.sceneId) || !isStr(v.elementId) || !isObj(v.props)) return null
      const props: Record<string, unknown> = {}
      for (const [k, val] of Object.entries(v.props)) if (ELEMENT_PROP_KEYS.has(k)) props[k] = val
      if (Object.keys(props).length === 0) return null
      return { op: 'setElement', sceneId: v.sceneId, elementId: v.elementId, props }
    }
    case 'addElement':
      if (!isStr(v.sceneId) || !isObj(v.element)) return null
      return { op: 'addElement', sceneId: v.sceneId, element: v.element }
    case 'removeElement':
      if (!isStr(v.sceneId) || !isStr(v.elementId)) return null
      return { op: 'removeElement', sceneId: v.sceneId, elementId: v.elementId }
    case 'reorderElement':
      if (!isStr(v.sceneId) || !isStr(v.elementId) || typeof v.toIndex !== 'number') return null
      return { op: 'reorderElement', sceneId: v.sceneId, elementId: v.elementId, toIndex: Math.round(v.toIndex) }
    case 'setScene': {
      if (!isStr(v.sceneId)) return null
      const out: Extract<PatchOp, { op: 'setScene' }> = { op: 'setScene', sceneId: v.sceneId }
      if (typeof v.duration === 'number') out.duration = v.duration
      if (isObj(v.props)) out.props = v.props
      if (out.duration === undefined && !out.props) return null
      return out
    }
    case 'replaceScene':
      if (!isStr(v.sceneId) || !isObj(v.scene)) return null
      return { op: 'replaceScene', sceneId: v.sceneId, scene: v.scene }
    case 'addScene':
      if (!isObj(v.scene)) return null
      return { op: 'addScene', scene: v.scene, atIndex: typeof v.atIndex === 'number' ? Math.round(v.atIndex) : undefined }
    case 'removeScene':
      if (!isStr(v.sceneId)) return null
      return { op: 'removeScene', sceneId: v.sceneId }
    case 'reorderScene':
      if (!isStr(v.sceneId) || typeof v.toIndex !== 'number') return null
      return { op: 'reorderScene', sceneId: v.sceneId, toIndex: Math.round(v.toIndex) }
    case 'setAspect':
      if (!ASPECTS.includes(v.aspect as MotionAspect)) return null
      return { op: 'setAspect', aspect: v.aspect as MotionAspect }
    case 'setBrand': {
      const out: Extract<PatchOp, { op: 'setBrand' }> = { op: 'setBrand' }
      if (isStr(v.product)) out.product = v.product.slice(0, 40)
      if (isStr(v.accent)) out.accent = v.accent
      if (BGS.includes(v.bg as BgKey)) out.bg = v.bg as BgKey
      if (out.product === undefined && out.accent === undefined && out.bg === undefined) return null
      return out
    }
    case 'setAudio': {
      const out: Extract<PatchOp, { op: 'setAudio' }> = { op: 'setAudio' }
      for (const k of ['volume', 'fadeIn', 'fadeOut', 'offset'] as const) if (typeof v[k] === 'number') out[k] = v[k] as number
      if (out.volume === undefined && out.fadeIn === undefined && out.fadeOut === undefined && out.offset === undefined) return null
      return out
    }
    case 'alignToBeat':
      if (!isStr(v.sceneId)) return null
      return { op: 'alignToBeat', sceneId: v.sceneId, strongOnly: v.strongOnly === true }
    default:
      return null
  }
}

export function sanitizePatch(v: unknown): Patch {
  const o = isObj(v) ? v : {}
  const rawOps = Array.isArray(o.ops) ? o.ops : Array.isArray(o.operations) ? o.operations : []
  const ops = rawOps.map(sanitizeOp).filter((x): x is PatchOp => x !== null).slice(0, 40)
  return { ops, summary: isStr(o.summary) ? o.summary.slice(0, 200) : undefined }
}

/* ---------------- executor ---------------- */

const findScene = (p: Project, id: string): Scene | undefined => p.scenes.find((s) => s.id === id)

function mapScene(p: Project, id: string, fn: (s: Scene) => Scene | null): { p: Project; ok: boolean } {
  let ok = false
  const scenes: Scene[] = []
  for (const s of p.scenes) {
    if (s.id === id) {
      const next = fn(s)
      ok = true
      if (next) scenes.push(next)
    } else {
      scenes.push(s)
    }
  }
  return { p: { ...p, scenes }, ok }
}

function customElements(scene: Scene): SceneElement[] | null {
  return scene.type === 'custom' ? scene.props.elements : null
}

/** Snap a scene's clicks (button + cursor) to the nearest beat. Pure — used by the alignToBeat op. */
function alignScene(scene: Scene, start: number, offset: number, beats: AudioBeats, strongOnly: boolean): Scene {
  if (scene.type !== 'custom') return scene
  const d = scene.duration
  const snap = (at: number): number => {
    const bt = nearestBeat(beats, offset + start + at * d, strongOnly)
    return bt == null ? at : Math.max(0, Math.min(1, (bt - offset - start) / d))
  }
  const elements = scene.props.elements.map((el) => {
    if (el.kind === 'button' && typeof el.clickAt === 'number') return { ...el, clickAt: snap(el.clickAt) }
    if (el.kind === 'cursor') return { ...el, path: el.path.map((pt) => (pt.click ? { ...pt, at: snap(pt.at) } : pt)) }
    return el
  })
  return { ...scene, props: { ...scene.props, elements } }
}

/**
 * Apply a patch immutably. Each op is best-effort: a bad target is skipped and noted, never thrown.
 * `beats` is needed only for alignToBeat ops.
 */
export function applyPatch(project: Project, patch: Patch, beats?: AudioBeats | null): PatchResult {
  let p = project
  let applied = 0
  let skipped = 0
  const notes: string[] = []
  const ok = () => applied++
  const skip = (why: string) => {
    skipped++
    notes.push(why)
  }

  for (const op of patch.ops) {
    switch (op.op) {
      case 'setElement': {
        const sc = findScene(p, op.sceneId)
        if (!sc || sc.type !== 'custom') {
          skip(`setElement: scene ${op.sceneId} is not editable`)
          break
        }
        const el = sc.props.elements.find((e) => e.id === op.elementId)
        if (!el) {
          skip(`setElement: element ${op.elementId} not found`)
          break
        }
        const merged = sanitizeElement({ ...el, ...op.props, id: el.id, kind: el.kind })
        if (!merged) {
          skip('setElement: result invalid')
          break
        }
        const res = mapScene(p, op.sceneId, (s) =>
          s.type === 'custom' ? { ...s, props: { ...s.props, elements: s.props.elements.map((e) => (e.id === el.id ? merged : e)) } } : s,
        )
        p = res.p
        ok()
        break
      }
      case 'addElement': {
        const merged = sanitizeElement(op.element)
        if (!merged) {
          skip('addElement: invalid element')
          break
        }
        const res = mapScene(p, op.sceneId, (s) =>
          s.type === 'custom' ? { ...s, props: { ...s.props, elements: [...s.props.elements, merged].slice(0, 12) } } : s,
        )
        if (!res.ok || findScene(p, op.sceneId)?.type !== 'custom') skip('addElement: scene not editable')
        else {
          p = res.p
          ok()
        }
        break
      }
      case 'removeElement': {
        const res = mapScene(p, op.sceneId, (s) =>
          s.type === 'custom' ? { ...s, props: { ...s.props, elements: s.props.elements.filter((e) => e.id !== op.elementId) } } : s,
        )
        p = res.p
        res.ok ? ok() : skip('removeElement: scene not found')
        break
      }
      case 'reorderElement': {
        const res = mapScene(p, op.sceneId, (s) => {
          if (s.type !== 'custom') return s
          const els = customElements(s)!
          const from = els.findIndex((e) => e.id === op.elementId)
          if (from < 0) return s
          const arr = [...els]
          const [moved] = arr.splice(from, 1)
          arr.splice(Math.max(0, Math.min(arr.length, op.toIndex)), 0, moved)
          return { ...s, props: { ...s.props, elements: arr } }
        })
        p = res.p
        res.ok ? ok() : skip('reorderElement: scene not found')
        break
      }
      case 'setScene': {
        const sc = findScene(p, op.sceneId)
        if (!sc) {
          skip(`setScene: ${op.sceneId} not found`)
          break
        }
        const nextRaw = {
          ...sc,
          duration: op.duration ?? sc.duration,
          props: op.props ? { ...(sc.props as Record<string, unknown>), ...op.props } : sc.props,
        }
        const next = sanitizeScene({ ...nextRaw, id: sc.id, type: sc.type })
        if (!next) {
          skip('setScene: result invalid')
          break
        }
        p = mapScene(p, op.sceneId, () => next).p
        ok()
        break
      }
      case 'replaceScene': {
        const sc = findScene(p, op.sceneId)
        if (!sc) {
          skip('replaceScene: not found')
          break
        }
        const next = sanitizeScene({ duration: sc.duration, ...op.scene, id: sc.id })
        if (!next) {
          skip('replaceScene: invalid')
          break
        }
        p = mapScene(p, op.sceneId, () => next).p
        ok()
        break
      }
      case 'addScene': {
        const next = sanitizeScene(op.scene)
        if (!next) {
          skip('addScene: invalid')
          break
        }
        if (p.scenes.length >= 12) {
          skip('addScene: scene limit reached')
          break
        }
        const scenes = [...p.scenes]
        const at = op.atIndex == null ? scenes.length : Math.max(0, Math.min(scenes.length, op.atIndex))
        scenes.splice(at, 0, next)
        p = { ...p, scenes }
        ok()
        break
      }
      case 'removeScene': {
        if (!findScene(p, op.sceneId)) {
          skip('removeScene: not found')
          break
        }
        p = { ...p, scenes: p.scenes.filter((s) => s.id !== op.sceneId) }
        ok()
        break
      }
      case 'reorderScene': {
        const from = p.scenes.findIndex((s) => s.id === op.sceneId)
        if (from < 0) {
          skip('reorderScene: not found')
          break
        }
        const scenes = [...p.scenes]
        const [moved] = scenes.splice(from, 1)
        scenes.splice(Math.max(0, Math.min(scenes.length, op.toIndex)), 0, moved)
        p = { ...p, scenes }
        ok()
        break
      }
      case 'setAspect':
        p = { ...p, aspect: op.aspect }
        ok()
        break
      case 'setBrand':
        p = {
          ...p,
          brand: {
            product: op.product ?? p.brand.product,
            accent: op.accent ? clampHex(op.accent, p.brand.accent) : p.brand.accent,
            bg: op.bg ?? p.brand.bg,
          },
        }
        ok()
        break
      case 'setAudio': {
        if (!p.audio) {
          skip('setAudio: no music loaded')
          break
        }
        const a = p.audio
        p = {
          ...p,
          audio: {
            ...a,
            volume: op.volume != null ? Math.min(1, Math.max(0, op.volume)) : a.volume,
            fadeIn: op.fadeIn != null ? Math.min(8, Math.max(0, op.fadeIn)) : a.fadeIn,
            fadeOut: op.fadeOut != null ? Math.min(8, Math.max(0, op.fadeOut)) : a.fadeOut,
            offset: op.offset != null ? Math.max(0, op.offset) : a.offset,
          },
        }
        ok()
        break
      }
      case 'alignToBeat': {
        if (!beats) {
          skip('alignToBeat: no beats detected')
          break
        }
        const idx = p.scenes.findIndex((s) => s.id === op.sceneId)
        if (idx < 0) {
          skip('alignToBeat: scene not found')
          break
        }
        const start = sceneStarts(p)[idx]
        const offset = p.audio?.offset ?? 0
        p = mapScene(p, op.sceneId, (s) => alignScene(s, start, offset, beats, op.strongOnly ?? false)).p
        ok()
        break
      }
      default:
        skip('unknown op')
    }
  }

  return { project: p, applied, skipped, notes }
}
