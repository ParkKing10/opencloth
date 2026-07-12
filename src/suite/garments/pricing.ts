/**
 * Suggested coin price at upload, by library category — richer/heavier garments cost more.
 * The admin can override the value per garment in the import review. Predictable, never random.
 */
import type { GarmentCategoryId } from './types'

const DEFAULT_PRICE_BY_CATEGORY: Record<GarmentCategoryId, number> = {
  accessory: 15,
  cap: 15,
  shorts: 25,
  tee: 30,
  sweatshirt: 30,
  pants: 30,
  skirt: 30,
  knitwear: 35,
  hoodie: 40,
  dress: 45,
  bomber: 55,
  blazer: 60,
  jacket: 60,
  other: 40,
}

/** The default coin price suggested for a freshly detected garment of this category. */
export function defaultGarmentPrice(category: GarmentCategoryId): number {
  return DEFAULT_PRICE_BY_CATEGORY[category] ?? 40
}
