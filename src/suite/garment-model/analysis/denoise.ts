/**
 * Denoise a VectorGraph before analysis. Real Illustrator flats (via pdf.js) carry a lot of noise
 * that becomes junk layers: a full-page background rectangle, the same shape drawn twice (a fill
 * object AND a stroke object), and tiny slivers from text-as-outlines / hatching. This strips those
 * so the classifier — and the layer list the user sees — stays clean. Conservative by design: it
 * only removes things that are clearly redundant, never a real garment part.
 */
import type { Bounds, VectorGraph, VectorPath } from './vectorGraph'
import { boundsArea } from './vectorGraph'

/** Intersection-over-union of two bounding boxes (1 = identical, 0 = disjoint). */
function iou(a: Bounds, b: Bounds): number {
  const x1 = Math.max(a.minX, b.minX)
  const y1 = Math.max(a.minY, b.minY)
  const x2 = Math.min(a.minX + a.w, b.minX + b.w)
  const y2 = Math.min(a.minY + a.h, b.minY + b.h)
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
  const uni = boundsArea(a) + boundsArea(b) - inter
  return uni > 0 ? inter / uni : 0
}

export function denoiseGraph(graph: VectorGraph): VectorGraph {
  const gArea = Math.max(1, boundsArea(graph.bounds))
  let paths = graph.paths

  // 1. Drop a full-artboard background rectangle (page fill / bounding box).
  paths = paths.filter((p) => boundsArea(p.bounds) / gArea < 0.9)

  // 2. Drop micro slivers — a real sliver (text/hatching fragment) is tiny in BOTH dimensions.
  //    A thin LINE (a seam, small in one dimension only) is a real construction line — keep it.
  //    A small ROUND shape (a button/eyelet) is real too — keep it down to a lower floor.
  const gMax = Math.max(graph.bounds.w, graph.bounds.h, 1)
  paths = paths.filter((p) => {
    const maxDim = Math.max(p.bounds.w, p.bounds.h)
    const minDim = Math.min(p.bounds.w, p.bounds.h)
    const round = maxDim > 0 && minDim / maxDim > 0.55
    return maxDim >= gMax * 0.02 || (round && maxDim >= gMax * 0.008)
  })

  // 3. Coalesce near-duplicate shapes (same shape drawn as fill + stroke, or double outlines):
  //    keep the first, inherit a fill/stroke the duplicate had.
  const kept: VectorPath[] = []
  for (const p of paths) {
    const dup = kept.find((k) => k.closed === p.closed && iou(k.bounds, p.bounds) > 0.9)
    if (dup) {
      if (!dup.fill && p.fill) dup.fill = p.fill
      if (!dup.stroke && p.stroke) dup.stroke = p.stroke
      continue
    }
    kept.push({ ...p })
  }

  return { ...graph, paths: kept.map((p, i) => ({ ...p, zIndex: i })) }
}
