/**
 * SVG text → VectorGraph. Hand-rolled (NO DOMParser) so it runs identically in node tests and the
 * browser. Walks the markup maintaining a transform stack across nested <g>, converts every drawn
 * primitive (path/rect/circle/ellipse/line/polygon/polyline) to an absolute path `d`, and reads
 * fill/stroke/dash. Robust to the messy real-world exports Illustrator produces; tolerant of tags
 * it doesn't understand (they're skipped, never thrown on).
 */
import type { Bounds, VectorGraph, VectorPath } from './vectorGraph'
import { unionBounds } from './vectorGraph'
import { pathBounds, isClosedPath } from './pathGeometry'
import { applyMatrixToPath, multiply, parseTransform, type Matrix, IDENTITY } from './svgTransform'

const SHAPE_TAGS = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polygon', 'polyline'])

/** Pull `name="value"` (and single-quoted) attributes from an opening tag's attribute string. */
function attrs(s: string): Record<string, string> {
  const out: Record<string, string> = {}
  const re = /([\w:-]+)\s*=\s*"([^"]*)"|([\w:-]+)\s*=\s*'([^']*)'/g
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) out[(m[1] || m[3]).toLowerCase()] = m[2] ?? m[4] ?? ''
  return out
}

/** Read a paint (fill/stroke) from attributes or an inline style string; '' if absent, undefined if none. */
function paint(a: Record<string, string>, key: 'fill' | 'stroke'): string | undefined {
  const style = a.style ?? ''
  const styleMatch = new RegExp(`${key}\\s*:\\s*([^;]+)`).exec(style)
  const raw = (styleMatch?.[1] ?? a[key] ?? '').trim()
  if (!raw) return undefined
  if (raw.toLowerCase() === 'none') return undefined
  return raw
}

function isDashed(a: Record<string, string>): boolean {
  const style = a.style ?? ''
  const dash = /stroke-dasharray\s*:\s*([^;]+)/.exec(style)?.[1] ?? a['stroke-dasharray'] ?? ''
  return !!dash && dash.trim() !== 'none' && dash.trim() !== '0'
}

function num(a: Record<string, string>, k: string, def = 0): number {
  const v = parseFloat(a[k])
  return Number.isFinite(v) ? v : def
}

/** Ellipse as FOUR cardinal quarter-arcs so the path's anchor points are its true bbox extremes
 *  (top/right/bottom/left). A two-arc form puts both endpoints on the same axis, losing an extent. */
function ellipsePath(cx: number, cy: number, rx: number, ry: number): string {
  return (
    `M ${cx} ${cy - ry} ` +
    `A ${rx} ${ry} 0 0 1 ${cx + rx} ${cy} ` +
    `A ${rx} ${ry} 0 0 1 ${cx} ${cy + ry} ` +
    `A ${rx} ${ry} 0 0 1 ${cx - rx} ${cy} ` +
    `A ${rx} ${ry} 0 0 1 ${cx} ${cy - ry} Z`
  )
}

/** Convert a leaf shape element to SVG path data + whether it's a closed region. */
function shapeToPath(tag: string, a: Record<string, string>): { d: string; closed: boolean } | null {
  switch (tag) {
    case 'path': {
      const d = a.d?.trim()
      return d ? { d, closed: isClosedPath(d) } : null
    }
    case 'rect': {
      const x = num(a, 'x')
      const y = num(a, 'y')
      const w = num(a, 'width')
      const h = num(a, 'height')
      if (w <= 0 || h <= 0) return null
      return { d: `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`, closed: true }
    }
    case 'circle': {
      const cx = num(a, 'cx')
      const cy = num(a, 'cy')
      const r = num(a, 'r')
      if (r <= 0) return null
      return { d: ellipsePath(cx, cy, r, r), closed: true }
    }
    case 'ellipse': {
      const cx = num(a, 'cx')
      const cy = num(a, 'cy')
      const rx = num(a, 'rx')
      const ry = num(a, 'ry')
      if (rx <= 0 || ry <= 0) return null
      return { d: ellipsePath(cx, cy, rx, ry), closed: true }
    }
    case 'line': {
      const d = `M ${num(a, 'x1')} ${num(a, 'y1')} L ${num(a, 'x2')} ${num(a, 'y2')}`
      return { d, closed: false }
    }
    case 'polygon':
    case 'polyline': {
      const pts = (a.points ?? '').trim().split(/[\s,]+/).map(Number)
      if (pts.length < 4) return null
      let d = `M ${pts[0]} ${pts[1]}`
      for (let i = 2; i + 1 < pts.length; i += 2) d += ` L ${pts[i]} ${pts[i + 1]}`
      if (tag === 'polygon') d += ' Z'
      return { d, closed: tag === 'polygon' }
    }
    default:
      return null
  }
}

/** Parse the root <svg> artboard bounds from viewBox (preferred) or width/height. */
function rootBounds(svg: string): Bounds {
  const open = /<svg\b([^>]*)>/i.exec(svg)?.[1] ?? ''
  const a = attrs(open)
  if (a.viewbox) {
    const [minX, minY, w, h] = a.viewbox.trim().split(/[\s,]+/).map(Number)
    if ([minX, minY, w, h].every(Number.isFinite) && w > 0 && h > 0) return { minX, minY, w, h }
  }
  const w = parseFloat(a.width)
  const h = parseFloat(a.height)
  if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) return { minX: 0, minY: 0, w, h }
  return { minX: 0, minY: 0, w: 0, h: 0 }
}

export function readSvg(svgText: string): VectorGraph {
  const paths: VectorPath[] = []
  let union: Bounds = { minX: 0, minY: 0, w: 0, h: 0 }
  const stack: Matrix[] = [IDENTITY]
  let z = 0

  // Walk every tag in document order, maintaining the transform stack across <g>…</g>.
  const tagRe = /<\s*(\/?)\s*([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)\s*>/g
  let m: RegExpExecArray | null
  while ((m = tagRe.exec(svgText))) {
    const closing = m[1] === '/'
    const tag = m[2].toLowerCase()
    const attrStr = m[3] ?? ''
    const selfClose = m[4] === '/'

    if (tag === 'g') {
      if (closing) {
        if (stack.length > 1) stack.pop()
      } else {
        const t = parseTransform(attrs(attrStr).transform)
        const next = multiply(stack[stack.length - 1], t)
        if (!selfClose) stack.push(next)
      }
      continue
    }
    if (!SHAPE_TAGS.has(tag) || closing) continue

    const a = attrs(attrStr)
    const shape = shapeToPath(tag, a)
    if (!shape) continue
    const own = parseTransform(a.transform)
    const mat = multiply(stack[stack.length - 1], own)
    const d = applyMatrixToPath(shape.d, mat)
    const bounds = pathBounds(d)
    if (bounds.w === 0 && bounds.h === 0) continue // degenerate — skip
    const vp: VectorPath = {
      id: `p${z}`,
      d,
      fill: paint(a, 'fill'),
      stroke: paint(a, 'stroke'),
      dashed: isDashed(a),
      closed: shape.closed,
      bounds,
      zIndex: z++,
    }
    paths.push(vp)
    union = unionBounds(union, bounds)
  }

  const artboardBounds = rootBounds(svgText)
  const bounds = artboardBounds.w > 0 ? artboardBounds : union
  return {
    bounds,
    artboards: [{ id: 'art0', bounds }],
    paths,
  }
}
