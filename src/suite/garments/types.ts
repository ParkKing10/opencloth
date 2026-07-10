/**
 * Garment Library domain model (Milestone 1).
 * camelCase mirror of the snake_case garment_* tables in supabase/schema.sql.
 * A Garment is the catalog-facing identity (PRD-1 template payload); its files
 * are Representations (PRD-2 Principle B).
 */

export type GarmentCategoryId =
  | 'hoodie'
  | 'tee'
  | 'sweatshirt'
  | 'pants'
  | 'shorts'
  | 'jacket'
  | 'bomber'
  | 'blazer'
  | 'cap'
  | 'dress'
  | 'skirt'
  | 'knitwear'
  | 'accessory'
  | 'other'

export type GarmentCategory = { id: GarmentCategoryId; label: string; sort: number }

/** Mirrors the garment_categories seed — used for pickers + label lookup without a round-trip. */
export const CATEGORIES: readonly GarmentCategory[] = [
  { id: 'hoodie', label: 'Hoodie', sort: 1 },
  { id: 'tee', label: 'T-Shirt', sort: 2 },
  { id: 'sweatshirt', label: 'Sweatshirt', sort: 3 },
  { id: 'pants', label: 'Pants', sort: 4 },
  { id: 'shorts', label: 'Shorts', sort: 5 },
  { id: 'jacket', label: 'Jacket', sort: 6 },
  { id: 'bomber', label: 'Bomber', sort: 7 },
  { id: 'blazer', label: 'Blazer', sort: 8 },
  { id: 'cap', label: 'Cap / Hat', sort: 9 },
  { id: 'dress', label: 'Dress', sort: 10 },
  { id: 'skirt', label: 'Skirt', sort: 11 },
  { id: 'knitwear', label: 'Knitwear', sort: 12 },
  { id: 'accessory', label: 'Accessory', sort: 13 },
  { id: 'other', label: 'Other', sort: 99 },
]

const LABEL_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c.label]))
export const categoryLabel = (id: GarmentCategoryId): string => LABEL_BY_ID.get(id) ?? 'Other'

export type RepresentationKind = 'master' | 'preview' | 'thumbnail' | 'source' | 'export' | 'combined_front_back' | 'model3d'

/** Which real views a garment actually has — drives the studio's dynamic tabs. No fakes. */
export type GarmentViews = {
  /** A separate, standalone front view exists. */
  front: boolean
  /** A separate, standalone back view exists. */
  back: boolean
  /** A single image shows front + back together (the typical technical flat). */
  combinedFrontBack: boolean
  side: boolean
  details: boolean
  /** A real 3D file (.glb/.gltf/.obj/.fbx) exists. */
  has3D: boolean
}

export const EMPTY_VIEWS: GarmentViews = {
  front: false,
  back: false,
  combinedFrontBack: false,
  side: false,
  details: false,
  has3D: false,
}

export type HealthStatus = 'ready' | 'warning' | 'incomplete'

/** Import-quality signal shown to the admin before publishing. */
export type GarmentHealth = { status: HealthStatus; issues: string[] }

export type GarmentRepresentation = {
  id: string
  kind: RepresentationKind
  format: string
  storagePath: string
  bytes: number
  /** Signed/object URL, resolved lazily for display. */
  url?: string
}

export type GarmentStatus = 'draft' | 'published' | 'archived'

/** A catalog garment. */
export type Garment = {
  id: string
  name: string
  slug: string
  category: GarmentCategoryId
  status: GarmentStatus
  vendor: string
  tags: string[]
  /** Signed/object URL for the thumbnail (empty if none). */
  thumbUrl: string
  createdAt: number
  views: GarmentViews
  representations?: GarmentRepresentation[]
}

// ---------- import pipeline ----------

/** One file pulled out of an uploaded archive. */
export type ExtractedFile = {
  /** Full path within the archive, e.g. "Oversized Hoodie/front.ai". */
  path: string
  /** Basename, e.g. "front.ai". */
  name: string
  /** Lowercased extension without the dot, e.g. "ai". */
  ext: string
  bytes: number
  blob: Blob
}

/** A garment detected from an archive, awaiting admin confirmation before publish. */
export type DetectedGarment = {
  /** Client-only id for list keys before the DB assigns a real one. */
  tempId: string
  name: string
  category: GarmentCategoryId
  files: ExtractedFile[]
  /** Generated preview thumbnail (PNG blob). */
  previewBlob: Blob | null
  /** Object URL for showing the preview in the review UI. */
  previewUrl: string
  /** Real views detected from the garment's files (drives the studio tabs). */
  views: GarmentViews
  /** Import-quality signal for the review UI. */
  health: GarmentHealth
  /** Whether the admin included this garment in the publish. */
  include: boolean
}

export type ImportStage = 'extract' | 'detect' | 'preview' | 'done' | 'error'

export type ImportProgress = {
  stage: ImportStage
  message: string
  /** 0..1 */
  pct: number
}

/** A single result envelope used across the garment client (mirrors driveClient). */
export type GarmentResult<T> = { ok: true; value: T } | { ok: false; error: string }
