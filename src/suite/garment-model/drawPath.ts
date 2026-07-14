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

/**
 * An oval/ellipse inscribed in the a→b bounding box, drawn as two arcs (so it stays a normal
 * region `d` like every other shape). Corner-to-corner drag defines the box, exactly like the
 * rectangle tool.
 */
export function ellipsePath(a: Pt, b: Pt): string {
  const cx = (a.x + b.x) / 2
  const cy = (a.y + b.y) / 2
  const rx = Math.abs(b.x - a.x) / 2
  const ry = Math.abs(b.y - a.y) / 2
  if (rx < 0.5 || ry < 0.5) return ''
  return `M${r(cx - rx)},${r(cy)} A${r(rx)},${r(ry)} 0 1 0 ${r(cx + rx)},${r(cy)} A${r(rx)},${r(ry)} 0 1 0 ${r(cx - rx)},${r(cy)} Z`
}

/**
 * A single smooth curve fitted through a bowed drag — the "give a stroke a slight bump" tool.
 * We fit ONE quadratic bézier that passes through the drag's start, its sampled midpoint and its
 * end, so a straight drag stays a line and a bowed drag keeps exactly the bulge you traced.
 */
export function curvePath(pts: Pt[]): string {
  if (pts.length < 2) return ''
  const a = pts[0]
  const b = pts[pts.length - 1]
  if (pts.length < 3) return linePath(a, b)
  const m = pts[Math.floor(pts.length / 2)]
  // Control point so the quadratic hits `m` at t=0.5:  C = 2·M − ½·(A + B).
  const cx = 2 * m.x - (a.x + b.x) / 2
  const cy = 2 * m.y - (a.y + b.y) / 2
  return `M${r(a.x)},${r(a.y)} Q${r(cx)},${r(cy)} ${r(b.x)},${r(b.y)}`
}
