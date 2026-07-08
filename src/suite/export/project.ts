import type {
  BomItem,
  ColorRef,
  ConstructionSpec,
  GarmentKind,
  GraphicRef,
  ManufacturingProject,
  MaterialRef,
  MeasurementRow,
  ProductionNotes,
} from './types'

export type ProjectInput = {
  styleName: string
  kind: GarmentKind
  brand?: string
  collection?: string
  designer?: string
  season?: string
  fabricColor?: string
}

const SIZES = ['S', 'M', 'L', 'XL', 'XXL']

const KIND_LABEL: Record<GarmentKind, string> = {
  hoodie: 'Hoodie',
  tee: 'T-Shirt',
  jacket: 'Jacket',
  pants: 'Pants',
  cap: 'Cap',
}

const FABRIC: Record<GarmentKind, { fabric: string; gsm: number; comp: string }> = {
  hoodie: { fabric: 'French Terry, brushed back', gsm: 450, comp: '80% Cotton / 20% Polyester' },
  tee: { fabric: 'Single Jersey, combed', gsm: 240, comp: '100% Cotton' },
  jacket: { fabric: 'Cotton Twill, garment dyed', gsm: 320, comp: '98% Cotton / 2% Elastane' },
  pants: { fabric: 'Ripstop Cotton, enzyme wash', gsm: 280, comp: '100% Cotton' },
  cap: { fabric: 'Brushed Cotton Twill', gsm: 260, comp: '100% Cotton' },
}

// Base "M" measurements per kind; grading applies ±5cm per step for width, ±2cm for length.
const BASE_MEASURE: Record<GarmentKind, { point: string; code: string; m: number; grade: number; tol: number }[]> = {
  hoodie: [
    { point: 'Chest (1cm below armhole)', code: 'A', m: 60, grade: 2.5, tol: 1.0 },
    { point: 'Body length (HPS)', code: 'B', m: 72, grade: 2.0, tol: 1.0 },
    { point: 'Shoulder to shoulder', code: 'C', m: 58, grade: 1.5, tol: 0.5 },
    { point: 'Sleeve length', code: 'D', m: 62, grade: 1.0, tol: 0.5 },
    { point: 'Sleeve opening', code: 'E', m: 22, grade: 0.5, tol: 0.5 },
    { point: 'Hood height', code: 'F', m: 40, grade: 0, tol: 0.5 },
    { point: 'Bottom hem width', code: 'G', m: 56, grade: 2.5, tol: 1.0 },
  ],
  tee: [
    { point: 'Chest (1cm below armhole)', code: 'A', m: 58, grade: 2.5, tol: 1.0 },
    { point: 'Body length (HPS)', code: 'B', m: 71, grade: 2.0, tol: 1.0 },
    { point: 'Shoulder to shoulder', code: 'C', m: 52, grade: 1.5, tol: 0.5 },
    { point: 'Sleeve length', code: 'D', m: 24, grade: 1.0, tol: 0.5 },
    { point: 'Neck width', code: 'E', m: 20, grade: 0.5, tol: 0.3 },
  ],
  jacket: [
    { point: 'Chest', code: 'A', m: 62, grade: 2.5, tol: 1.0 },
    { point: 'Body length', code: 'B', m: 70, grade: 2.0, tol: 1.0 },
    { point: 'Shoulder', code: 'C', m: 50, grade: 1.5, tol: 0.5 },
    { point: 'Sleeve length', code: 'D', m: 64, grade: 1.0, tol: 0.5 },
  ],
  pants: [
    { point: 'Waist (relaxed)', code: 'A', m: 40, grade: 2.0, tol: 1.0 },
    { point: 'Hip', code: 'B', m: 56, grade: 2.0, tol: 1.0 },
    { point: 'Inseam', code: 'C', m: 76, grade: 1.5, tol: 1.0 },
    { point: 'Leg opening', code: 'D', m: 22, grade: 0.5, tol: 0.5 },
  ],
  cap: [
    { point: 'Head circumference', code: 'A', m: 58, grade: 1.0, tol: 0.5 },
    { point: 'Brim length', code: 'B', m: 7, grade: 0, tol: 0.3 },
    { point: 'Crown height', code: 'C', m: 12, grade: 0, tol: 0.3 },
  ],
}

