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

type Display = { svg?: string; imageUrl?: string }

/** Analyse a garment's vector master into an editable region garment. Returns null when there's no
 *  analysable vector source (a raster-only garment) — the caller treats that as "not usable". */
async function editableFromDisplay(disp: Display, garment: Garment): Promise<EditableGarment | null> {
  const filename = `${garment.slug || garment.name || 'garment'}.svg`
  if (disp.svg) {
    const { garment: editable } = await analyzeGarment({ text: disp.svg, filename }, { name: garment.name, category: garment.category })
    return editable
  }
  // No inline SVG — analyse the master vector file. Illustrator .ai and .pdf are read as bytes
  // (the .ai container is PDF-compatible — the same path the direct My-Garments import uses).
  const full = await getGarment(garment.id)
  const rep = (full?.representations ?? []).find((r) => (r.format === 'svg' || r.format === 'pdf' || r.format === 'ai') && r.url)
  if (!rep?.url) return null
  const res = await fetch(rep.url)
  if (!res.ok) return null
  if (rep.format === 'svg') {
    const { garment: editable } = await analyzeGarment({ text: await res.text(), filename }, { name: garment.name, category: garment.category })
    return editable
  }
  const bytes = new Uint8Array(await res.arrayBuffer())
  const { garment: editable } = await analyzeGarment({ bytes, filename: `${garment.slug || 'garment'}.${rep.format}` }, { name: garment.name, category: garment.category })
  return editable
}

/**
 * Build the editable garment for a purchase. A garment MUST resolve to editable region layers — a
 * flat with no layers is never usable — so this THROWS when the source can't be analysed into regions,
 * and the buyer is told to re-upload a proper vector file. Never returns an empty garment.
 */
export async function buildEditable(garment: Garment): Promise<EditableGarment> {
  const disp = await loadGarmentDisplay(garment.id)
  const editable = await editableFromDisplay(disp, garment).catch(() => null)
  if (!editable || Object.keys(editable.regions ?? {}).length === 0) {
    throw new Error('This garment has no editable layers. Re-upload it as a proper vector file (.ai, .svg or .pdf with real paths).')
  }
  return editable
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
