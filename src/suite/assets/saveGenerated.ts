/**
 * Auto-save AI generations into the user's Asset Library (IndexedDB). Every image loom studios AI
 * produces — graphics, garment edits, campaign photos — lands here automatically so the user never
 * loses a creation. Reuses analyzeFile for real dimensions + a fast grid thumbnail, and emits
 * ASSETS_CHANGED_EVENT so an open Assets panel refreshes live.
 */
import { analyzeFile } from './assetThumb'
import { ASSETS_CHANGED_EVENT, putAsset, type Asset } from './assetStore'

export type GeneratedCategory = 'ai-graphic' | 'garment-edit' | 'campaign'

type SaveParams = {
  userId: string
  /** Data URL (PNG/SVG) of the generated image. */
  dataUrl: string
  /** Human label, without extension. */
  name: string
  category: GeneratedCategory
  favorite?: boolean
}

/**
 * Persist a generated image as a library asset. Fire-and-forget safe: returns the asset, or null on
 * any failure (a missing library entry must never break generation). No-op without a signed-in user.
 */
export async function saveGeneratedAsset(params: SaveParams): Promise<Asset | null> {
  const { userId, dataUrl, name, category, favorite = false } = params
  if (!userId || !dataUrl) return null
  try {
    const blob = await fetch(dataUrl).then((r) => r.blob())
    const isSvg = blob.type.includes('svg') || dataUrl.startsWith('data:image/svg')
    const ext = isSvg ? 'svg' : 'png'
    const filename = `${name}.${ext}`
    const file = new File([blob], filename, { type: blob.type || (isSvg ? 'image/svg+xml' : 'image/png') })
    const meta = await analyzeFile(file)
    const now = Date.now()
    const asset: Asset = {
      id: crypto.randomUUID(),
      userId,
      filename,
      type: meta.type,
      kind: meta.kind,
      category,
      width: meta.width,
      height: meta.height,
      size: blob.size,
      createdAt: now,
      lastUsedAt: now,
      favorite,
      blob,
      thumb: meta.thumb,
    }
    await putAsset(asset)
    try {
      window.dispatchEvent(new Event(ASSETS_CHANGED_EVENT))
    } catch {
      /* non-DOM env — ignore */
    }
    return asset
  } catch {
    return null
  }
}
