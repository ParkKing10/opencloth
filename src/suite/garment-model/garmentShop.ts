/**
 * The Garment Shop — sells the admin's UPLOADED garments, priced in coins per garment. Buying turns
 * the file-based catalog garment into a fully-editable garment (via the Analysis Engine), files it in
 * the buyer's My-Garments, and deducts their real coin balance. Ownership is remembered per user so a
 * garment is never bought twice.
 */
import type { EditableGarment } from './editableGarment'
import type { Garment } from '../garments/types'
import { loadGarmentDisplay, getGarment } from '../garments/garmentClient'
import { analyzeGarment } from './analysis/analyzeGarment'
import { makeEmptyGarment } from './garmentGeneration'

/**
 * Turn a file-based catalog garment (an admin upload) into an editable garment the Design Studio can
 * work on. Prefers the vector source (SVG/PDF → region analysis); falls back to a named blank garment
 * so a purchase never dead-ends even for a raster-only upload.
 */
export async function buildEditableFromCatalog(garment: Garment): Promise<EditableGarment> {
  const filename = `${garment.slug || garment.name || 'garment'}.svg`
  try {
    const disp = await loadGarmentDisplay(garment.id)
    if (disp.svg) {
      const { garment: editable } = await analyzeGarment({ text: disp.svg, filename }, { name: garment.name, category: garment.category })
      return editable
    }
    // No inline SVG — try a vector/PDF representation's bytes.
    const full = await getGarment(garment.id)
    const rep = (full?.representations ?? []).find((r) => (r.format === 'svg' || r.format === 'pdf') && r.url)
    if (rep?.url) {
      const res = await fetch(rep.url)
      if (res.ok) {
        if (rep.format === 'svg') {
          const { garment: editable } = await analyzeGarment({ text: await res.text(), filename }, { name: garment.name, category: garment.category })
          return editable
        }
        const bytes = new Uint8Array(await res.arrayBuffer())
        const { garment: editable } = await analyzeGarment({ bytes, filename: `${garment.slug || 'garment'}.pdf` }, { name: garment.name, category: garment.category })
        return editable
      }
    }
  } catch {
    /* fall through to a blank editable so the buyer always gets something to design */
  }
  return makeEmptyGarment()
}

// ---- Ownership (per user, local) — which shop garments the user already bought. ----
const ownedKey = (userId: string) => `threados-shop-owned-${userId}`

/** Map of catalog garmentId → the editable garment id it created in the user's library. */
export function readOwned(userId: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(ownedKey(userId))
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

export function markOwned(userId: string, garmentId: string, editableId: string): void {
  try {
    const map = readOwned(userId)
    map[garmentId] = editableId
    localStorage.setItem(ownedKey(userId), JSON.stringify(map))
  } catch {
    /* non-fatal — the garment still exists in the library */
  }
}
