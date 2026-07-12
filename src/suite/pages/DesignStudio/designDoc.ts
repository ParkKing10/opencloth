/**
 * Per-garment design document persistence.
 *
 * A Design belongs to a garment blank: opening a garment loads its saved document
 * (layers + visibility + name), or starts a fresh empty one. Documents are stored in
 * localStorage keyed by garment id so a page reload restores your work. localStorage has a
 * ~5 MB per-origin budget, so a very heavy design (many placed images across several versions)
 * CAN exceed it — `saveDoc` returns false in that case and the editor surfaces it honestly instead
 * of pretending the save succeeded. (Cross-device sync + large-image offloading via Supabase is the
 * eventual fix; the design metadata row already syncs, this stores the editable canvas itself.)
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

/**
 * A saved VERSION of the design — an independent editable board (its own layers + garment-region
 * overrides) under the same garment, so a user can keep e.g. three variations of one hoodie in one
 * file. The persisted shape mirrors the editor's snapshot plus an id + display name.
 */
export type DesignVersionDoc = {
  id: string
  name: string
  layers: Layer[]
  hidden: Record<string, boolean>
  regionHidden?: Record<string, boolean>
  regionFills?: Record<string, string>
  regionNames?: Record<string, string>
  regionLocked?: Record<string, boolean>
  regionTransforms?: Record<string, { dx: number; dy: number }>
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
  /** AI-edited garment image (data URL) that overrides the garment backdrop, when applied. */
  garmentEdit?: string
  /** AI-generated neck label (data URL) — the garment's woven care/brand tag, shown as a third view. */
  neckLabel?: string
  /** Multiple versions/boards of this design. When present, `layers`/`hidden` above mirror the
   *  active version (kept for backward-compatible loading by older code paths). */
  versions?: DesignVersionDoc[]
  activeVersionId?: string
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

/** Persist a garment's document. Returns false on quota overflow so callers can warn the user
 *  instead of silently losing work (never throws — the app stays responsive). */
export function saveDoc(garmentId: string, doc: DesignDoc): boolean {
  try {
    localStorage.setItem(DOC_PREFIX + garmentId, JSON.stringify(doc))
    return true
  } catch {
    return false
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
