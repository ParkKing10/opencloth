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
  const parentRegionOf = (i: number): number | undefined => {
    const pp = cg.regions[i].parentIndex
    return pp != null ? regionByPath.get(pp) : undefined
  }

  // FOLD construction detail into its part: a seam/stitch line sitting on a fabric region becomes
  // an extra shape ON that region, not its own layer. This is what stops a real coat from arriving
  // as dozens of junk seam layers under the body — they belong to the body.
  const foldInto = new Map<number, number>() // region index → parent region index it folds into
  cg.regions.forEach((r, i) => {
    if (r.type !== 'stitch') return
    const parent = parentRegionOf(i)
    if (parent != null && parent !== i && cg.regions[parent].type !== 'stitch') foldInto.set(i, parent)
  })
  const kept = cg.regions.map((_, i) => !foldInto.has(i))

  const regions: Record<string, GarmentRegion> = {}
  cg.regions.forEach((r, i) => {
    if (!kept[i]) return
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
      ...(mirrorRegion != null && kept[mirrorRegion] && ids[mirrorRegion] ? { mirrorOf: ids[mirrorRegion] } : {}),
    }
  })

  // Append each folded seam/stitch as an extra shape on its parent region.
  cg.regions.forEach((r, i) => {
    const target = foldInto.get(i)
    if (target == null || !regions[ids[target]]) return
    const src = cg.graph.paths[r.pathIndex]
    regions[ids[target]].shapes.push({ view: 'front', d: translateD(src.d, dx, dy), role: r.role })
  })

  // Wire children among KEPT regions only, preserving draw order (z-index).
  const order = cg.regions.map((r, i) => ({ i, z: cg.graph.paths[r.pathIndex].zIndex })).sort((a, b) => a.z - b.z)
  const rootIds: string[] = []
  for (const { i } of order) {
    if (!kept[i]) continue
    const parentRegion = parentRegionOf(i)
    if (parentRegion != null && parentRegion !== i && kept[parentRegion] && regions[ids[parentRegion]]) regions[ids[parentRegion]].children.push(ids[i])
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

  // Report the real layer count the user will see (after folding), plus the detected type mix.
  const keptTypes: Record<string, number> = {}
  cg.regions.forEach((r, i) => {
    if (kept[i]) keptTypes[r.type] = (keptTypes[r.type] ?? 0) + 1
  })
  return {
    garment,
    report: { regionCount: Object.keys(regions).length, lowConfidence: cg.report.lowConfidence, types: keptTypes },
  }
}
