/**
 * .ai / .pdf → VectorGraph via pdf.js. Illustrator saves .ai as PDF-compatible; pdf.js's
 * getOperatorList() yields the real VECTOR path/fill/stroke operators (flattened — transforms
 * applied, no named layers, which is exactly what our geometry-based analysis wants). We interpret
 * the path-construction + paint ops into the SAME VectorGraph shape svgReader produces, so the
 * classifier and mapper are reused verbatim.
 *
 * Browser-only (needs the pdf.js worker). Honest limits: clipping paths / pattern fills / text
 * outlines can inject stray subpaths on dense files; tiny/degenerate subpaths are dropped.
 */
import type { Bounds, VectorGraph, VectorPath } from './vectorGraph'
import { unionBounds } from './vectorGraph'
import { pathBounds } from './pathGeometry'
import { loadPdfjs } from '../../garments/import/preview'

type M = [number, number, number, number, number, number]
const mul = (m: M, n: M): M => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
]
const applyPt = (m: M, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]
const rgb = (a: number[]): string => '#' + a.slice(0, 3).map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('')

/** Read the first page's vector content into a VectorGraph. */
export async function readPdfVector(bytes: Uint8Array): Promise<VectorGraph> {
  const pdfjs = await loadPdfjs()
  const OPS = pdfjs.OPS
  const doc = await pdfjs.getDocument({ data: bytes }).promise
  try {
    const page = await doc.getPage(1)
    const view = page.view // [x0, y0, x1, y1] in PDF units (y up)
    const w = view[2] - view[0]
    const h = view[3] - view[1]
    // Flip PDF's y-up space into SVG y-down, origin at 0,0.
    const base: M = [1, 0, 0, -1, -view[0], view[3]]
    const opList = await page.getOperatorList()

    const paths: VectorPath[] = []
    let union: Bounds = { minX: 0, minY: 0, w: 0, h: 0 }
    let z = 0
    const ctmStack: M[] = []
    let ctm: M = base
    let fill: string | undefined
    let stroke: string | undefined
    let cur: string[] = [] // path `d` segments in device space
    let hasClose = false

    const emit = (closed: boolean) => {
      if (cur.length === 0) return
      const d = cur.join(' ')
      const b = pathBounds(d)
      if (b.w > 0.5 || b.h > 0.5) {
        paths.push({ id: `p${z}`, d, fill: closed ? fill : undefined, stroke, dashed: false, closed: closed || hasClose, bounds: b, zIndex: z++ })
        union = unionBounds(union, b)
      }
      cur = []
      hasClose = false
    }

    for (let i = 0; i < opList.fnArray.length; i++) {
      const fn = opList.fnArray[i]
      const args = opList.argsArray[i] as number[] | number[][]
      switch (fn) {
        case OPS.save:
          ctmStack.push(ctm)
          break
        case OPS.restore:
          ctm = ctmStack.pop() ?? base
          break
        case OPS.transform:
          ctm = mul(ctm, args as unknown as M)
          break
        case OPS.setFillRGBColor:
          fill = rgb(args as number[])
          break
        case OPS.setStrokeRGBColor:
          stroke = rgb(args as number[])
          break
        case OPS.constructPath: {
          // args = [ subOps: number[], coords: number[] ] — walk the sub-ops, consuming coords.
          const subOps = (args as number[][])[0] as number[]
          const co = (args as number[][])[1] as number[]
          let k = 0
          const P = (x: number, y: number) => applyPt(ctm, x, y)
          for (const op of subOps) {
            if (op === OPS.moveTo) {
              const [x, y] = P(co[k++], co[k++])
              cur.push(`M ${x.toFixed(2)} ${y.toFixed(2)}`)
            } else if (op === OPS.lineTo) {
              const [x, y] = P(co[k++], co[k++])
              cur.push(`L ${x.toFixed(2)} ${y.toFixed(2)}`)
            } else if (op === OPS.curveTo) {
              const [x1, y1] = P(co[k++], co[k++])
              const [x2, y2] = P(co[k++], co[k++])
              const [x, y] = P(co[k++], co[k++])
              cur.push(`C ${x1.toFixed(2)} ${y1.toFixed(2)} ${x2.toFixed(2)} ${y2.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)}`)
            } else if (op === OPS.curveTo2 || op === OPS.curveTo3) {
              const [x1, y1] = P(co[k++], co[k++])
              const [x, y] = P(co[k++], co[k++])
              cur.push(`Q ${x1.toFixed(2)} ${y1.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)}`)
            } else if (op === OPS.rectangle) {
              const rx = co[k++]
              const ry = co[k++]
              const rw = co[k++]
              const rh = co[k++]
              const c0 = P(rx, ry)
              const c1 = P(rx + rw, ry)
              const c2 = P(rx + rw, ry + rh)
              const c3 = P(rx, ry + rh)
              cur.push(`M ${c0[0].toFixed(2)} ${c0[1].toFixed(2)} L ${c1[0].toFixed(2)} ${c1[1].toFixed(2)} L ${c2[0].toFixed(2)} ${c2[1].toFixed(2)} L ${c3[0].toFixed(2)} ${c3[1].toFixed(2)} Z`)
              hasClose = true
            } else if (op === OPS.closePath) {
              cur.push('Z')
              hasClose = true
            }
          }
          break
        }
        case OPS.fill:
        case OPS.eoFill:
          emit(true)
          break
        case OPS.stroke:
          emit(false)
          break
        case OPS.fillStroke:
        case OPS.eoFillStroke:
        case OPS.closeFillStroke:
        case OPS.closeEOFillStroke:
          emit(true)
          break
        case OPS.closeStroke:
          emit(false)
          break
        case OPS.endPath:
          cur = []
          hasClose = false
          break
      }
    }

    const bounds: Bounds = w > 0 && h > 0 ? { minX: 0, minY: 0, w, h } : union
    return { bounds, artboards: [{ id: 'art0', bounds }], paths }
  } finally {
    doc.destroy()
  }
}
