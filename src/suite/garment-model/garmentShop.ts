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
import { blobToDataUrl } from '../assets/assetThumb'

type Display = { svg?: string; imageUrl?: string }

/** Analyse a garment's vector source into an editable region garment; blank fallback (e.g. raster). */
async function editableFromDisplay(disp: Display, garment: Garment): Promise<EditableGarment> {
  const filename = `${garment.slug || garment.name || 'garment'}.svg`
  try {
    if (disp.svg) {
      const { garment: editable } = await analyzeGarment({ text: disp.svg, filename }, { name: garment.name, category: garment.category })
      return editable
    }
    // No inline SVG — analyse the master vector file. Illustrator .ai and .pdf are read as bytes
    // (the .ai container is PDF-compatible — the same path the direct My-Garments import uses).
    const full = await getGarment(garment.id)
    const rep = (full?.representations ?? []).find((r) => (r.format === 'svg' || r.format === 'pdf' || r.format === 'ai') && r.url)
    if (rep?.url) {
      const res = await fetch(rep.url)
      if (res.ok) {
        if (rep.format === 'svg') {
          const { garment: editable } = await analyzeGarment({ text: await res.text(), filename }, { name: garment.name, category: garment.category })
          return editable
        }
        const bytes = new Uint8Array(await res.arrayBuffer())
        const { garment: editable } = await analyzeGarment({ bytes, filename: `${garment.slug || 'garment'}.${rep.format}` }, { name: garment.name, category: garment.category })
        return editable
      }
    }
  } catch {
    /* fall through to a blank editable so the buyer always gets something to design */
  }
  return makeEmptyGarment()
}

/** The garment's flat as a persistent image data URL — used as the Studio backdrop so the actual
 *  garment shows even when it has no editable region tree (the common case for raster flats). */
async function displayToDataUrl(disp: Display): Promise<string | null> {
  if (disp.svg) return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(disp.svg)}`
  if (disp.imageUrl) {
    try {
      const res = await fetch(disp.imageUrl)
      if (!res.ok) return disp.imageUrl // signed URL may expire, but it displays now
      return await blobToDataUrl(await res.blob())
    } catch {
      return disp.imageUrl
    }
  }
  return null
}

/**
 * Provision a purchased garment: build its editable garment (regions when analysable) AND capture its
 * actual flat as a Studio backdrop image, so the buyer always SEES the real garment — not a blank —
 * and can design on it. Loads the garment's display once and derives both from it.
 */
export async function buildPurchase(garment: Garment): Promise<{ editable: EditableGarment; backdrop: string | null; hasRegions: boolean }> {
  const disp = await loadGarmentDisplay(garment.id)
  const editable = await editableFromDisplay(disp, garment)
  // If the analysis produced a real editable region tree (e.g. from a .ai/.svg master), show THAT —
  // it's recolourable and part-editable, and the buyer should land in the Garment Lab. Only when it's
  // empty (raster with no vector) do we pin the flat as a Design-Studio backdrop so it's still visible.
  const hasRegions = Object.keys(editable.regions ?? {}).length > 0
  const backdrop = hasRegions ? null : await displayToDataUrl(disp)
  return { editable, backdrop, hasRegions }
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
