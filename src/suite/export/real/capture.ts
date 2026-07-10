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
const CHROME_SELECTORS = '.co-frame, .co-handle, .co-rotate-stem, .co-guide, .co-warn, .co-zone'
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
