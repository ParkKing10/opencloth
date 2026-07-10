/**
 * Pure, immutable operations over an EditableGarment's normalized region tree.
 *
 * Selection and highlight are ephemeral EDITOR state (held by the view, not persisted).
 * Visibility, lock and sibling order live in the garment itself so they round-trip with it.
 * Every mutator returns a NEW garment; the input is never touched.
 */
import type { EditableGarment, GarmentRegion } from './editableGarment'

export type FlatRegion = { region: GarmentRegion; depth: number; parentId: string | null }

export function getRegion(garment: EditableGarment, id: string): GarmentRegion | undefined {
  return garment.regions[id]
}

/** Depth-first walk in draw order, annotated with depth + parent for tree rendering. */
export function flattenRegions(garment: EditableGarment): FlatRegion[] {
  const out: FlatRegion[] = []
  const seen = new Set<string>() // guard: a malformed/cyclic tree must never infinite-loop the editor
  const walk = (ids: string[], depth: number, parentId: string | null) => {
    for (const id of ids) {
      const region = garment.regions[id]
      if (!region || seen.has(id)) continue
      seen.add(id)
      out.push({ region, depth, parentId })
      if (region.children.length) walk(region.children, depth + 1, id)
    }
  }
  walk(garment.rootIds, 0, null)
  return out
}

/** The sibling list (parent's children, or rootIds) that contains `id`, plus that parent id. */
function siblingsOf(garment: EditableGarment, id: string): { list: string[]; parentId: string | null } {
  if (garment.rootIds.includes(id)) return { list: garment.rootIds, parentId: null }
  for (const [pid, region] of Object.entries(garment.regions)) {
    if (region.children.includes(id)) return { list: region.children, parentId: pid }
  }
  return { list: [], parentId: null }
}

export function parentOf(garment: EditableGarment, id: string): string | null {
  return siblingsOf(garment, id).parentId
}

function patchRegion(garment: EditableGarment, id: string, patch: Partial<GarmentRegion>): EditableGarment {
  const region = garment.regions[id]
  if (!region) return garment
  return { ...garment, regions: { ...garment.regions, [id]: { ...region, ...patch } } }
}

export function setVisible(garment: EditableGarment, id: string, visible: boolean): EditableGarment {
  return patchRegion(garment, id, { visible })
}

export function toggleVisible(garment: EditableGarment, id: string): EditableGarment {
  const region = garment.regions[id]
  return region ? setVisible(garment, id, !region.visible) : garment
}

export function setLocked(garment: EditableGarment, id: string, locked: boolean): EditableGarment {
  return patchRegion(garment, id, { locked })
}

export function toggleLocked(garment: EditableGarment, id: string): EditableGarment {
  const region = garment.regions[id]
  return region ? setLocked(garment, id, !region.locked) : garment
}

export function rename(garment: EditableGarment, id: string, name: string): EditableGarment {
  const clean = name.trim()
  return clean ? patchRegion(garment, id, { name: clean }) : garment
}

/** Set a region's fabric colour (hex), or clear it (undefined → default tech-flat white). New garment. */
export function setRegionColor(garment: EditableGarment, id: string, hex: string | undefined): EditableGarment {
  const region = garment.regions[id]
  if (!region) return garment
  const appearance = { ...region.appearance }
  if (hex) appearance.fill = hex
  else delete appearance.fill
  return patchRegion(garment, id, { appearance })
}

/**
 * Move a region up (-1) or down (+1) among its siblings. Reorders the containing list only —
 * a region never changes parent. No-op at the ends. Returns a new garment.
 */
export function moveRegion(garment: EditableGarment, id: string, dir: -1 | 1): EditableGarment {
  const { list, parentId } = siblingsOf(garment, id)
  const idx = list.indexOf(id)
  if (idx < 0) return garment
  const target = idx + dir
  if (target < 0 || target >= list.length) return garment
  const next = [...list]
  ;[next[idx], next[target]] = [next[target], next[idx]]
  if (parentId === null) return { ...garment, rootIds: next }
  const parent = garment.regions[parentId]
  return { ...garment, regions: { ...garment.regions, [parentId]: { ...parent, children: next } } }
}

/** True when the region or any of its ancestors is hidden (so the renderer can skip it). */
export function isEffectivelyVisible(garment: EditableGarment, id: string): boolean {
  let cursor: string | null = id
  const guard = new Set<string>()
  while (cursor) {
    if (guard.has(cursor)) break
    guard.add(cursor)
    const region = garment.regions[cursor]
    if (!region || !region.visible) return false
    cursor = parentOf(garment, cursor)
  }
  return true
}
