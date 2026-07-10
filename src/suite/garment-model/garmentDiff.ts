/**
 * Structural diff between two garments — which regions were added, removed, or modified.
 * Used to highlight exactly what an AI edit touched (and to verify edits stay region-scoped).
 */
import type { EditableGarment } from './editableGarment'

export type GarmentDiff = {
  added: string[]
  removed: string[]
  modified: string[]
  /** Every region id that differs — the honest "what changed" set. */
  changed: string[]
}

export function diffGarments(before: EditableGarment, after: EditableGarment): GarmentDiff {
  const beforeIds = new Set(Object.keys(before.regions))
  const afterIds = new Set(Object.keys(after.regions))

  const added = [...afterIds].filter((id) => !beforeIds.has(id))
  const removed = [...beforeIds].filter((id) => !afterIds.has(id))
  const modified = [...afterIds].filter((id) => {
    if (!beforeIds.has(id)) return false
    return JSON.stringify(before.regions[id]) !== JSON.stringify(after.regions[id])
  })

  return { added, removed, modified, changed: [...added, ...removed, ...modified] }
}
