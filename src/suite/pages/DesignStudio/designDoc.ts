/**
 * Per-garment design document persistence.
 *
 * A Design belongs to a garment blank: opening a garment loads its saved document
 * (layers + visibility + name), or starts a fresh empty one. Documents are stored in
 * localStorage keyed by garment id so a page reload always restores the latest work —
 * no data loss. (Cross-device sync via Supabase is a later enhancement; the design
 * metadata row already syncs, this stores the editable canvas itself.)
 */
import type { Layer } from './LayersPanel'

/** A colorway the user records for the product (a name + hex). Not a garment recolor. */
export type SpecColor = { name: string; hex: string }

/**
 * User-provided product specifications. NONE of this is inferred from the garment image —
 * the image is a design surface. Empty by default; the user fills it in (or leaves it for
 * export/tech-pack time). Persisted with the design document.
 */
export type ProductSpecs = {
  material?: string
  fit?: string
  /** Fabric weight, e.g. "320 GSM". */
  weight?: string
  composition?: string
  variant?: string
  colors?: SpecColor[]
  notes?: string
}

/**
 * Project information for manufacturing/export (entered in the Export wizard). Empty by
 * default; the user fills it in. Persisted with the design document, restored on reopen.
 */
export type ProjectInfo = {
  brand?: string
  designer?: string
  collection?: string
  styleNumber?: string
  sku?: string
  season?: string
}

export type DesignDoc = {
  layers: Layer[]
  hidden: Record<string, boolean>
  /** Garment-region overrides (hidden / recoloured / renamed / locked / moved parts) — the design
   *  remembers them. Every map is sparse. regionTransforms is in the garment's SVG viewBox units. */
  regionHidden?: Record<string, boolean>
  regionFills?: Record<string, string>
  regionNames?: Record<string, string>
  regionLocked?: Record<string, boolean>
  regionTransforms?: Record<string, { dx: number; dy: number }>
  designName: string
  collectionId?: string
  specs?: ProductSpecs
  projectInfo?: ProjectInfo
  updatedAt: number
}

const DOC_PREFIX = 'threados-doc-'
const LAST_KEY = 'threados-last-garment'

/** Load the saved document for a garment, or null if none / corrupt. */
export function loadDoc(garmentId: string): DesignDoc | null {
  try {
    const raw = localStorage.getItem(DOC_PREFIX + garmentId)
    if (!raw) return null
    const doc = JSON.parse(raw) as DesignDoc
    if (!doc || !Array.isArray(doc.layers) || typeof doc.hidden !== 'object') return null
    return { ...doc, hidden: doc.hidden ?? {} }
  } catch {
    return null
  }
}

/** Persist a garment's document. Silently drops on quota overflow (many large images). */
export function saveDoc(garmentId: string, doc: DesignDoc): void {
  try {
    localStorage.setItem(DOC_PREFIX + garmentId, JSON.stringify(doc))
  } catch {
    /* quota exceeded — keep the app responsive rather than throwing */
  }
}

/** Remember which garment was last open so a reload reopens the same design. */
export function saveLastGarment(garmentId: string): void {
  try {
    localStorage.setItem(LAST_KEY, garmentId)
  } catch {
    /* ignore */
  }
}

export function loadLastGarment(): string | null {
  try {
    return localStorage.getItem(LAST_KEY)
  } catch {
    return null
  }
}
