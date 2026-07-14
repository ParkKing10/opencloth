/* ============================================================
   Motion engine — sanitizer.
   EVERY scene that enters the engine from an untrusted source
   (AI output, localStorage) passes through here. Numbers are
   clamped, enums whitelisted, counts capped — so a malformed or
   adversarial payload can never crash the renderer.
   ============================================================ */

import {
  uid,
  type Anim,
  type AnimEffect,
  type BgKey,
  type CameraKey,
  type CustomProps,
  type DemoKind,
  type MotionAspect,
  type Project,
  type ProjectAudio,
  type Scene,
  type SceneElement,
  type StatItem,
} from '../types'

const MAX_ELEMENTS = 12
const MAX_SCENES = 12

const num = (v: unknown, fallback: number, min: number, max: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback

const str = (v: unknown, fallback: string, maxLen = 160): string =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, maxLen) : fallback

const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback)

const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback

const obj = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null

const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

const EFFECTS: readonly AnimEffect[] = ['fade', 'rise', 'drop', 'slide-left', 'slide-right', 'pop', 'wipe']

function anim(v: unknown): Anim | undefined {
  const o = obj(v)
  if (!o) return undefined
  return { effect: oneOf(o.effect, EFFECTS, 'fade'), at: num(o.at, 0, 0, 0.95), dur: num(o.dur, 0.2, 0.02, 1) }
}

function pulses(v: unknown): number[] | undefined {
  const list = arr(v)
    .filter((p): p is number => typeof p === 'number' && Number.isFinite(p))
    .map((p) => Math.min(1, Math.max(0, p)))
    .slice(0, 4)
  return list.length ? list : undefined
}

export function sanitizeElement(v: unknown): SceneElement | null {
  const o = obj(v)
  if (!o) return null
  const base = {
    id: str(o.id, uid(), 40),
    x: num(o.x, 0.5, 0, 1),
    y: num(o.y, 0.5, 0, 1),
    enter: anim(o.enter),
    exit: anim(o.exit),
    pulseAt: pulses(o.pulseAt),
  }
  switch (o.kind) {
    case 'text':
      return {
        ...base,
        kind: 'text',
        text: str(o.text, 'Text', 240),
        size: oneOf(o.size, ['sm', 'md', 'lg', 'xl'] as const, 'md'),
        color: oneOf(o.color, ['white', 'muted', 'accent'] as const, 'white'),
        kinetic: bool(o.kinetic, false),
        maxWidth: typeof o.maxWidth === 'number' ? num(o.maxWidth, 0.8, 0.2, 1) : undefined,
      }
    case 'image': {
      const assetId = str(o.assetId, '', 64)
      if (!assetId) return null
      return {
        ...base,
        kind: 'image',
        assetId,
        w: num(o.w, 0.5, 0.08, 1),
        frame: oneOf(o.frame, ['none', 'browser'] as const, 'none'),
        radius: num(o.radius, 14, 0, 60),
        shadow: bool(o.shadow, true),
      }
    }
    case 'shape':
      return {
        ...base,
        kind: 'shape',
        shape: oneOf(o.shape, ['rect', 'circle', 'line'] as const, 'rect'),
        w: num(o.w, 0.2, 0.005, 1),
        h: num(o.h, 0.1, 0.002, 1),
        color: oneOf(o.color, ['accent', 'white', 'muted', 'panel'] as const, 'accent'),
        radius: num(o.radius, 8, 0, 60),
        opacity: num(o.opacity, 1, 0.05, 1),
      }
    case 'button':
      return {
        ...base,
        kind: 'button',
        label: str(o.label, 'Get started', 40),
        clickAt: typeof o.clickAt === 'number' ? num(o.clickAt, 0.6, 0, 1) : undefined,
      }
    case 'chip':
      return { ...base, kind: 'chip', label: str(o.label, 'New', 48) }
    case 'chart':
      return {
        ...base,
        kind: 'chart',
        chart: oneOf(o.chart, ['line', 'bars'] as const, 'line'),
        w: num(o.w, 0.42, 0.1, 1),
        h: num(o.h, 0.3, 0.05, 1),
      }
    case 'mockup':
      return {
        ...base,
        kind: 'mockup',
        w: num(o.w, 0.7, 0.2, 1),
        demo: oneOf(o.demo, ['dashboard', 'analytics'] as const, 'dashboard'),
      }
    case 'cursor': {
      const path = arr(o.path)
        .map((p) => {
          const po = obj(p)
          if (!po) return null
          return {
            at: num(po.at, 0, 0, 1),
            x: num(po.x, 0.5, 0, 1),
            y: num(po.y, 0.5, 0, 1),
            click: bool(po.click, false),
          }
        })
        .filter((p): p is NonNullable<typeof p> => p !== null)
        .sort((a, b) => a.at - b.at)
        .slice(0, 8)
      if (path.length < 2) return null
      return { ...base, kind: 'cursor', path }
    }
    default:
      return null
  }
}

