/**
 * Smart Garment mapping — turn a ClassifiedGarment into a valid EditableGarment that drops straight
 * into the Studio (region tree, layers, inspector, region editing, undo/save all read this shape).
 *
 * Coordinates are normalized so the viewBox starts at 0,0 (garmentThumbnailSvg renders
 * `viewBox="0 0 w h"`); the region tree is built from geometric containment; a single artboard maps
 * to the front view and normalizeGarment/ensureBothViews backfills the back.
 */
import {
  EDITABLE_GARMENT_FORMAT,
  EDITABLE_GARMENT_VERSION,
  defaultCapabilities,
  type EditableGarment,
  type GarmentRegion,
} from '../editableGarment'
import { TECH_FLAT } from '../garmentStyle'
import { translateD } from '../pathTransform'
import type { ClassifiedGarment } from './classify'

export type MapReport = {
  regionCount: number
  lowConfidence: number
  types: Record<string, number>
  /** Learning: set when the engine recognised this garment from a previously-analyzed one. */
  matchedPrior?: boolean
  learnedFrom?: string
}
export type MapResult = { garment: EditableGarment; report: MapReport }

/** Sanitise a source paint into a concrete hex fabric colour, or undefined (default tech-flat white). */
function fabricFill(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const hex = raw.trim().toLowerCase()
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/.test(hex)) return undefined
  // white/near-white reads as "no fill" on a tech flat — leave default.
  if (hex === '#fff' || hex === '#ffffff' || hex === '#fefefe') return undefined
  return hex
}

/**
 * Build an EditableGarment from a classified graph. `id`/`createdAt` are placeholders — createGarment
 * mints the real id and seeds history. Pass through normalizeGarment afterwards (ensureBothViews).
 */
export function mapClassifiedToEditable(cg: ClassifiedGarment, name = 'Imported Garment', category = 'Imported'): MapResult {
  const gb = cg.graph.bounds
  const dx = -gb.minX
  const dy = -gb.minY

  const ids = cg.regions.map((_, i) => `reg-${i}`)
  // The classifier's parentIndex / mirrorIndex are PATH indices; resolve them to region-array
  // indices so the mapping stays correct even if not every path became a region.
  const regionByPath = new Map<number, number>()
  cg.regions.forEach((r, i) => regionByPath.set(r.pathIndex, i))
  const regions: Record<string, GarmentRegion> = {}

  cg.regions.forEach((r, i) => {
    const src = cg.graph.paths[r.pathIndex]
    const d = translateD(src.d, dx, dy)
    const mirrorRegion = r.mirrorIndex != null ? regionByPath.get(r.mirrorIndex) : undefined
    regions[ids[i]] = {
      id: ids[i],
      name: r.name,
      type: r.type,
      children: [],
      shapes: [{ view: 'front', d, role: r.role }],
      visible: true,
      locked: false,
      capabilities: defaultCapabilities(r.type),
      appearance: r.role === 'fill' ? { fill: fabricFill(src.fill) } : undefined,
      // mirrored partner (e.g. the other sleeve), if any — real structure, never faked.
      ...(mirrorRegion != null && ids[mirrorRegion] ? { mirrorOf: ids[mirrorRegion] } : {}),
    }
  })

  // Wire children from parent relationships, preserving draw order (z-index).
  const order = cg.regions.map((r, i) => ({ i, z: cg.graph.paths[r.pathIndex].zIndex })).sort((a, b) => a.z - b.z)
  const rootIds: string[] = []
  for (const { i } of order) {
    const parentPath = cg.regions[i].parentIndex
    const parentRegion = parentPath != null ? regionByPath.get(parentPath) : undefined
    if (parentRegion != null && parentRegion !== i && regions[ids[parentRegion]]) regions[ids[parentRegion]].children.push(ids[i])
    else rootIds.push(ids[i])
  }

  const garment: EditableGarment = {
    format: EDITABLE_GARMENT_FORMAT,
    version: EDITABLE_GARMENT_VERSION,
    id: 'import-pending',
    name,
    category,
    style: TECH_FLAT.id,
    views: [{ id: 'front', label: 'Front', viewBox: { w: Math.max(1, Math.round(gb.w)), h: Math.max(1, Math.round(gb.h)) } }],
    rootIds,
    regions,
    source: { kind: 'import', from: name },
    createdAt: 0,
  }

  return { garment, report: cg.report }
}
