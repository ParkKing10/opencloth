/**
 * Preview generation — produces a uniform PNG thumbnail for a garment from the
 * best available source file. Rasters/SVG draw directly; .ai/.pdf render via
 * pdf.js (lazy-loaded); anything unrenderable falls back to a branded placeholder.
 * Always resolves to a Blob — never throws.
 */
import type { ExtractedFile, GarmentCategoryId } from '../types'
import { classifyExt } from './detect'
import { categoryLabel } from '../types'

const THUMB_W = 720
const THUMB_H = 900
const PAD = 0.08

type Fit = { dx: number; dy: number; dw: number; dh: number }

function containFit(sw: number, sh: number): Fit {
  const availW = THUMB_W * (1 - PAD * 2)
  const availH = THUMB_H * (1 - PAD * 2)
  const scale = Math.min(availW / sw, availH / sh)
  const dw = sw * scale
  const dh = sh * scale
  return { dx: (THUMB_W - dw) / 2, dy: (THUMB_H - dh) / 2, dw, dh }
}

function newCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = THUMB_W
  c.height = THUMB_H
  return c
}

function paintBackground(ctx: CanvasRenderingContext2D): void {
  // light card so dark technical flats stay readable on either theme
  ctx.fillStyle = '#f5f5f7'
  ctx.fillRect(0, 0, THUMB_W, THUMB_H)
}

function toPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png', 0.92)
  })
}

/**
 * Erase a maker's stamp / brand mark sitting BELOW the garment in a rendered preview — the raster twin
 * of the vector denoise step, so thumbnails never show the stamp either. Finds the garment's main
 * inked band and clears anything in a separate band beneath it (the gap + the stamp). No-op when
 * there's no clearly separated bottom band.
 */
function stripBottomStamp(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const { data } = ctx.getImageData(0, 0, THUMB_W, THUMB_H)
  const rowInk = new Array<number>(THUMB_H).fill(0)
  for (let y = 0; y < THUMB_H; y++) {
    let n = 0
    const row = y * THUMB_W * 4
    for (let x = 0; x < THUMB_W; x++) if (data[row + x * 4 + 3] > 30) n++ // opaque pixel = content
    rowInk[y] = n
  }
  const minInk = Math.max(2, Math.round(THUMB_W * 0.012))
  const bands: Array<{ s: number; e: number }> = []
  let s = -1
  for (let y = 0; y < THUMB_H; y++) {
    if (rowInk[y] >= minInk) { if (s < 0) s = y }
    else if (s >= 0) { bands.push({ s, e: y - 1 }); s = -1 }
  }
  if (s >= 0) bands.push({ s, e: THUMB_H - 1 })
  if (bands.length < 2) return // nothing clearly separated below the garment
  const main = bands.reduce((a, b) => (b.e - b.s > a.e - a.s ? b : a))
  if (main.e < THUMB_H - 1) ctx.clearRect(0, main.e + 1, THUMB_W, THUMB_H - main.e - 1)
}

const CATEGORY_TINT: Record<GarmentCategoryId, string> = {
  hoodie: '#6366f1',
  tee: '#0ea5e9',
  sweatshirt: '#8b5cf6',
  pants: '#f59e0b',
  shorts: '#f97316',
  jacket: '#10b981',
  bomber: '#14b8a6',
  blazer: '#64748b',
  cap: '#ec4899',
  dress: '#e11d48',
  skirt: '#d946ef',
  knitwear: '#a16207',
  accessory: '#0891b2',
  other: '#94a3b8',
}

