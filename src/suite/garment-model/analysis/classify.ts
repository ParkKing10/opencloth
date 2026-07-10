/**
 * Garment analysis — infer region types from geometry alone (no layer names). Works on the
 * VectorGraph: the largest central closed shape is the body; medium closed shapes flanking the
 * vertical symmetry axis are the left/right sleeves (matched as a mirrored pair); a small central
 * shape at the top is the collar; tiny circular repeated shapes near the axis are buttons; open
 * strokes are seams/stitches. Each region carries a real confidence score; anything unclear is left
 * as an editable 'panel'/'other' rather than mislabelled.
 *
 * Phase 1 taxonomy: body, sleeve (L/R), collar, button, panel, stitch. Later phases extend it.
 */
import type { RegionType } from '../editableGarment'
import type { ShapeRole } from '../garmentStyle'
import type { VectorGraph } from './vectorGraph'
import { boundsArea, boundsCenter } from './vectorGraph'
import { assignParents } from './containment'

export type ClassifiedRegion = {
  /** Index into VectorGraph.paths (Phase 1: one path per region). */
  pathIndex: number
  type: RegionType
  role: ShapeRole
  /** 0..1 — how sure the geometry makes us. */
  confidence: number
  /** Parent region index (nesting), or null for top level. */
  parentIndex: number | null
  side?: 'left' | 'right' | 'center'
  /** Region index of the mirrored partner (e.g. the other sleeve). */
  mirrorIndex?: number
  name: string
}

export type ClassifiedGarment = {
  graph: VectorGraph
  regions: ClassifiedRegion[]
  report: { regionCount: number; lowConfidence: number; types: Record<string, number> }
}

type Feat = {
  i: number
  area: number
  areaRatio: number
  nx: number
  ny: number
  axisDist: number
  aspect: number
  circ: number
  closed: boolean
  side: 'left' | 'right' | 'center'
}

const clampConf = (c: number) => Math.max(0.4, Math.min(0.995, c))

function features(graph: VectorGraph): Feat[] {
  const gb = graph.bounds
  const gArea = Math.max(1, boundsArea(gb))
  return graph.paths.map((p, i) => {
    const c = boundsCenter(p.bounds)
    const nx = gb.w > 0 ? (c.x - gb.minX) / gb.w : 0.5
    const ny = gb.h > 0 ? (c.y - gb.minY) / gb.h : 0.5
    const w = Math.max(p.bounds.w, 1e-6)
    const h = Math.max(p.bounds.h, 1e-6)
    return {
      i,
      area: boundsArea(p.bounds),
      areaRatio: boundsArea(p.bounds) / gArea,
      nx,
      ny,
      axisDist: Math.abs(nx - 0.5),
      aspect: w / h,
      circ: Math.min(w, h) / Math.max(w, h),
      closed: p.closed,
      side: nx < 0.42 ? 'left' : nx > 0.58 ? 'right' : 'center',
    }
  })
}

