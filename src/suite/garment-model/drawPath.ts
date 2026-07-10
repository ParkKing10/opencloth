/**
 * Convert drawing input into editable SVG path data (Milestone 8.2, Draw Garment). Freehand strokes
 * are smoothed with quadratic midpoints; rectangles and lines are exact. The output is a normal
 * region `d`, so anything drawn becomes an editable garment region (later, AI can analyze it).
 */
export type Pt = { x: number; y: number }

const r = (n: number) => Math.round(n * 10) / 10

/** Smooth freehand points into a quadratic path. */
export function pointsToPath(pts: Pt[]): string {
  if (pts.length === 0) return ''
  if (pts.length === 1) return `M${r(pts[0].x)},${r(pts[0].y)}`
  let d = `M${r(pts[0].x)},${r(pts[0].y)}`
  for (let i = 1; i < pts.length - 1; i += 1) {
    const mx = (pts[i].x + pts[i + 1].x) / 2
    const my = (pts[i].y + pts[i + 1].y) / 2
    d += ` Q${r(pts[i].x)},${r(pts[i].y)} ${r(mx)},${r(my)}`
  }
  const last = pts[pts.length - 1]
  d += ` L${r(last.x)},${r(last.y)}`
  return d
}

export function rectPath(a: Pt, b: Pt): string {
  const x1 = Math.min(a.x, b.x)
  const y1 = Math.min(a.y, b.y)
  const x2 = Math.max(a.x, b.x)
  const y2 = Math.max(a.y, b.y)
  return `M${r(x1)},${r(y1)} L${r(x2)},${r(y1)} L${r(x2)},${r(y2)} L${r(x1)},${r(y2)} Z`
}

export function linePath(a: Pt, b: Pt): string {
  return `M${r(a.x)},${r(a.y)} L${r(b.x)},${r(b.y)}`
}
