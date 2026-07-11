/**
 * Style engine — turns a motif's role map (primary/accent/detail) into real paint: chrome gradients,
 * neon glow, vintage distress, gothic ink, graffiti fills. Each style contributes a namespaced
 * `<defs>` block (so multiple concept SVGs on one page never collide) plus a per-role paint lookup.
 * Backgrounds stay transparent — these are print-ready graphics, not cards.
 */
import { pick, type Rng } from './rng'
import type { Role } from './motifs'
import type { StyleKey } from './promptParse'

export type RolePaint = { fill: string; edge: string; edgeWidth: number; line: string }
export type Style = {
  key: StyleKey
  label: string
  defs: string
  groupFilter?: string
  paint: (role: Role) => RolePaint
}

const CHROME_STOPS = [
  ['0%', '#eef2f7'],
  ['16%', '#ffffff'],
  ['38%', '#9aa6b6'],
  ['52%', '#5f6a7a'],
  ['64%', '#c9d2dc'],
  ['82%', '#7d8896'],
  ['100%', '#2b323c'],
]
const GOLD_STOPS = [
  ['0%', '#fff4cf'],
  ['22%', '#ffe08a'],
  ['48%', '#c9962f'],
  ['64%', '#8a5f18'],
  ['82%', '#f0cf7a'],
  ['100%', '#5a3d0e'],
]

function linear(id: string, stops: string[][], vertical = true): string {
  const coords = vertical ? 'x1="0" y1="0" x2="0" y2="1"' : 'x1="0" y1="0" x2="1" y2="1"'
  const s = stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')
  return `<linearGradient id="${id}" ${coords}>${s}</linearGradient>`
}

function chrome(ns: string, rng: Rng): Style {
  const gold = rng() < 0.18
  const stops = gold ? GOLD_STOPS : CHROME_STOPS
  const gid = `${ns}-cr`
  const aid = `${ns}-cra`
  return {
    key: 'chrome',
    label: gold ? 'Gold chrome' : 'Chrome',
    defs: linear(gid, stops) + linear(aid, [...stops].reverse()),
    paint: (role) =>
      role === 'primary'
        ? { fill: `url(#${gid})`, edge: '#1a1f27', edgeWidth: 2, line: `url(#${gid})` }
        : role === 'accent'
          ? { fill: `url(#${aid})`, edge: '#1a1f27', edgeWidth: 1.5, line: `url(#${aid})` }
          : { fill: '#12161c', edge: 'none', edgeWidth: 0, line: '#12161c' },
  }
}

function neon(ns: string, rng: Rng): Style {
  const hue = pick(rng, [
    ['#d1f94f', '#eaffb0'],
    ['#4fd6ff', '#c3f2ff'],
    ['#ff5da6', '#ffc3e2'],
    ['#b46bff', '#e6d2ff'],
  ] as const)
  const glow = `${ns}-glow`
  return {
    key: 'neon',
    label: 'Neon',
    defs: `<filter id="${glow}" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`,
    groupFilter: `url(#${glow})`,
    paint: (role) =>
      role === 'primary'
        ? { fill: 'none', edge: hue[0], edgeWidth: 5, line: hue[0] }
        : role === 'accent'
          ? { fill: 'none', edge: hue[1], edgeWidth: 3, line: hue[1] }
          : { fill: hue[0], edge: 'none', edgeWidth: 0, line: hue[0] },
  }
}

function vintage(ns: string, rng: Rng): Style {
  const pal = pick(rng, [
    ['#c9b79a', '#8a7355', '#4a3d2c'],
    ['#b7c2b0', '#7d8a75', '#3f4a3a'],
    ['#c7a99a', '#9a7060', '#4a3230'],
  ] as const)
  const rough = `${ns}-rough`
  const seed = (rng() * 100) | 0
  return {
    key: 'vintage',
    label: 'Vintage wash',
    defs: `<filter id="${rough}"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="${seed}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="3.2" xChannelSelector="R" yChannelSelector="G"/></filter>`,
    groupFilter: `url(#${rough})`,
    paint: (role) =>
      role === 'primary'
        ? { fill: pal[0], edge: pal[2], edgeWidth: 2, line: pal[0] }
        : role === 'accent'
          ? { fill: pal[1], edge: pal[2], edgeWidth: 1.5, line: pal[1] }
          : { fill: pal[2], edge: 'none', edgeWidth: 0, line: pal[2] },
  }
}

function gothic(ns: string, _rng: Rng): Style {
  return {
    key: 'gothic',
    label: 'Gothic',
    defs: linear(`${ns}-go`, [
      ['0%', '#3a3f47'],
      ['50%', '#12151a'],
      ['100%', '#000000'],
    ]),
    paint: (role) =>
      role === 'primary'
        ? { fill: `url(#${ns}-go)`, edge: '#c8ccd2', edgeWidth: 1.5, line: '#c8ccd2' }
        : role === 'accent'
          ? { fill: '#c8ccd2', edge: 'none', edgeWidth: 0, line: '#c8ccd2' }
          : { fill: '#8a9099', edge: 'none', edgeWidth: 0, line: '#8a9099' },
  }
}

function graffiti(_ns: string, rng: Rng): Style {
  const pal = pick(rng, [
    ['#ff4d3d', '#111318', '#ffd23d'],
    ['#4f9cff', '#111318', '#d1f94f'],
    ['#b46bff', '#111318', '#4fd6ff'],
  ] as const)
  return {
    key: 'graffiti',
    label: 'Graffiti',
    defs: '',
    paint: (role) =>
      role === 'primary'
        ? { fill: pal[0], edge: pal[1], edgeWidth: 6, line: pal[0] }
        : role === 'accent'
          ? { fill: pal[2], edge: pal[1], edgeWidth: 4, line: pal[2] }
          : { fill: pal[1], edge: 'none', edgeWidth: 0, line: pal[1] },
  }
}

function flat(_ns: string, rng: Rng): Style {
  const pal = pick(rng, [
    ['#1a1a20', '#5a5f6b', '#d1f94f'],
    ['#111318', '#3a3f4a', '#ffffff'],
    ['#2a2320', '#6a5a4a', '#e8c98a'],
  ] as const)
  return {
    key: 'flat',
    label: 'Solid',
    defs: '',
    paint: (role) =>
      role === 'primary'
        ? { fill: pal[0], edge: 'none', edgeWidth: 0, line: pal[0] }
        : role === 'accent'
          ? { fill: pal[1], edge: 'none', edgeWidth: 0, line: pal[1] }
          : { fill: pal[2], edge: 'none', edgeWidth: 0, line: pal[2] },
  }
}

const BUILDERS: Record<StyleKey, (ns: string, rng: Rng) => Style> = {
  chrome,
  metallic: chrome,
  neon,
  vintage,
  gothic,
  graffiti,
  flat,
}

/** Resolve the dominant style (first keyword wins; chrome is the premium default). */
export function buildStyle(keys: StyleKey[], rng: Rng, ns: string): Style {
  const key = keys[0] ?? 'chrome'
  return (BUILDERS[key] ?? chrome)(ns, rng)
}