function placeholder(name: string, category: GarmentCategoryId): Promise<Blob> {
  const canvas = newCanvas()
  const ctx = canvas.getContext('2d')!
  paintBackground(ctx)
  const tint = CATEGORY_TINT[category] ?? CATEGORY_TINT.other
  // soft category-tinted panel
  ctx.fillStyle = tint + '22'
  ctx.fillRect(THUMB_W * 0.12, THUMB_H * 0.14, THUMB_W * 0.76, THUMB_H * 0.62)
  ctx.strokeStyle = tint + '55'
  ctx.lineWidth = 2
  ctx.strokeRect(THUMB_W * 0.12, THUMB_H * 0.14, THUMB_W * 0.76, THUMB_H * 0.62)
  // category label
  ctx.fillStyle = tint
  ctx.font = '600 30px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(categoryLabel(category).toUpperCase(), THUMB_W / 2, THUMB_H * 0.46)
  // name
  ctx.fillStyle = '#14141a'
  ctx.font = '700 34px system-ui, sans-serif'
  const words = name.split(' ')
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    if ((line + ' ' + w).trim().length > 18) {
      lines.push(line.trim())
      line = w
    } else line = (line + ' ' + w).trim()
  }
  if (line) lines.push(line.trim())
  lines.slice(0, 2).forEach((l, i) => ctx.fillText(l, THUMB_W / 2, THUMB_H * 0.84 + i * 40))
  return toPng(canvas)
}

async function fromRaster(blob: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(blob)
  const canvas = newCanvas()
  const ctx = canvas.getContext('2d')!
  // no background fill — preserve the source PNG/WEBP transparency
  const fit = containFit(bmp.width, bmp.height)
  ctx.drawImage(bmp, fit.dx, fit.dy, fit.dw, fit.dh)
  bmp.close()
  stripBottomStamp(canvas)
  return toPng(canvas)
}

function fromSvg(blob: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      try {
        const sw = img.naturalWidth || 512
        const sh = img.naturalHeight || 512
        const canvas = newCanvas()
        const ctx = canvas.getContext('2d')!
        // no background fill — preserve the source SVG transparency
        const fit = containFit(sw, sh)
        ctx.drawImage(img, fit.dx, fit.dy, fit.dw, fit.dh)
        URL.revokeObjectURL(url)
        stripBottomStamp(canvas)
        toPng(canvas).then(resolve, reject)
      } catch (err) {
        URL.revokeObjectURL(url)
        reject(err)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('svg decode failed'))
    }
    img.src = url
  })
}

let pdfReady: Promise<typeof import('pdfjs-dist')> | null = null
/** Lazily load pdf.js + its worker once. Shared by the preview rasterizer and the vector reader. */
export function loadPdfjs(): Promise<typeof import('pdfjs-dist')> {
  if (!pdfReady) {
    pdfReady = (async () => {
      const pdfjs = await import('pdfjs-dist')
      const workerUrl = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl.default
      return pdfjs
    })()
  }
  return pdfReady
}

async function fromPdf(blob: Blob): Promise<Blob> {
  const pdfjs = await loadPdfjs()
  const data = new Uint8Array(await blob.arrayBuffer())
  const doc = await pdfjs.getDocument({ data }).promise
  const page = await doc.getPage(1)
  const base = page.getViewport({ scale: 1 })
  const scale = Math.min(1400 / base.width, 1400 / base.height, 4)
  const viewport = page.getViewport({ scale })
  const render = document.createElement('canvas')
  render.width = Math.ceil(viewport.width)
  render.height = Math.ceil(viewport.height)
  const rctx = render.getContext('2d')!
  // render on a transparent surface so a flat with no page fill stays transparent
  await page.render({ canvasContext: rctx, viewport }).promise
  doc.destroy()
  const canvas = newCanvas()
  const ctx = canvas.getContext('2d')!
  const fit = containFit(render.width, render.height)
  ctx.drawImage(render, fit.dx, fit.dy, fit.dw, fit.dh)
  stripBottomStamp(canvas)
  return toPng(canvas)
}

/**
 * Generate a thumbnail for a garment. Tries the chosen source file; on any
 * failure (or no source) returns a branded placeholder. Never rejects.
 */
export async function generatePreview(
  source: ExtractedFile | null,
  label: { name: string; category: GarmentCategoryId },
): Promise<Blob> {
  if (source) {
    const cls = classifyExt(source.ext)
    try {
      if (cls === 'raster') return await fromRaster(source.blob)
      if (cls === 'vector') return await fromSvg(source.blob)
      if (cls === 'document') return await fromPdf(source.blob)
    } catch {
      /* fall through to placeholder */
    }
  }
  return placeholder(label.name, label.category)
}
