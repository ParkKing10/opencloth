/**
 * Parametric motif library — each entry synthesises a streetwear graphic subject as SVG nodes in a
 * 0..200 viewBox centred on (100,100). Shapes are geometric and symmetric so they read well at any
 * size, and every generator takes the seeded RNG so the three concepts differ meaningfully.
 *
 * A node is either a filled/stroked path or a text run; the style engine decides the actual paint
 * per role. Motifs never hardcode colour — they describe form only.
 */
import { pick, r2, range, rangeInt, type Rng } from './rng'

export type Role = 'primary' | 'accent' | 'detail'
export type MotifNode =
  | { kind: 'path'; d: string; role: Role; stroke?: number }
  | { kind: 'text'; text: string; x: number; y: number; size: number; role: Role }
export type MotifResult = MotifNode[]

const C = 100

function pt(cx: number, cy: number, r: number, a: number): [number, number] {
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
}
function poly(points: [number, number][], close = true): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${r2(p[0])} ${r2(p[1])}`).join(' ') + (close ? ' Z' : '')
}
function starPts(cx: number, cy: number, n: number, rOut: number, rIn: number, rot: number): [number, number][] {
  const pts: [number, number][] = []
  for (let i = 0; i < n * 2; i++) pts.push(pt(cx, cy, i % 2 === 0 ? rOut : rIn, rot + (i * Math.PI) / n))
  return pts
}
function rect(x: number, y: number, w: number, h: number): string {
  return `M${r2(x)} ${r2(y)} H${r2(x + w)} V${r2(y + h)} H${r2(x)} Z`
}
function diamond(cx: number, cy: number, r: number): string {
  return poly([[cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy]])
}

// ---- motifs ----

function star(rng: Rng): MotifResult {
  const n = pick(rng, [5, 6, 8])
  const rOut = range(rng, 86, 94)
  const rIn = rOut * range(rng, 0.4, 0.5)
  const rot = -Math.PI / 2
  return [
    { kind: 'path', d: poly(starPts(C, C, n, rOut, rIn, rot)), role: 'primary' },
    { kind: 'path', d: poly(starPts(C, C, n, rOut * 0.42, rIn * 0.42, rot)), role: 'detail' },
  ]
}

function tribalStar(rng: Rng): MotifResult {
  const n = rangeInt(rng, 5, 7)
  const rot = -Math.PI / 2 + range(rng, -0.12, 0.12)
  const rOut = range(rng, 88, 96)
  const rIn = range(rng, 20, 30)
  const off = Math.PI / n
  return [
    { kind: 'path', d: poly(starPts(C, C, n, rOut, rIn, rot)), role: 'primary' },
    { kind: 'path', d: poly(starPts(C, C, n, rOut * 0.52, rIn * 0.7, rot + off)), role: 'accent' },
    { kind: 'path', d: diamond(C, C, range(rng, 12, 16)), role: 'detail' },
  ]
}

function burst(rng: Rng): MotifResult {
  const n = rangeInt(rng, 10, 16)
  const rot = -Math.PI / 2
  return [
    { kind: 'path', d: poly(starPts(C, C, n, range(rng, 90, 96), range(rng, 60, 70), rot)), role: 'primary' },
    { kind: 'path', d: poly(starPts(C, C, 4, 34, 12, rot)), role: 'accent' },
  ]
}

function heart(rng: Rng): MotifResult {
  const lift = range(rng, -4, 6)
  const d = `M100 172 C 36 122, 16 80, ${r2(40)} ${r2(52 + lift)} C 58 30, 88 34, 100 60 C 112 34, 142 30, 160 ${r2(52 + lift)} C 184 80, 164 122, 100 172 Z`
  return [
    { kind: 'path', d, role: 'primary' },
    { kind: 'path', d: 'M70 62 C 64 74, 66 88, 78 100', role: 'detail', stroke: 5 },
  ]
}

function cross(rng: Rng): MotifResult {
  const w = range(rng, 22, 28)
  return [
    { kind: 'path', d: rect(C - w, 22, 2 * w, 156), role: 'primary' },
    { kind: 'path', d: rect(42, 62, 116, 2 * w), role: 'primary' },
  ]
}

function gothicCross(rng: Rng): MotifResult {
  const w = range(rng, 15, 19)
  const tips: MotifNode[] = [
    { kind: 'path', d: diamond(C, 20, 11), role: 'accent' },
    { kind: 'path', d: diamond(C, 180, 11), role: 'accent' },
    { kind: 'path', d: diamond(40, 62 + w, 11), role: 'accent' },
    { kind: 'path', d: diamond(160, 62 + w, 11), role: 'accent' },
  ]
  return [
    { kind: 'path', d: rect(C - w, 24, 2 * w, 152), role: 'primary' },
    { kind: 'path', d: rect(46, 62, 108, 2 * w), role: 'primary' },
    ...tips,
  ]
}

function lightning(rng: Rng): MotifResult {
  const sk = range(rng, -6, 6)
  const d = `M${r2(120 + sk)} 18 L58 106 L96 106 L${r2(74 + sk)} 184 L152 82 L110 82 L${r2(138 + sk)} 18 Z`
  return [{ kind: 'path', d, role: 'primary' }]
}

function flame(rng: Rng): MotifResult {
  const w = range(rng, 0, 8)
  const main = `M100 18 C ${r2(138 + w)} 62, 128 92, 132 118 A 44 44 0 1 1 ${r2(64 - w)} 116 C 66 96, 82 92, 88 74 C 90 96, 104 96, 106 78 C 108 56, 92 44, 100 18 Z`
  const inner = 'M100 78 C 118 96, 112 120, 100 138 C 88 122, 84 100, 100 78 Z'
  return [
    { kind: 'path', d: main, role: 'primary' },
    { kind: 'path', d: inner, role: 'accent' },
  ]
}

function butterfly(rng: Rng): MotifResult {
  const spread = range(rng, 0, 6)
  const upper = `M100 96 C ${r2(60 - spread)} 40, 20 44, 26 78 C 30 104, 66 104, 100 100 Z`
  const lower = `M100 104 C ${r2(64 - spread)} 150, 34 156, 40 128 C 44 110, 74 108, 100 104 Z`
  const upperR = `M100 96 C ${r2(140 + spread)} 40, 180 44, 174 78 C 170 104, 134 104, 100 100 Z`
  const lowerR = `M100 104 C ${r2(136 + spread)} 150, 166 156, 160 128 C 156 110, 126 108, 100 104 Z`
  return [
    { kind: 'path', d: upper, role: 'primary' },
    { kind: 'path', d: upperR, role: 'primary' },
    { kind: 'path', d: lower, role: 'accent' },
    { kind: 'path', d: lowerR, role: 'accent' },
    { kind: 'path', d: rect(97, 58, 6, 92), role: 'detail' },
  ]
}

function skull(rng: Rng): MotifResult {
  const jaw = range(rng, 0, 4)
  const cranium = 'M100 26 C 58 26, 34 54, 34 92 C 34 116, 46 132, 60 140 L60 158 C 60 168, 72 172, 84 172 L116 172 C 128 172, 140 168, 140 158 L140 140 C 154 132, 166 116, 166 92 C 166 54, 142 26, 100 26 Z'
  const eyeL = 'M62 92 C 62 78, 84 78, 84 94 C 84 108, 62 108, 62 92 Z'
  const eyeR = 'M116 92 C 116 78, 138 78, 138 94 C 138 108, 116 108, 116 92 Z'
  const nose = poly([[100, 108], [108, 128], [92, 128]])
  const teeth = rect(78, 150, 44, 8 + jaw)
  return [
    { kind: 'path', d: cranium, role: 'primary' },
    { kind: 'path', d: eyeL, role: 'detail' },
    { kind: 'path', d: eyeR, role: 'detail' },
    { kind: 'path', d: nose, role: 'detail' },
    { kind: 'path', d: teeth, role: 'accent' },
  ]
}

function rose(rng: Rng): MotifResult {
  const nodes: MotifNode[] = []
  const layers = rangeInt(rng, 3, 4)
  for (let l = layers; l >= 1; l--) {
    const r = 20 + l * 20
    const n = 4 + l
    const rot = (l % 2) * (Math.PI / n) + range(rng, -0.1, 0.1)
    const petals: [number, number][] = []
    for (let i = 0; i < n * 2; i++) petals.push(pt(C, C, i % 2 === 0 ? r : r * 0.6, rot + (i * Math.PI) / n))
    nodes.push({ kind: 'path', d: poly(petals), role: l === layers ? 'primary' : l === 1 ? 'detail' : 'accent' })
  }
  return nodes
}

function serpent(rng: Rng): MotifResult {
  const amp = range(rng, 30, 42)
  const body = `M42 168 C ${r2(20 + amp)} 150, ${r2(180 - amp)} 130, 100 118 C ${r2(20 + amp)} 106, ${r2(180 - amp)} 86, 100 74 C ${r2(140)} 66, 150 44, 132 34`
  const head = 'M132 34 C 146 30, 158 40, 152 54 C 148 62, 134 62, 128 52 C 124 44, 126 36, 132 34 Z'
  const eye = { kind: 'path' as const, d: diamond(140, 46, 3), role: 'detail' as const }
  return [
    { kind: 'path', d: body, role: 'primary', stroke: range(rng, 13, 17) },
    { kind: 'path', d: head, role: 'accent' },
    eye,
  ]
}

function wings(rng: Rng): MotifResult {
  const droop = range(rng, 0, 10)
  const left: [number, number][] = [[98, 74]]
  for (let i = 0; i < 4; i++) {
    const x = 84 - i * 20
    left.push([x, 78 + i * 6 + droop])
    left.push([x + 6, 92 + i * 10 + droop])
  }
  left.push([98, 120])
  const right = left.map(([x, y]) => [200 - x, y] as [number, number])
  return [
    { kind: 'path', d: poly(left), role: 'primary' },
    { kind: 'path', d: poly(right), role: 'primary' },
    { kind: 'path', d: diamond(C, 98, 12), role: 'accent' },
  ]
}

function crown(rng: Rng): MotifResult {
  const peaks = rangeInt(rng, 3, 5)
  const baseY = 150
  const topY = 66
  const left = 40
  const w = 120
  const pts: [number, number][] = [[left, baseY]]
  for (let i = 0; i <= peaks; i++) {
    const x = left + (w * i) / peaks
    pts.push([x, topY + (i % 2 === 0 ? 0 : 26)])
    if (i < peaks) pts.push([left + (w * (i + 0.5)) / peaks, 118])
  }
  pts.push([left + w, baseY])
  const tips: MotifNode[] = []
  for (let i = 0; i <= peaks; i += 2) tips.push({ kind: 'path', d: `M${r2(left + (w * i) / peaks)} ${topY} m-6 0 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0`, role: 'accent' })
  return [
    { kind: 'path', d: poly(pts), role: 'primary' },
    { kind: 'path', d: rect(left, baseY - 4, w, 12), role: 'accent' },
    ...tips,
  ]
}

function barbedWire(rng: Rng): MotifResult {
  const y = C
  const amp = range(rng, 14, 22)
  let d = `M14 ${r2(y)}`
  for (let x = 14; x <= 186; x += 24) d += ` Q ${r2(x + 12)} ${r2(y - amp)} ${r2(x + 24)} ${r2(y)}`
  const nodes: MotifNode[] = [{ kind: 'path', d, role: 'primary', stroke: 5 }]
  for (let x = 26; x <= 174; x += 48) {
    nodes.push({ kind: 'path', d: `M${r2(x - 9)} ${r2(y - 9)} L${r2(x + 9)} ${r2(y + 9)} M${r2(x + 9)} ${r2(y - 9)} L${r2(x - 9)} ${r2(y + 9)}`, role: 'accent', stroke: 4 })
  }
  return nodes
}

function monogram(rng: Rng, initials: string): MotifResult {
  return [
    { kind: 'path', d: `M100 100 m-70 0 a70 70 0 1 0 140 0 a70 70 0 1 0 -140 0`, role: 'accent', stroke: range(rng, 5, 8) },
    { kind: 'text', text: initials.slice(0, 2), x: 100, y: 100, size: 78, role: 'primary' },
  ]
}

function emblem(_rng: Rng, initials: string): MotifResult {
  const rot = -Math.PI / 2
  return [
    { kind: 'path', d: poly(starPts(C, C, 12, 92, 78, rot)), role: 'accent' },
    { kind: 'path', d: `M100 100 m-58 0 a58 58 0 1 0 116 0 a58 58 0 1 0 -116 0`, role: 'primary', stroke: 6 },
    { kind: 'text', text: initials.slice(0, 2), x: 100, y: 100, size: 56, role: 'primary' },
  ]
}

export const MOTIFS: Record<string, (rng: Rng, initials: string) => MotifResult> = {
  star,
  tribalStar,
  burst,
  heart,
  cross,
  gothicCross,
  lightning,
  flame,
  butterfly,
  skull,
  rose,
  serpent,
  wings,
  crown,
  barbedWire,
  monogram,
  emblem,
}

export function buildMotif(key: string, rng: Rng, initials: string): MotifResult {
  return (MOTIFS[key] ?? emblem)(rng, initials)
}