function graphicsFor(kind: GarmentKind): GraphicRef[] {
  const base: GraphicRef[] = [
    { name: 'Front Print', placement: 'Front Center', technique: 'Puff Print', widthCm: 28, heightCm: 12, colors: 1 },
    { name: 'Back Print', placement: 'Upper Back', technique: 'Screen Print', widthCm: 32, heightCm: 20, colors: 2 },
  ]
  if (kind === 'hoodie' || kind === 'jacket') {
    base.push({ name: 'Sleeve Print', placement: 'Left Sleeve', technique: 'Heat Transfer', widthCm: 6, heightCm: 22, colors: 1 })
  }
  base.push({ name: 'Chest Embroidery', placement: 'Left Chest', technique: 'Embroidery', widthCm: 6, heightCm: 3, colors: 2 })
  return base
}

function constructionFor(kind: GarmentKind): ConstructionSpec {
  return {
    stitchType: 'Overlock 4-thread + coverstitch hems',
    thread: 'Tex 40 core-spun, tonal to shell',
    pocket: kind === 'hoodie' ? 'Kangaroo pocket, bar-tacked corners' : kind === 'pants' ? 'Cargo + side seam pockets' : 'None',
    collar: kind === 'hoodie' ? 'Double-layer hood, tonal drawcord' : kind === 'tee' ? '1×1 rib crew neck' : 'Standard',
    cuffs: kind === 'hoodie' || kind === 'jacket' ? '2×1 rib cuffs' : 'Clean-finished',
    hem: 'Coverstitch 40mm double-needle',
    labels: 'Woven main label (back neck) + heat-transfer care label (side seam)',
    packaging: 'Individual polybag (recycled) + folded, hangtag on left chest',
  }
}

function colorsFor(fabricColor: string): ColorRef[] {
  return [
    { name: fabricColor || 'Vintage Black', hex: '#1E1E1E', rgb: [30, 30, 30], pantone: 'Pantone 419 C' },
    { name: 'Washed Charcoal', hex: '#2A2A2A', rgb: [42, 42, 42], pantone: 'Pantone 425 C' },
    { name: 'Print — Off White', hex: '#F2F2F2', rgb: [242, 242, 242], pantone: 'Pantone 11-0601 TCX' },
    { name: 'Accent — Lime', hex: '#D8FF3E', rgb: [216, 255, 62], pantone: 'Pantone 388 C' },
  ]
}

function notesFor(kind: GarmentKind): ProductionNotes {
  return {
    special: [
      'Confirm all Pantone against approved lab dips before bulk.',
      'Provide sealed size set (S–XXL) for measurement approval.',
      'Shrinkage must not exceed 5% after 3 wash cycles.',
    ],
    washing: 'Machine wash cold, inside out. Do not tumble dry. Do not bleach.',
    finishing: 'Steam press, remove all thread ends, metal-detect before packing.',
    vintageWash: 'Enzyme + stone wash for a faded vintage hand-feel. Target 2–3 shade drop from raw.',
    distressing: kind === 'pants' || kind === 'jacket' ? 'Light hand-sanding at seams and hems, controlled abrasion.' : 'None',
    embroideryNotes: '3D puff for chest logo where specified; 9 stitches/cm density; tear-away backing.',
  }
}

