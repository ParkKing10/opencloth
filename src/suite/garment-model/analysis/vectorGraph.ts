/**
 * The vector graph — the flattened geometry space the Garment Analysis Engine reasons over.
 *
 * A garment file (SVG now; .ai/.pdf later) is reduced to a flat list of VectorPath primitives with
 * absolute geometry, fills/strokes and z-order. NO named Illustrator layers — the engine infers
 * garment structure from geometry alone (symmetry, position, size, containment, repetition), which
 * is exactly what the founder wants and what survives the browser's inability to read the native
 * .ai layer hierarchy (PGF). Everything here is pure data — no DOM, no React — so the whole core is
 * unit-testable in node and identical in the browser.
 */

export type Bounds = { minX: number; minY: number; w: number; h: number }

export type Point = { x: number; y: number }

/** One drawn primitive, normalized. `d` is SVG path data; rects/circles/etc. are converted to `d`. */
export type VectorPath = {
  id: string
  /** SVG path data — used verbatim by the renderer (never rewritten, only whole-artboard offset/mirror). */
  d: string
  fill?: string
  stroke?: string
  dashed: boolean
  closed: boolean
  bounds: Bounds
  /** Draw order — later = on top. */
  zIndex: number
}

export type Artboard = { id: string; bounds: Bounds }

export type VectorGraph = {
  /** Union bounds of all paths (the garment's overall box). */
  bounds: Bounds
  artboards: Artboard[]
  paths: VectorPath[]
}

export const EMPTY_BOUNDS: Bounds = { minX: 0, minY: 0, w: 0, h: 0 }

export function boundsArea(b: Bounds): number {
  return Math.max(0, b.w) * Math.max(0, b.h)
}

export function boundsCenter(b: Bounds): Point {
  return { x: b.minX + b.w / 2, y: b.minY + b.h / 2 }
}

/** Union of two bounds (either may be zero-size). */
export function unionBounds(a: Bounds, b: Bounds): Bounds {
  if (a.w === 0 && a.h === 0) return b
  if (b.w === 0 && b.h === 0) return a
  const minX = Math.min(a.minX, b.minX)
  const minY = Math.min(a.minY, b.minY)
  const maxX = Math.max(a.minX + a.w, b.minX + b.w)
  const maxY = Math.max(a.minY + a.h, b.minY + b.h)
  return { minX, minY, w: maxX - minX, h: maxY - minY }
}
