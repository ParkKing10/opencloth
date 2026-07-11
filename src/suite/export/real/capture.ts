/**
 * Canvas capture — turns the LIVE editor DOM into a PNG. No re-rendering, no synthesis:
 * we clone the actual garment stage (garment art + placed design objects) into an offscreen
 * holder at a neutral transform (so the current zoom/pan and any selection UI never leak into
 * the export), strip editor chrome, then rasterise with html2canvas.
 */
import html2canvas from 'html2canvas'

/** garment+design = the garment with the design on it; design = only the placed artwork. */
export type CaptureScope = 'garment' | 'design'
export type CaptureBackground = 'white' | 'transparent'

export type CaptureOptions = {
  scope: CaptureScope
  background: CaptureBackground
  /** Output resolution multiplier (2 or 4). */
  scale: number
}

const STAGE_SELECTOR = '.ds-garment-3d'
const CHROME_SELECTORS = '.co-frame, .co-handle, .co-rotate-stem, .co-guide, .co-warn, .co-zone, .srl'
const GARMENT_SELECTORS = '.ds-garment-photo, .ds-garment-vector'

/** Capture the current design as a PNG blob per the given options. */
export async function captureDesignPng(opts: CaptureOptions): Promise<Blob> {
  const stage = document.querySelector<HTMLElement>(STAGE_SELECTOR)
  if (!stage) throw new Error('Design canvas not found — open a garment first.')

  const clone = stage.cloneNode(true) as HTMLElement
  clone.querySelectorAll(CHROME_SELECTORS).forEach((n) => n.remove())
  // "design only" hides the garment art (keeps layout/size) so just the artwork renders.
  if (opts.scope === 'design') {
    clone.querySelectorAll<HTMLElement>(GARMENT_SELECTORS).forEach((n) => {
      n.style.visibility = 'hidden'
    })
  }
  clone.style.transform = 'none'

  const holder = document.createElement('div')
  holder.style.cssText = 'position:fixed;left:-100000px;top:0;transform:none;pointer-events:none;z-index:-1;'
  holder.appendChild(clone)
  document.body.appendChild(holder)

  try {
    const canvas = await html2canvas(clone, {
      backgroundColor: opts.background === 'white' ? '#ffffff' : null,
      scale: opts.scale,
      useCORS: true,
      logging: false,
    })
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encode failed'))), 'image/png'),
    )
  } finally {
    holder.remove()
  }
}

/**
 * Capture a small, compact JPEG preview of the current design (garment + artwork) for Recent-Designs
 * cards. Downscaled to `maxSize` on the long edge and JPEG-compressed to keep it tiny (~15–30 KB) so
 * many previews fit in localStorage. Returns null on any failure — a missing preview is non-fatal.
 */
export async function captureDesignThumbnail(maxSize = 512, quality = 0.72): Promise<string | null> {
  try {
    const blob = await captureDesignPng({ scope: 'garment', background: 'white', scale: 1 })
    const bmp = await createImageBitmap(blob)
    const factor = Math.min(1, maxSize / Math.max(bmp.width, bmp.height))
    const w = Math.max(1, Math.round(bmp.width * factor))
    const h = Math.max(1, Math.round(bmp.height * factor))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(bmp, 0, 0, w, h)
    bmp.close?.()
    return canvas.toDataURL('image/jpeg', quality)
  } catch {
    return null
  }
}