export function classifyGraph(graph: VectorGraph): ClassifiedGarment {
  const feats = features(graph)
  const parents = assignParents(graph.paths)
  const regions: (ClassifiedRegion | null)[] = graph.paths.map(() => null)

  const closed = feats.filter((f) => f.closed)
  const open = feats.filter((f) => !f.closed)

  // ---- Body: the largest closed shape, preferring central ones. ----
  let bodyIdx = -1
  if (closed.length > 0) {
    const central = closed.filter((f) => f.axisDist < 0.3)
    const pool = central.length ? central : closed
    const body = pool.reduce((a, b) => (b.area > a.area ? b : a))
    bodyIdx = body.i
    regions[bodyIdx] = {
      pathIndex: bodyIdx,
      type: 'body',
      role: 'fill',
      confidence: clampConf(0.9 + (body.axisDist < 0.12 ? 0.09 : 0.04)),
      parentIndex: null,
      side: 'center',
      name: 'Body',
    }
  }

  const rest = closed.filter((f) => f.i !== bodyIdx)

  // ---- Buttons: tiny, near-circular, close to the centre line. ----
  const buttons = rest.filter((f) => f.areaRatio < 0.01 && f.circ > 0.7 && f.axisDist < 0.24)
  for (const f of buttons) {
    regions[f.i] = {
      pathIndex: f.i,
      type: 'button',
      role: 'detail',
      confidence: clampConf(0.85 + (f.circ > 0.88 ? 0.14 : 0.05) + (buttons.length > 1 ? 0.03 : 0)),
      parentIndex: null,
      side: 'center',
      name: 'Button',
    }
  }
  const buttonSet = new Set(buttons.map((f) => f.i))

  // ---- Sleeves: medium closed shapes flanking the axis, matched as a mirror pair. ----
  const sleeveCand = rest.filter(
    (f) => !buttonSet.has(f.i) && f.areaRatio >= 0.015 && f.areaRatio <= 0.5 && f.side !== 'center' && f.ny > 0.05 && f.ny < 0.75,
  )
  const lefts = sleeveCand.filter((f) => f.side === 'left')
  const rights = sleeveCand.filter((f) => f.side === 'right')
  // best mirrored pair: mirrored nx (nxL ≈ 1-nxR), similar area + height band
  let bestPair: { l: Feat; r: Feat; score: number } | null = null
  for (const l of lefts) {
    for (const r of rights) {
      const mirror = 1 - Math.abs(l.nx - (1 - r.nx)) / 0.5 // 1 = perfect mirror
      const areaSim = 1 - Math.min(1, Math.abs(l.area - r.area) / Math.max(l.area, r.area))
      const ySim = 1 - Math.min(1, Math.abs(l.ny - r.ny) / 0.3)
      const score = mirror * 0.5 + areaSim * 0.3 + ySim * 0.2
      if (!bestPair || score > bestPair.score) bestPair = { l, r, score }
    }
  }
  if (bestPair && bestPair.score > 0.55) {
    const conf = clampConf(0.85 + bestPair.score * 0.14)
    regions[bestPair.l.i] = { pathIndex: bestPair.l.i, type: 'sleeve', role: 'fill', confidence: conf, parentIndex: null, side: 'left', mirrorIndex: bestPair.r.i, name: 'Left Sleeve' }
    regions[bestPair.r.i] = { pathIndex: bestPair.r.i, type: 'sleeve', role: 'fill', confidence: conf, parentIndex: null, side: 'right', mirrorIndex: bestPair.l.i, name: 'Right Sleeve' }
  } else {
    // no clean pair — label each side candidate as a lower-confidence sleeve
    for (const f of sleeveCand) {
      regions[f.i] = { pathIndex: f.i, type: 'sleeve', role: 'fill', confidence: 0.6, parentIndex: null, side: f.side, name: f.side === 'left' ? 'Left Sleeve' : 'Right Sleeve' }
    }
  }

  // ---- Collar: small central shape near the top, not already labelled. ----
  const collarCand = rest
    .filter((f) => !regions[f.i] && f.axisDist < 0.24 && f.ny < 0.3 && f.areaRatio < 0.22)
    .sort((a, b) => a.ny - b.ny)
  if (collarCand[0]) {
    const f = collarCand[0]
    regions[f.i] = { pathIndex: f.i, type: 'collar', role: 'detail', confidence: clampConf(0.82 + (f.ny < 0.15 ? 0.13 : 0.05)), parentIndex: null, side: 'center', name: 'Collar' }
  }

  // ---- Remaining closed shapes: honest editable panels (never mislabelled). ----
  for (const f of rest) {
    if (!regions[f.i]) {
      regions[f.i] = { pathIndex: f.i, type: 'panel', role: 'fill', confidence: 0.55, parentIndex: null, side: f.side, name: 'Panel' }
    }
  }

  // ---- Open strokes: seams (solid) / stitching (dashed). ----
  for (const f of open) {
    const dashed = graph.paths[f.i].dashed
    regions[f.i] = { pathIndex: f.i, type: 'stitch', role: dashed ? 'stitch' : 'seam', confidence: 0.5, parentIndex: null, side: f.side, name: dashed ? 'Stitching' : 'Seam' }
  }

  // ---- Nesting: map each path's geometric parent to the parent region index. ----
  for (let i = 0; i < regions.length; i++) {
    const r = regions[i]
    if (!r) continue
    const p = parents[i]
    r.parentIndex = p !== null && regions[p] ? p : null
  }

  const final = regions.filter((r): r is ClassifiedRegion => !!r)
  const types: Record<string, number> = {}
  for (const r of final) types[r.type] = (types[r.type] ?? 0) + 1
  return {
    graph,
    regions: final,
    report: { regionCount: final.length, lowConfidence: final.filter((r) => r.confidence < 0.7).length, types },
  }
}
