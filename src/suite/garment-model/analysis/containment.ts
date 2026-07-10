/**
 * Geometric containment — infer region nesting (a pocket sits on the body, buttons on the placket)
 * purely from geometry: the parent is the smallest strictly-larger closed path that encloses the
 * child's bounding box and contains its centre. No layer names involved.
 */
import type { VectorPath } from './vectorGraph'
import { boundsArea } from './vectorGraph'
import { bboxContains, boundsCenter, pathPoints, pointInPolygon } from './pathGeometry'

/** For each path, the index of its smallest containing (larger, closed) path — or null (top level). */
export function assignParents(paths: VectorPath[]): (number | null)[] {
  const centers = paths.map((p) => boundsCenter(p.bounds))
  const polys = paths.map((p) => (p.closed ? pathPoints(p.d) : []))
  const areas = paths.map((p) => boundsArea(p.bounds))
  return paths.map((p, i) => {
    let best: number | null = null
    let bestArea = Infinity
    for (let j = 0; j < paths.length; j++) {
      if (i === j || !paths[j].closed) continue
      if (areas[j] <= areas[i]) continue // a parent must be strictly larger
      if (!bboxContains(paths[j].bounds, p.bounds, 0.02)) continue
      const inside = polys[j].length >= 3 ? pointInPolygon(centers[i], polys[j]) : true
      if (!inside) continue
      if (areas[j] < bestArea) {
        bestArea = areas[j]
        best = j
      }
    }
    return best
  })
}
