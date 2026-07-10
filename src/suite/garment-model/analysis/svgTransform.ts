/**
 * Affine transforms for SVG geometry — parse a `transform` attribute into a matrix and apply it to
 * a path `d`, absolutizing the path in the process. Pure, no DOM. Used by svgReader so element/group
 * transforms are baked into absolute coordinates (Illustrator exports often wrap art in one <g>).
 *
 * Matrix is the SVG 2×3 form [a b c d e f]:  x' = a·x + c·y + e,  y' = b·y ...  (see apply()).
 */

export type Matrix = [number, number, number, number, number, number]

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0]

export function isIdentity(m: Matrix): boolean {
  return m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 1 && m[4] === 0 && m[5] === 0
}

/** m2 applied after m1 (i.e. the SVG parent∘child order when concatenating group transforms). */
export function multiply(m1: Matrix, m2: Matrix): Matrix {
  const [a1, b1, c1, d1, e1, f1] = m1
  const [a2, b2, c2, d2, e2, f2] = m2
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ]
}

function apply(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]
}

/** Average linear scale factor (for approximating arc radii under a transform). */
export function scaleFactor(m: Matrix): number {
  const sx = Math.hypot(m[0], m[1])
  const sy = Math.hypot(m[2], m[3])
  return (sx + sy) / 2 || 1
}

/** Parse an SVG transform attribute (translate/scale/matrix/rotate — the common cases). */
export function parseTransform(str: string | undefined): Matrix {
  if (!str) return IDENTITY
  let m: Matrix = IDENTITY
  const re = /(matrix|translate|scale|rotate)\s*\(([^)]*)\)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(str))) {
    const fn = match[1]
    const args = match[2].split(/[\s,]+/).map(Number).filter((n) => !Number.isNaN(n))
    let t: Matrix = IDENTITY
    if (fn === 'matrix' && args.length === 6) t = args as Matrix
    else if (fn === 'translate') t = [1, 0, 0, 1, args[0] || 0, args[1] || 0]
    else if (fn === 'scale') t = [args[0] ?? 1, 0, 0, args[1] ?? args[0] ?? 1, 0, 0]
    else if (fn === 'rotate' && args.length >= 1) {
      const rad = ((args[0] || 0) * Math.PI) / 180
      const cos = Math.cos(rad)
      const sin = Math.sin(rad)
      const rot: Matrix = [cos, sin, -sin, cos, 0, 0]
      const cxv = args[1] || 0
      const cyv = args[2] || 0
      t = cxv || cyv ? multiply([1, 0, 0, 1, cxv, cyv], multiply(rot, [1, 0, 0, 1, -cxv, -cyv])) : rot
    }
    m = multiply(m, t)
  }
  return m
}

const NUM = /[a-zA-Z]|-?\d*\.?\d+(?:[eE][-+]?\d+)?/g
const ARGN: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 }

/**
 * Apply a matrix to a path `d`, returning an absolutized path. Converts relative→absolute and
 * H/V→L (needed once axes may rotate/scale). Arcs keep their flags; radii scale by the average
 * factor and the endpoint transforms exactly (an approximation only relevant to transformed arcs,
 * rare in technical flats).
 */
export function applyMatrixToPath(d: string, m: Matrix): string {
  if (isIdentity(m)) return d
  const tokens = d.match(NUM) ?? []
  const out: string[] = []
  const f = (n: number) => (Math.abs(n) < 1e-6 ? '0' : String(Math.round(n * 1000) / 1000))
  let i = 0
  let cmd = ''
  let cx = 0
  let cy = 0
  let sx = 0
  let sy = 0
  const s = scaleFactor(m)

  while (i < tokens.length) {
    const tok = tokens[i]
    if (/[a-zA-Z]/.test(tok)) {
      cmd = tok
      i++
    } else if (cmd === '') {
      i++
      continue
    }
    const up = cmd.toUpperCase()
    const abs = cmd === up
    const n = ARGN[up]
    if (n === undefined) {
      i++
      continue
    }
    if (up !== 'Z' && i + n > tokens.length) break
    const a = tokens.slice(i, i + n).map(Number)
    i += n
    const ax = (x: number, y: number) => (abs ? [x, y] : [x + cx, y + cy])

    switch (up) {
      case 'M':
      case 'L':
      case 'T': {
        const [x, y] = ax(a[0], a[1])
        const [px, py] = apply(m, x, y)
        out.push(`${up === 'M' ? 'M' : 'L'} ${f(px)} ${f(py)}`)
        cx = x
        cy = y
        if (up === 'M') {
          sx = x
          sy = y
          cmd = abs ? 'L' : 'l'
        }
        break
      }
      case 'H': {
        const x = abs ? a[0] : a[0] + cx
        const [px, py] = apply(m, x, cy)
        out.push(`L ${f(px)} ${f(py)}`)
        cx = x
        break
      }
      case 'V': {
        const y = abs ? a[0] : a[0] + cy
        const [px, py] = apply(m, cx, y)
        out.push(`L ${f(px)} ${f(py)}`)
        cy = y
        break
      }
      case 'C': {
        const [x1, y1] = ax(a[0], a[1])
        const [x2, y2] = ax(a[2], a[3])
        const [x, y] = ax(a[4], a[5])
        const p1 = apply(m, x1, y1)
        const p2 = apply(m, x2, y2)
        const p = apply(m, x, y)
        out.push(`C ${f(p1[0])} ${f(p1[1])} ${f(p2[0])} ${f(p2[1])} ${f(p[0])} ${f(p[1])}`)
        cx = x
        cy = y
        break
      }
      case 'S':
      case 'Q': {
        const [x1, y1] = ax(a[0], a[1])
        const [x, y] = ax(a[2], a[3])
        const p1 = apply(m, x1, y1)
        const p = apply(m, x, y)
        out.push(`${up} ${f(p1[0])} ${f(p1[1])} ${f(p[0])} ${f(p[1])}`)
        cx = x
        cy = y
        break
      }
      case 'A': {
        const [x, y] = ax(a[5], a[6])
        const p = apply(m, x, y)
        out.push(`A ${f(a[0] * s)} ${f(a[1] * s)} ${f(a[2])} ${a[3]} ${a[4]} ${f(p[0])} ${f(p[1])}`)
        cx = x
        cy = y
        break
      }
      case 'Z': {
        out.push('Z')
        cx = sx
        cy = sy
        break
      }
    }
  }
  return out.join(' ')
}
