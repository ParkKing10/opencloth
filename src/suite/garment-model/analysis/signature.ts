/**
 * Garment signature — a compact geometric fingerprint of an analyzed garment. It captures the
 * STRUCTURE (how many closed/open shapes, how much is the body, how symmetric, the mix of detected
 * part types) without any hardcoded garment taxonomy. Two similar jackets produce near-identical
 * signatures, which is what lets the engine recognise the second one more confidently (see
 * learningStore + the priors folded into analyzeGarment).
 */
import type { ClassifiedGarment } from './classify'
import type { RegionType } from '../editableGarment'

export type GarmentSignature = {
  /** Fixed-length normalized feature vector (0..1 each). */
  vec: number[]
  /** Detected type histogram (counts) — human-readable provenance. */
  types: Record<string, number>
  name?: string
  at?: number
}

const frac = (n: number, total: number) => (total > 0 ? n / total : 0)

/** Build the normalized feature vector from a classification. Order is stable (never reindex). */
export function computeSignature(cg: ClassifiedGarment, name?: string): GarmentSignature {
  const regions = cg.regions
  const total = Math.max(1, regions.length)
  const count = (t: RegionType) => regions.filter((r) => r.type === t).length
  const closed = cg.graph.paths.filter((p) => p.closed).length
  const open = cg.graph.paths.length - closed
  const body = regions.find((r) => r.type === 'body')
  const bodyAreaRatio = body ? sizeRatio(cg, body.pathIndex) : 0
  // symmetry = fraction of regions the engine paired with a mirror partner
  const mirrored = regions.filter((r) => r.mirrorIndex != null).length
  const meanAspect = mean(cg.graph.paths.map((p) => (p.bounds.h > 0 ? p.bounds.w / p.bounds.h : 1)))

  const vec = [
    Math.min(1, closed / 20),
    Math.min(1, open / 20),
    bodyAreaRatio,
    frac(mirrored, total),
    frac(count('sleeve'), total),
    frac(count('button'), total),
    frac(count('pocket'), total),
    frac(count('collar') + count('hood'), total),
    frac(count('zipper'), total),
    frac(count('waistband') + count('cuff'), total),
    meanAspect / (1 + meanAspect),
  ]
  return { vec, types: cg.report.types, name, at: 0 }
}

function sizeRatio(cg: ClassifiedGarment, pathIndex: number): number {
  const gb = cg.graph.bounds
  const b = cg.graph.paths[pathIndex]?.bounds
  const g = Math.max(1, gb.w * gb.h)
  return b ? (b.w * b.h) / g : 0
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
}

/** Euclidean distance between two signature vectors (0 = identical). */
export function signatureDistance(a: GarmentSignature, b: GarmentSignature): number {
  const n = Math.min(a.vec.length, b.vec.length)
  let s = 0
  for (let i = 0; i < n; i++) {
    const d = a.vec[i] - b.vec[i]
    s += d * d
  }
  return Math.sqrt(s)
}
