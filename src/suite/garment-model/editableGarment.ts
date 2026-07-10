/**
 * THREADOS Editable Garment — the structured-vector format the future AI worker will emit.
 *
 * A garment is NEVER a flat PNG. It is a hierarchy of independently-editable vector REGIONS
 * (Body, Sleeves, Collar, Pocket, Zipper, Rib, Cuffs, Labels, Stitching, …) drawn as a
 * professional apparel technical flat. The editor is built around this format from now on;
 * the AI worker (a future milestone) converts a prompt into exactly this structure.
 *
 * The tree is normalized: a flat `regions` map keyed by id + top-level `rootIds`, with each
 * region listing its `children` ids in draw order. Normalized form keeps immutable edits and
 * lookups simple and keeps the whole model JSON-serializable (it round-trips losslessly).
 */
import type { GarmentStyleId, ShapeRole } from './garmentStyle'

export const EDITABLE_GARMENT_FORMAT = 'threados.editable-garment'
export const EDITABLE_GARMENT_VERSION = 1

/** The vocabulary of structural garment components. The exact set used depends on the garment. */
export type RegionType =
  | 'body'
  | 'panel'
  | 'sleeve'
  | 'hood'
  | 'collar'
  | 'pocket'
  | 'button'
  | 'zipper'
  | 'rib'
  | 'waistband'
  | 'cuff'
  | 'label'
  | 'drawstring'
  | 'stitch'
  | 'group'
  | 'other'

export type GarmentViewId = 'front' | 'back'

export type GarmentView = {
  id: GarmentViewId
  label: string
  /** SVG coordinate space; front and back share proportions and are aligned. */
  viewBox: { w: number; h: number }
}

/** One vector primitive belonging to a region, in a specific view's coordinate space. */
export type RegionShape = {
  view: GarmentViewId
  /** SVG path data ('d'). */
  d: string
  /** Role in the flat — the renderer derives paint/stroke from this (see garmentStyle). */
  role: ShapeRole
}

/**
 * FUTURE capability flags. Declaring that a fabric panel is printable while a metal zipper is
 * not is real structure the editor and AI worker use. Milestone 7 does NOT implement any of
 * these behaviours (no color replace, material, texture, embroidery, print) — only the schema.
 */
export type RegionCapabilities = {
  colorReplaceable: boolean
  materialAssignable: boolean
  textureAssignable: boolean
  embroiderable: boolean
  printable: boolean
}

/**
 * Per-region appearance. `fill` is a concrete colour (hex) painted on the region's fabric shapes
 * (fill/detail roles) — construction lines (outline/seam/stitch) stay black so the flat reads as a
 * proper coloured technical flat. The `*Id` fields remain reserved for future material/texture work.
 */
export type RegionAppearance = {
  /** Concrete fabric colour, e.g. '#C0392B'. Undefined → the default tech-flat white. */
  fill?: string
  colorId?: string
  materialId?: string
  textureId?: string
  embroideryId?: string
  printId?: string
}

export type GarmentRegion = {
  id: string
  name: string
  type: RegionType
  /** Child region ids, in draw/hierarchy order. */
  children: string[]
  shapes: RegionShape[]
  /** Editor state — real in Milestone 7. */
  visible: boolean
  locked: boolean
  /** Which future capabilities this region will support. */
  capabilities: RegionCapabilities
  /** Reserved for future milestones; unset today. */
  appearance?: RegionAppearance
  /** The mirrored partner region id (e.g. the other sleeve), when the analysis engine paired them. */
  mirrorOf?: string
}

/** How a garment was produced — honest provenance, never faked. */
export type GarmentSource =
  | { kind: 'reference' }
  | { kind: 'ai'; prompt: string; worker: string; generatedAt: number }
  | { kind: 'import'; from: string }

export type EditableGarment = {
  format: typeof EDITABLE_GARMENT_FORMAT
  version: number
  id: string
  name: string
  category: string
  style: GarmentStyleId
  views: GarmentView[]
  rootIds: string[]
  regions: Record<string, GarmentRegion>
  source: GarmentSource
  createdAt: number
}

/** Sensible future-capability defaults per region type (fabric vs hardware vs thread vs trim). */
export function defaultCapabilities(type: RegionType): RegionCapabilities {
  const fabric = new Set<RegionType>(['body', 'panel', 'sleeve', 'hood', 'collar', 'pocket', 'cuff', 'rib', 'waistband'])
  const hardware = new Set<RegionType>(['button', 'zipper', 'drawstring'])
  if (fabric.has(type)) return { colorReplaceable: true, materialAssignable: true, textureAssignable: true, embroiderable: true, printable: true }
  if (hardware.has(type)) return { colorReplaceable: true, materialAssignable: true, textureAssignable: false, embroiderable: false, printable: false }
  if (type === 'label') return { colorReplaceable: true, materialAssignable: false, textureAssignable: false, embroiderable: true, printable: true }
  if (type === 'stitch') return { colorReplaceable: true, materialAssignable: false, textureAssignable: false, embroiderable: false, printable: false }
  return { colorReplaceable: false, materialAssignable: false, textureAssignable: false, embroiderable: false, printable: false }
}

/** True when the structure is a well-formed editable garment (used at load boundaries). */
export function isEditableGarment(value: unknown): value is EditableGarment {
  if (!value || typeof value !== 'object') return false
  const g = value as Partial<EditableGarment>
  return (
    g.format === EDITABLE_GARMENT_FORMAT &&
    typeof g.id === 'string' &&
    Array.isArray(g.rootIds) &&
    typeof g.regions === 'object' &&
    g.regions !== null &&
    Array.isArray(g.views)
  )
}