function bomFor(kind: GarmentKind, f: { fabric: string; comp: string }): BomItem[] {
  const items: BomItem[] = [
    { component: 'Main fabric', material: f.fabric, composition: f.comp, placement: 'Body, sleeves', supplier: 'Atelier Norte', qty: 1.6, unit: 'm' },
    { component: 'Ribbing', material: '2×1 rib', composition: '95% Cotton / 5% Elastane', placement: 'Cuffs, hem', supplier: 'Atelier Norte', qty: 0.3, unit: 'm' },
    { component: 'Sewing thread', material: 'Tex 40 core-spun', composition: '100% Polyester', placement: 'All seams', supplier: 'Coats', qty: 1, unit: 'cone' },
    { component: 'Main label', material: 'Woven damask', composition: 'Recycled Polyester', placement: 'Back neck', supplier: 'Panama Trimmings', qty: 1, unit: 'pc' },
    { component: 'Care label', material: 'Heat-transfer', composition: 'PU', placement: 'Side seam', supplier: 'Panama Trimmings', qty: 1, unit: 'pc' },
    { component: 'Hangtag', material: 'Recycled card 400gsm', composition: 'Paper', placement: 'Left chest', supplier: 'Favini', qty: 1, unit: 'pc' },
    { component: 'Polybag', material: 'Recycled LDPE', composition: 'LDPE', placement: 'Packaging', supplier: 'GreenPack', qty: 1, unit: 'pc' },
  ]
  if (kind === 'hoodie') items.push({ component: 'Drawcord', material: 'Flat 8mm', composition: '100% Cotton', placement: 'Hood', supplier: 'Panama Trimmings', qty: 1.4, unit: 'm' })
  if (kind === 'jacket' || kind === 'pants') items.push({ component: 'Zipper', material: 'YKK #5 metal', composition: 'Brass', placement: kind === 'jacket' ? 'Center front' : 'Fly', supplier: 'YKK', qty: 1, unit: 'pc' })
  if (kind === 'pants') items.push({ component: 'Button', material: '17mm jeans button', composition: 'Zinc alloy', placement: 'Waistband', supplier: 'YKK', qty: 1, unit: 'pc' })
  return items
}

/** Build a complete manufacturing project from minimal design input. */
export function buildManufacturingProject(input: ProjectInput): ManufacturingProject {
  const kind = input.kind
  const f = FABRIC[kind]
  const fabricColor = input.fabricColor || 'Vintage Black'
  const now = new Date()
  const styleNumber = `TH-${kind.slice(0, 2).toUpperCase()}-${(hashCode(input.styleName) % 9000 + 1000)}`

  const materials: MaterialRef[] = [
    { role: 'Main fabric', fabric: f.fabric, weightGsm: f.gsm, composition: f.comp, color: fabricColor, supplier: 'Atelier Norte' },
    { role: 'Ribbing', fabric: '2×1 rib', weightGsm: 320, composition: '95% Cotton / 5% Elastane', color: fabricColor, supplier: 'Atelier Norte' },
  ]

  const measurements: MeasurementRow[] = BASE_MEASURE[kind].map((row) => {
    const values: Record<string, number> = {}
    SIZES.forEach((size, i) => {
      const step = i - 1 // M is index 1 = base
      values[size] = Math.round((row.m + step * row.grade) * 10) / 10
    })
    return { point: row.point, code: row.code, values, toleranceCm: row.tol }
  })

  return {
    meta: {
      brand: input.brand || 'THREADOS',
      collection: input.collection || 'SS26 — Concrete Series',
      styleName: input.styleName,
      styleNumber,
      date: now.toISOString().slice(0, 10),
      designer: input.designer || 'THREADOS Studio',
      season: input.season || 'SS26',
    },
    garment: {
      kind,
      fit: 'Oversized',
      length: 'Regular',
    },
    sizes: SIZES,
    materials,
    construction: constructionFor(kind),
    graphics: graphicsFor(kind),
    measurements,
    colors: colorsFor(fabricColor),
    notes: notesFor(kind),
    bom: bomFor(kind, { fabric: f.fabric, comp: f.comp }),
  }
}

export function kindLabel(kind: GarmentKind): string {
  return KIND_LABEL[kind]
}

function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}
