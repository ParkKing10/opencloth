/**
 * Render a garment's front view to a self-contained SVG string, for the My-Garments cards.
 * Derived from the same role→style mapping as the editor, so thumbnails are always on-style and
 * never a stored raster. Used as an <img src="data:image/svg+xml,…"> (no dangerouslySetInnerHTML).
 */
import type { EditableGarment } from './editableGarment'
import { flattenRegions, isEffectivelyVisible } from './regionTree'
import { paintForShape } from './garmentStyle'

/**
 * Whitelist a path `d` to only valid SVG path characters. This SVG string is rendered both as an
 * <img src="data:…"> AND (via the M9 bridge) through dangerouslySetInnerHTML, so an unsanitized `d`
 * from a crafted .threados / corrupted storage could break out of the attribute and inject markup.
 * Valid path data never needs quotes or angle brackets, so stripping everything else is lossless.
 */
function safePathD(d: string): string {
  return d.replace(/[^MmLlHhVvCcSsQqTtAaZz0-9.,\-+eE\s]/g, '')
}

/** Only allow a VALID hex colour into the SVG string (same dangerouslySetInnerHTML sink) — else drop it. */
function safeColor(c?: string): string | undefined {
  return c && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(c) ? c : undefined
}

export function garmentThumbnailSvg(garment: EditableGarment): string {
  const view = garment.views[0]?.id ?? 'front'
  const vb = garment.views[0]?.viewBox ?? { w: 400, h: 560 }
  const w = Number.isFinite(vb.w) && vb.w > 0 ? Math.round(vb.w) : 400
  const h = Number.isFinite(vb.h) && vb.h > 0 ? Math.round(vb.h) : 560
  const paths: string[] = []
  for (const { region } of flattenRegions(garment)) {
    if (!isEffectivelyVisible(garment, region.id)) continue
    for (const shape of region.shapes) {
      if (shape.view !== view) continue
      const s = paintForShape(shape.role, safeColor(region.appearance?.fill)) // palette + sanitised hex — safe
      const dash = s.dash ? ` stroke-dasharray="${s.dash}"` : ''
      paths.push(`<path d="${safePathD(shape.d)}" fill="${s.fill}" stroke="${s.stroke}" stroke-width="${s.strokeWidth}" stroke-linejoin="round" stroke-linecap="round"${dash}/>`)
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#f6f6f4"/>${paths.join('')}</svg>`
}

/** As a data URL, ready for <img src>. */
export function garmentThumbnailDataUrl(garment: EditableGarment): string {
  return `data:image/svg+xml,${encodeURIComponent(garmentThumbnailSvg(garment))}`
}
