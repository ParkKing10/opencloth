/**
 * Local persistence for editable garments. Proves the format is genuine structured data:
 * it round-trips losslessly through JSON (a flat image never could). Keyed per garment id.
 */
import { isEditableGarment, type EditableGarment } from './editableGarment'

const KEY_PREFIX = 'threados-garment-'

export function saveGarment(garment: EditableGarment): void {
  try {
    localStorage.setItem(KEY_PREFIX + garment.id, JSON.stringify(garment))
  } catch {
    /* quota or serialization issue — non-fatal for the foundation */
  }
}

export function loadGarment(id: string): EditableGarment | null {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + id)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isEditableGarment(parsed) ? parsed : null
  } catch {
    return null
  }
}