export function sanitizeCustomProps(v: unknown): CustomProps {
  const o = obj(v) ?? {}
  const elements = arr(o.elements)
    .map(sanitizeElement)
    .filter((e): e is SceneElement => e !== null)
    .slice(0, MAX_ELEMENTS)
  const camera = arr(o.camera)
    .map((k) => {
      const ko = obj(k)
      if (!ko) return null
      return {
        at: num(ko.at, 0, 0, 1),
        scale: num(ko.scale, 1, 0.5, 3),
        x: num(ko.x, 0.5, 0, 1),
        y: num(ko.y, 0.5, 0, 1),
      } as CameraKey
    })
    .filter((k): k is CameraKey => k !== null)
    .sort((a, b) => a.at - b.at)
    .slice(0, 6)
  return {
    label: str(o.label, 'AI scene', 40),
    elements,
    camera: camera.length ? camera : undefined,
    orbs: bool(o.orbs, true),
  }
}

function stats(v: unknown): StatItem[] {
  const list = arr(v)
    .map((s) => {
      const o = obj(s)
      if (!o) return null
      return {
        value: num(o.value, 0, -1e9, 1e9),
        suffix: str(o.suffix, '', 8),
        label: str(o.label, 'Metric', 40),
      }
    })
    .filter((s): s is StatItem => s !== null)
    .slice(0, 4)
  return list.length ? list : [{ value: 100, suffix: '%', label: 'Metric' }]
}

/** Untrusted scene → valid Scene, or null when the type is unknown. */
export function sanitizeScene(v: unknown): Scene | null {
  const o = obj(v)
  if (!o) return null
  const id = str(o.id, uid(), 40)
  const duration = num(o.duration, 4, 1.5, 15)
  const p = obj(o.props) ?? {}
  switch (o.type) {
    case 'intro':
      return { id, type: 'intro', duration, props: { title: str(p.title, 'Hello', 90), tagline: str(p.tagline, '', 120) } }
    case 'statement':
      return {
        id,
        type: 'statement',
        duration,
        props: { text: str(p.text, 'Your message', 200), highlight: str(p.highlight, '', 40) },
      }
    case 'feature':
      return {
        id,
        type: 'feature',
        duration,
        props: {
          heading: str(p.heading, 'Feature', 90),
          caption: str(p.caption, '', 120),
          demo: oneOf(p.demo, ['dashboard', 'analytics'] as const, 'dashboard') as DemoKind,
          calloutA: str(p.calloutA, 'Callout', 48),
          calloutB: str(p.calloutB, 'Callout', 48),
        },
      }
    case 'stats':
      return { id, type: 'stats', duration, props: { heading: str(p.heading, 'Results', 90), stats: stats(p.stats) } }
    case 'cta':
      return {
        id,
        type: 'cta',
        duration,
        props: {
          title: str(p.title, 'Get started', 90),
          sub: str(p.sub, '', 120),
          button: str(p.button, 'Try it free', 40),
          url: str(p.url, '', 60),
        },
      }
    case 'custom':
      return { id, type: 'custom', duration, props: sanitizeCustomProps(p) }
    default:
      return null
  }
}

/** Untrusted scene list (e.g. an AI draft) → valid scenes, capped. */
export function sanitizeScenes(v: unknown): Scene[] {
  return arr(v)
    .map(sanitizeScene)
    .filter((s): s is Scene => s !== null)
    .slice(0, MAX_SCENES)
}

const BGS: readonly BgKey[] = ['midnight', 'aurora', 'sunset', 'mono']
const ASPECTS: readonly MotionAspect[] = ['16:9', '9:16', '1:1']

function sanitizeAudio(v: unknown): ProjectAudio | undefined {
  const o = obj(v)
  if (!o) return undefined
  const assetId = str(o.assetId, '', 64)
  if (!assetId) return undefined
  return {
    assetId,
    name: str(o.name, 'Music', 80),
    volume: num(o.volume, 0.8, 0, 1),
    fadeIn: num(o.fadeIn, 0.4, 0, 8),
    fadeOut: num(o.fadeOut, 0.8, 0, 8),
    offset: num(o.offset, 0, 0, 3600),
  }
}

/** Untrusted project (localStorage) → valid Project, or null when unusable. */
export function sanitizeProject(v: unknown): Project | null {
  const o = obj(v)
  if (!o || o.version !== 1) return null
  const b = obj(o.brand) ?? {}
  const accentRaw = str(b.accent, '#d1f94f', 9)
  return {
    version: 1,
    brand: {
      product: str(b.product, 'my product', 40),
      accent: /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(accentRaw) ? accentRaw : '#d1f94f',
      bg: oneOf(b.bg, BGS, 'midnight'),
    },
    aspect: oneOf(o.aspect, ASPECTS, '16:9'),
    scenes: sanitizeScenes(o.scenes),
    audio: sanitizeAudio(o.audio),
  }
}
