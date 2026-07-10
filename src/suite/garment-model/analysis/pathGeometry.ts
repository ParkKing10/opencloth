/**
 * Pure SVG-path geometry — no DOM. Parses path `d` strings into absolute points so the engine can
 * compute bounds, closed-ness, centroids and containment. Approximate by design: curve control
 * points widen the bbox slightly (fine for classification), and we never rewrite the `d` itself.
 */
import type { Bounds, Point } from './vectorGraph'

/** Numbers-and-commands tokenizer for an SVG path `d`. */
function tokenize(d: string): string[] {
  return d.match(/[a-zA-Z]|-?\d*\.?\d+(?:[eE][-+]?\d+)?/g) ?? []
}

const ARG_COUNT: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 }

/**
 * Every absolute anchor + control point touched by the path. Control points are included so a
 * bbox derived from these is a safe over-estimate of the true curve extent.
 */
export function pathPoints(d: string): Point[] {
  const tokens = tokenize(d)
  const pts: Point[] = []
  let i = 0
  let cmd = ''
  let cx = 0
  let cy = 0
  let sx = 0
  let sy = 0
  const push = (x: number, y: number) => pts.push({ x, y })

  while (i < tokens.length) {
    const tok = tokens[i]
    if (/[a-zA-Z]/.test(tok)) {
      cmd = tok
      i++
    } else if (cmd === '') {
      // stray number with no command — skip to avoid an infinite loop
      i++
      continue
    }
    const up = cmd.toUpperCase()
    const abs = cmd === up
    const n = ARG_COUNT[up]
    if (n === undefined) {
      i++
      continue
    }
    if (up !== 'Z' && i + n > tokens.length) break // malformed tail — stop cleanly
    const args = tokens.slice(i, i + n).map(Number)
    i += n

    switch (up) {
      case 'M': {
        let [x, y] = args
        if (!abs) {
          x += cx
          y += cy
        }
        cx = x
        cy = y
        sx = x
        sy = y
        push(x, y)
        // Subsequent implicit coordinate pairs after an M are treated as L (per SVG spec).
        cmd = abs ? 'L' : 'l'
        break
      }
      case 'L':
      case 'T': {
        let [x, y] = args
        if (!abs) {
          x += cx
          y += cy
        }
        cx = x
        cy = y
        push(x, y)
        break
      }
      case 'H': {
        let x = args[0]
        if (!abs) x += cx
        cx = x
        push(x, cy)
        break
      }
      case 'V': {
        let y = args[0]
        if (!abs) y += cy
        cy = y
        push(cx, y)
        break
      }
      case 'C': {
        let [x1, y1, x2, y2, x, y] = args
        if (!abs) {
          x1 += cx
          y1 += cy
          x2 += cx
          y2 += cy
          x += cx
          y += cy
        }
        push(x1, y1)
        push(x2, y2)
        push(x, y)
        cx = x
        cy = y
        break
      }
      case 'S':
      case 'Q': {
        let [x1, y1, x, y] = args
        if (!abs) {
          x1 += cx
          y1 += cy
          x += cx
          y += cy
        }
        push(x1, y1)
        push(x, y)
        cx = x
        cy = y
        break
      }
      case 'A': {
        let x = args[5]
        let y = args[6]
        if (!abs) {
          x += cx
          y += cy
        }
        push(x, y)
        cx = x
        cy = y
        break
      }
      case 'Z': {
        cx = sx
        cy = sy
        break
      }
    }
  }
  return pts
}

export function boundsOfPoints(pts: Point[]): Bounds {
  if (pts.length === 0) return { minX: 0, minY: 0, w: 0, h: 0 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of pts) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { minX, minY, w: maxX - minX, h: maxY - minY }
}

export function pathBounds(d: string): Bounds {
  return boundsOfPoints(pathPoints(d))
}

/** A path is closed if it contains a Z/z close command. */
export function isClosedPath(d: string): boolean {
  return /[zZ]/.test(d)
}

/** Does the path use only straight commands (M/L/H/V/Z)? Curves widen bbox but don't affect this. */
export function isStraightPath(d: string): boolean {
  return !/[cCsSqQtTaA]/.test(d)
}

/** Standard even-odd ray-cast point-in-polygon. */
export function pointInPolygon(pt: Point, poly: Point[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    const intersects = a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y || 1e-12) + a.x
    if (intersects) inside = !inside
  }
  return inside
}

/** Inner bbox lies (mostly) inside outer bbox, with a tolerance as a fraction of the outer size. */
export function bboxContains(outer: Bounds, inner: Bounds, tol = 0.02): boolean {
  const px = outer.w * tol
  const py = outer.h * tol
  return (
    inner.minX >= outer.minX - px &&
    inner.minY >= outer.minY - py &&
    inner.minX + inner.w <= outer.minX + outer.w + px &&
    inner.minY + inner.h <= outer.minY + outer.h + py
  )
}

export function boundsCenter(b: Bounds): Point {
  return { x: b.minX + b.w / 2, y: b.minY + b.h / 2 }
}
