import type { GraphicRef, ManufacturingProject } from '../types'
import { canvasToPngBlob, drawGarment, drawPlacement, makeCanvas } from './canvasKit'

export type PrintView = 'front' | 'back' | 'sleeves'

// 1500 × 1950 px, A-series proportion. At ~127mm (A5 width) that is 300 DPI —
// print-grade for a placement guide, while staying fast to PNG-encode.
const W = 1500
const H = 1950

/** Which graphics belong on which print sheet. */
function graphicsForView(p: ManufacturingProject, view: PrintView): GraphicRef[] {
  return p.graphics.filter((g) => {
    const place = g.placement.toLowerCase()
    if (view === 'front') return place.includes('front') || place.includes('chest')
    if (view === 'back') return place.includes('back')
    return place.includes('sleeve')
  })
}

/** Normalized placement box (0..1) for a graphic, by placement name. */
function placementBox(g: GraphicRef): { x: number; y: number; w: number; h: number } {
  const place = g.placement.toLowerCase()
  // width/height scaled from real cm so proportions read true (garment ~60cm wide)
  const gw = Math.min(0.44, g.widthCm / 70)
  const gh = Math.min(0.5, g.heightCm / 90)
  if (place.includes('left chest')) return { x: 0.58, y: 0.26, w: gw, h: gh }
  if (place.includes('front')) return { x: 0.5 - gw / 2, y: 0.34, w: gw, h: gh }
  if (place.includes('upper back') || place.includes('back')) return { x: 0.5 - gw / 2, y: 0.26, w: gw, h: gh }
  if (place.includes('sleeve')) return { x: 0.5 - gw / 2, y: 0.3, w: gw, h: gh }
  return { x: 0.5 - gw / 2, y: 0.32, w: gw, h: gh }
}

/** Generate one transparent, print-grade PNG placement guide for a view. */
export async function generatePrintAsset(p: ManufacturingProject, view: PrintView): Promise<Blob> {
  const canvas = makeCanvas(W, H)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas unavailable')

  // garment silhouette centered, leaving a header strip
  const gBox = { x: W * 0.14, y: H * 0.12, w: W * 0.72, h: H * 0.76 }
  drawGarment(ctx, p.garment.kind, view, gBox, { stroke: '#14141A', lineWidth: W * 0.0035 })

  // header text (part of the file, not chrome)
  ctx.fillStyle = '#14141A'
  ctx.font = `700 ${W * 0.026}px Inter, Arial, sans-serif`
  ctx.textBaseline = 'top'
  ctx.fillText(`${p.meta.styleName.toUpperCase()} — ${view.toUpperCase()}`, W * 0.06, H * 0.05)
  ctx.fillStyle = '#8A8A96'
  ctx.font = `500 ${W * 0.016}px Inter, Arial, sans-serif`
  ctx.fillText(`${p.meta.styleNumber} · placement guide · units cm`, W * 0.06, H * 0.09)

  // placement zones for this view
  const gfx = graphicsForView(p, view)
  gfx.forEach((g) => {
    const nb = placementBox(g)
    const box = {
      x: gBox.x + nb.x * gBox.w,
      y: gBox.y + nb.y * gBox.h,
      w: nb.w * gBox.w,
      h: nb.h * gBox.h,
    }
    drawPlacement(ctx, box, `${g.name}  ${g.widthCm}×${g.heightCm}cm  ${g.technique}`)
  })
  if (gfx.length === 0) {
    ctx.fillStyle = '#8A8A96'
    ctx.font = `500 ${W * 0.02}px Inter, Arial, sans-serif`
    ctx.fillText('No artwork on this view.', W * 0.06, H * 0.9)
  }

  return canvasToPngBlob(canvas)
}

/** The set of print views this garment needs (skips empty sheets). */
export function printViews(p: ManufacturingProject): PrintView[] {
  const all: PrintView[] = ['front', 'back', 'sleeves']
  return all.filter((v) => v !== 'sleeves' || graphicsForView(p, 'sleeves').length > 0)
}
