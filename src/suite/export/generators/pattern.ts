import { PdfDoc } from './pdfKit'
import type { ManufacturingProject } from '../types'

type Piece = { name: string; layer: string; pts: [number, number][] }

function measureM(p: ManufacturingProject, code: string, fallback: number): number {
  return p.measurements.find((m) => m.code === code)?.values['M'] ?? fallback
}

/** Derive nominal flat pattern blocks (cm) from the graded measurements. */
function pieces(p: ManufacturingProject): Piece[] {
  const kind = p.garment.kind
  if (kind === 'pants') {
    const waist = measureM(p, 'A', 40)
    const inseam = measureM(p, 'C', 76)
    const leg = measureM(p, 'D', 22)
    const w = waist / 2 + 4
    const front: [number, number][] = [[0, 0], [leg, 0], [leg + 2, inseam * 0.55], [w, inseam], [0, inseam]]
    const back: [number, number][] = [[0, 0], [leg + 2, 0], [leg + 5, inseam * 0.55], [w + 3, inseam], [0, inseam]]
    return [
      { name: 'Front Leg', layer: 'FRONT', pts: front },
      { name: 'Back Leg', layer: 'BACK', pts: back },
    ]
  }
  if (kind === 'cap') {
    const circ = measureM(p, 'A', 58)
    const panel: [number, number][] = [[0, 0], [circ / 6, 0], [circ / 12, 14], [0, 13]]
    return [{ name: 'Crown Panel', layer: 'PANEL', pts: panel }]
  }
  const chest = measureM(p, 'A', 60)
  const len = measureM(p, 'B', 72)
  const shoulder = measureM(p, 'C', 56)
  const sleeveLen = measureM(p, 'D', 62)
  const w = chest / 2
  const front: [number, number][] = [
    [0, 0], [w, 0], [w, len - 26], [w - 5, len - 18], [shoulder / 2, len], [8, len - 2], [5, len - 16], [0, len - 26],
  ]
  const back: [number, number][] = [
    [0, 0], [w, 0], [w, len - 24], [w - 4, len - 16], [shoulder / 2, len], [5, len], [0, len - 16],
  ]
  const sw = 26
  const sleeve: [number, number][] = [[0, 0], [sw, 0], [sw - 4, sleeveLen - 16], [sw / 2, sleeveLen], [4, sleeveLen - 16]]
  return [
    { name: 'Front', layer: 'FRONT', pts: front },
    { name: 'Back', layer: 'BACK', pts: back },
    { name: 'Sleeve', layer: 'SLEEVE', pts: sleeve },
  ]
}

function lwpolyline(layer: string, pts: [number, number][], ox: number): string {
  const head = ['0', 'LWPOLYLINE', '8', layer, '90', String(pts.length), '70', '1']
  const body: string[] = []
  pts.forEach(([x, y]) => body.push('10', (x + ox).toFixed(2), '20', y.toFixed(2)))
  return head.concat(body).join('\n')
}

/** Generate a real, CAD-openable ASCII DXF of the pattern blocks. */
export function generatePatternDxf(p: ManufacturingProject): string {
  const ps = pieces(p)
  const entities: string[] = []
  let ox = 0
  ps.forEach((piece) => {
    entities.push(lwpolyline(piece.layer, piece.pts, ox))
    const maxX = Math.max(...piece.pts.map((pt) => pt[0]))
    ox += maxX + 10 // lay pieces side by side with a gap (cm)
  })
  return [
    '999', `THREADOS pattern — ${p.meta.styleName} (${p.meta.styleNumber}) — units: cm`,
    '0', 'SECTION', '2', 'HEADER', '9', '$INSUNITS', '70', '5', '0', 'ENDSEC',
    '0', 'SECTION', '2', 'ENTITIES',
    entities.join('\n'),
    '0', 'ENDSEC', '0', 'EOF', '',
  ].join('\n')
}

/** A human-readable Pattern PDF showing the piece outlines to scale-ish. */
export function generatePatternPdf(p: ManufacturingProject): Blob {
  const pdf = new PdfDoc('Pattern')
  pdf.cover(p, 'Nominal pattern blocks · export to CAD via Pattern.dxf')
  pdf.section('Pattern Pieces')
  const ps = pieces(p)
  const doc = pdf.doc
  // scale cm -> pt so the biggest piece fits a column
  const maxDim = Math.max(...ps.flatMap((pc) => pc.pts.flat()))
  const scale = 220 / maxDim
  const cols = Math.min(ps.length, 3)
  const colW = (pdf.W - 2 * pdf.margin) / cols
  ps.forEach((piece, i) => {
    const row = Math.floor(i / cols)
    const y = 120 + row * 280
    const ox = pdf.margin + (i % cols) * colW + 10
    doc.setDrawColor(30, 30, 38)
    doc.setLineWidth(1)
    const mapped = piece.pts.map(([px, py]) => [ox + px * scale, y + 220 - py * scale] as [number, number])
    doc.lines(
      mapped.slice(1).map((pt, k) => [pt[0] - mapped[k][0], pt[1] - mapped[k][1]]),
      mapped[0][0],
      mapped[0][1],
      [1, 1],
      'S',
      true,
    )
    doc.setLineWidth(0.2)
    doc.setTextColor(120, 120, 132)
    doc.setFontSize(9)
    doc.text(`${piece.name} (cut per spec)`, ox, y + 240)
  })
  pdf.space(300 + Math.floor((ps.length - 1) / cols) * 280)
  pdf.section('Notes')
  pdf.bullets([
    'Blocks are nominal, derived from the graded size chart — true up against the sealed sample.',
    'Seam allowance 1cm unless noted; 2.5cm at hems.',
    'Grainlines run parallel to centre front / centre back.',
    'Pattern.dxf contains the same pieces as CAD polylines (units: cm).',
  ])
  return pdf.finalizeAndBlob()
}
