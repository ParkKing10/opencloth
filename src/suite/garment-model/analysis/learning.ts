/**
 * Fold learned priors into a fresh classification. When the new garment closely matches a garment
 * the engine has analyzed before, we raise confidence toward certainty in proportion to the
 * similarity — an honest "we've seen this shape before", never inventing or relabelling a region.
 * With an empty store there are no neighbours and nothing changes (pure geometry).
 */
import type { ClassifiedGarment } from './classify'
import type { Neighbour } from './learningStore'

const MAX_DIST = 0.28
const BOOST = 0.5

export type LearningResult = { garment: ClassifiedGarment; matched: boolean; similarity: number; from?: string }

export function applyLearningPriors(cg: ClassifiedGarment, neighbours: Neighbour[]): LearningResult {
  const nearest = neighbours[0]
  if (!nearest || nearest.distance > MAX_DIST) return { garment: cg, matched: false, similarity: 0 }
  const similarity = 1 - nearest.distance / MAX_DIST
  const regions = cg.regions.map((r) => ({
    ...r,
    confidence: Math.min(0.995, r.confidence + (1 - r.confidence) * similarity * BOOST),
  }))
  return { garment: { ...cg, regions }, matched: true, similarity, from: nearest.sig.name }
}
