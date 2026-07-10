/**
 * Low-level immutable structural edits used by the AI garment editor. Every operation returns
 * a NEW garment and preserves what it does not touch — region IDs, hierarchy, and layer order —
 * which is exactly what the AI worker must guarantee (edit only the required regions).
 */
import type { EditableGarment, GarmentRegion, RegionShape } from './editableGarment'

/** Remove regions (and their descendants), then drop any group left empty by the removal. */
export function removeRegions(garment: EditableGarment, ids: Set<string>): { garment: EditableGarment; removed: string[] } {
  const removed = new Set<string>()

  // Expand to descendants so a removed group takes its children with it.
  const expand = (id: string) => {
    if (removed.has(id)) return
    const region = garment.regions[id]
    if (!region) return
    removed.add(id)
    region.children.forEach(expand)
  }
  ids.forEach(expand)

  // Cascade to a fixpoint on the ORIGINAL structure: a group all of whose children are being
  // removed is itself removed. Done before building the result so no created object is mutated.
  let changed = true
  while (changed) {
    changed = false
    for (const [id, region] of Object.entries(garment.regions)) {
      if (removed.has(id)) continue
      if (region.type === 'group' && region.children.length > 0 && region.children.every((c) => removed.has(c))) {
        removed.add(id)
        changed = true
      }
    }
  }

  // Build the surviving map once, immutably.
  const regions: Record<string, GarmentRegion> = {}
  for (const [id, region] of Object.entries(garment.regions)) {
    if (removed.has(id)) continue
    regions[id] = { ...region, children: region.children.filter((c) => !removed.has(c)) }
  }
  const rootIds = garment.rootIds.filter((id) => !removed.has(id))
  return { garment: { ...garment, rootIds, regions }, removed: [...removed] }
}

/** Append a new top-level region, preserving all existing regions and their order. */
export function addRootRegion(garment: EditableGarment, region: GarmentRegion): EditableGarment {
  return {
    ...garment,
    rootIds: [...garment.rootIds, region.id],
    regions: { ...garment.regions, [region.id]: region },
  }
}

/** Replace a region's shapes wholesale (same id/children/state). No-op if the region is missing. */
export function replaceShapes(garment: EditableGarment, id: string, shapes: RegionShape[]): EditableGarment {
  const region = garment.regions[id]
  if (!region) return garment
  return { ...garment, regions: { ...garment.regions, [id]: { ...region, shapes } } }
}

/**
 * Map a region's shapes through `fn`. If `fn` returns null for a shape (path not transformable),
 * that shape is kept unchanged. Returns whether anything actually changed.
 */
export function mapRegionShapes(
  garment: EditableGarment,
  id: string,
  fn: (shape: RegionShape) => RegionShape | null,
): { garment: EditableGarment; changed: boolean } {
  const region = garment.regions[id]
  if (!region) return { garment, changed: false }
  let changed = false
  const shapes = region.shapes.map((s) => {
    const next = fn(s)
    if (next && next.d !== s.d) {
      changed = true
      return next
    }
    return s
  })
  if (!changed) return { garment, changed: false }
  return { garment: { ...garment, regions: { ...garment.regions, [id]: { ...region, shapes } } }, changed: true }
}
