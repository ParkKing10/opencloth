/**
 * The Garment Shop — THREADOS's premium editable-garment library, priced in coins. Buying a garment
 * deducts the coins from the user (real, persisted balance) and files a fully-editable copy in the
 * user's My-Garments collection. Ownership is remembered per user so a garment is never bought twice.
 */
import { GARMENT_TEMPLATES, type GarmentTemplate } from './garmentTemplates'

export type ShopItem = {
  templateId: string
  name: string
  category: string
  /** Price in coins. */
  price: number
  template: GarmentTemplate
}

/** Coin price by category tier — richer garments cost more. Predictable, never random. */
const TIER: Record<string, number> = {
  Accessories: 15,
  Jewellery: 15,
  Tops: 30,
  Bottoms: 30,
  Dresses: 45,
  'One-Piece': 45,
  Outerwear: 60,
  Coats: 80,
}

export function shopPrice(category: string): number {
  return TIER[category] ?? 40
}

/** The full shop catalogue — every built-in template offered as a premium garment. */
export const SHOP_ITEMS: ShopItem[] = GARMENT_TEMPLATES.map((t) => ({
  templateId: t.id,
  name: t.name,
  category: t.category,
  price: shopPrice(t.category),
  template: t,
}))

export const SHOP_CATEGORIES = ['All', ...Array.from(new Set(SHOP_ITEMS.map((i) => i.category)))]

// ---- Ownership (per user, local) — which shop garments the user already bought. ----
const ownedKey = (userId: string) => `threados-shop-owned-${userId}`

/** Map of templateId → the garment id it created in the user's library. */
export function readOwned(userId: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(ownedKey(userId))
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

export function markOwned(userId: string, templateId: string, garmentId: string): void {
  try {
    const map = readOwned(userId)
    map[templateId] = garmentId
    localStorage.setItem(ownedKey(userId), JSON.stringify(map))
  } catch {
    /* non-fatal — the garment still exists in the library */
  }
}
