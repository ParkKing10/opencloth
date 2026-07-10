/**
 * The built-in editable template catalog (GARMENT_TEMPLATES — the 90+ TemplateSpec pieces) exposed
 * as Garment Library entries. Every template becomes a PUBLISHED catalog garment with an inline SVG
 * thumbnail + a real editable-vector display, so the Garment Library AND the Design Studio catalog
 * are populated straight from the templates — no upload, works with or without Supabase.
 */
import { GARMENT_TEMPLATES, type GarmentTemplate } from '../garment-model/garmentTemplates'
import { garmentThumbnailSvg, garmentThumbnailDataUrl } from '../garment-model/garmentThumbnail'
import type { Garment, GarmentCategoryId } from './types'

const BUILTIN_PREFIX = 'builtin-'
export const isBuiltinGarmentId = (id: string): boolean => id.startsWith(BUILTIN_PREFIX)
/** The underlying template id ('tpl-…') behind a built-in garment id ('builtin-tpl-…'). */
export const builtinTemplateId = (id: string): string => id.slice(BUILTIN_PREFIX.length)

/** Map a template to the closest Garment Library category (drives filter chips + studio filter). */
function libCategory(t: GarmentTemplate): GarmentCategoryId {
  const n = t.name.toLowerCase()
  if (/\bhood/.test(n)) return 'hoodie'
  if (/sweatshirt|sweater|crewneck|cardigan|knit|turtleneck|coatigan/.test(n)) return 'knitwear'
  if (/bomber|varsity/.test(n)) return 'bomber'
  if (/blazer/.test(n)) return 'blazer'
  if (/coat|parka|trench|overcoat|cape|duffle|anorak|windbreaker|puffer|jacket|gilet|biker|shearling|balmacaan|ulster/.test(n)) return 'jacket'
  if (/dress|gown/.test(n)) return 'dress'
  if (/skirt/.test(n)) return 'skirt'
  if (/short/.test(n)) return 'shorts'
  if (/pant|trouser|cargo|chino|jogger|legging|jean|culotte|wide-leg/.test(n)) return 'pants'
  if (/cap|beanie|\bhat/.test(n)) return 'cap'
  if (/necklace|ring|earring|bracelet|watch|choker|pendant|bag|belt|scarf|sunglass|backpack|tote/.test(n)) return 'accessory'
  if (/t-?shirt|tee|polo|tank|henley|camisole|blouse|tube|\btop|bodysuit/.test(n)) return 'tee'
  return 'other'
}

function toGarment(t: GarmentTemplate): Garment {
  return {
    id: BUILTIN_PREFIX + t.id,
    name: t.name,
    slug: t.id.replace(/^tpl-/, ''),
    category: libCategory(t),
    status: 'published',
    vendor: 'THREADOS Catalog',
    tags: [t.category],
    thumbUrl: garmentThumbnailDataUrl(t.make()),
    createdAt: 0,
    views: { front: true, back: true, combinedFrontBack: false, side: false, details: false, has3D: false },
  }
}

let cache: Garment[] | null = null

/** All built-in templates as catalog garments (cached — thumbnails are built once). */
export function builtinGarments(): Garment[] {
  if (!cache) cache = GARMENT_TEMPLATES.map(toGarment)
  return cache
}

/** The editable-vector SVG for a built-in garment id, for the Design Studio canvas. */
export function builtinGarmentDisplaySvg(id: string): string | null {
  const templateId = id.slice(BUILTIN_PREFIX.length)
  const t = GARMENT_TEMPLATES.find((x) => x.id === templateId)
  return t ? garmentThumbnailSvg(t.make()) : null
}
