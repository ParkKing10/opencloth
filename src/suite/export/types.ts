/**
 * Manufacturing Export System — the single source of truth every generator reads.
 * A ManufacturingProject is derived from the design/project data (see project.ts);
 * generators never invent data, they render this model into real files.
 */

export type GarmentKind = 'hoodie' | 'tee' | 'jacket' | 'pants' | 'cap'
export type GarmentView = 'front' | 'back' | 'side' | 'detail'

export type ColorRef = {
  name: string
  hex: string
  rgb: [number, number, number]
  pantone: string
}

export type MaterialRef = {
  role: string // e.g. "Main fabric", "Ribbing"
  fabric: string
  weightGsm: number
  composition: string
  color: string
  supplier: string
}

export type GraphicRef = {
  name: string // "Front Print"
  placement: string // "Front Center"
  technique: string // "Puff Print", "Screen Print", "Embroidery"
  widthCm: number
  heightCm: number
  colors: number
}

export type ConstructionSpec = {
  stitchType: string
  thread: string
  pocket: string
  collar: string
  cuffs: string
  hem: string
  labels: string
  packaging: string
}

export type MeasurementRow = {
  point: string // "Chest", "Body length"...
  code: string // "A", "B"...
  values: Record<string, number> // size -> cm
  toleranceCm: number
}

export type BomItem = {
  component: string
  material: string
  composition: string
  placement: string
  supplier: string
  qty: number
  unit: string
}

export type ProductionNotes = {
  special: string[]
  washing: string
  finishing: string
  vintageWash: string
  distressing: string
  embroideryNotes: string
}

export type ProjectMeta = {
  brand: string
  collection: string
  styleName: string
  styleNumber: string
  date: string
  designer: string
  season: string
}

export type ManufacturingProject = {
  meta: ProjectMeta
  garment: {
    kind: GarmentKind
    fit: string
    length: string
  }
  sizes: string[] // ["S","M","L","XL","XXL"]
  materials: MaterialRef[]
  construction: ConstructionSpec
  graphics: GraphicRef[]
  measurements: MeasurementRow[]
  colors: ColorRef[]
  notes: ProductionNotes
  bom: BomItem[]
}

/** Which parts of the manufacturing package to include (the modal checklist). */
export type PackageSelection = {
  techPack: boolean
  sizeChart: boolean
  bom: boolean
  printAssets: boolean
  logos: boolean
  patterns: boolean
  productionNotes: boolean
  colorReferences: boolean
  packaging: boolean
  readme: boolean
}

export const DEFAULT_SELECTION: PackageSelection = {
  techPack: true,
  sizeChart: true,
  bom: true,
  printAssets: true,
  logos: true,
  patterns: true,
  productionNotes: true,
  colorReferences: true,
  packaging: true,
  readme: true,
}

/** Progress event emitted while a package is assembled — drives the modal animation. */
export type PackageProgress = { step: string; done: number; total: number }

/** Brand accent used across generated documents (THREADOS lime). */
export const BRAND_LIME: [number, number, number] = [216, 255, 62]
export const INK: [number, number, number] = [18, 18, 24]
export const MUTED: [number, number, number] = [120, 120, 132]
