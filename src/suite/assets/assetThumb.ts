/**
 * Read real metadata (dimensions, kind) from an uploaded file and build a grid thumbnail.
 * Raster images get a downscaled PNG thumbnail so the grid stays fast with hundreds of assets;
 * SVGs keep their own bytes as the thumbnail so they render as true vectors (never rasterized).
 */
import type { AssetKind } from './assetStore'

export const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
export const ACCEPTED_EXT = ['png', 'jpg', 'jpeg', 'webp', 'svg']
export const ACCEPT_ATTR = '.png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml'

const THUMB_MAX = 256

export type Analyzed = {
  kind: AssetKind
  type: string
  width: number
  height: number
  thumb: Blob
}

export function isAcceptedFile(file: File): boolean {
  if (ACCEPTED_TYPES.includes(file.type)) return true
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return ACCEPTED_EXT.includes(ext)
}

function isSvg(file: File): boolean {
  return file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not read image'))
    img.src = url
  })
}

/** Parse intrinsic dimensions from SVG markup (width/height or viewBox). */
function svgDimensions(markup: string): { width: number; height: number } {
  const wh = /<svg[^>]*\bwidth="([\d.]+)"[^>]*\bheight="([\d.]+)"/i.exec(markup)
  if (wh) return { width: Math.round(+wh[1]), height: Math.round(+wh[2]) }
  const vb = /viewBox="[\d.\s-]*?([\d.]+)[\s,]+([\d.]+)"/i.exec(markup)
  if (vb) return { width: Math.round(+vb[1]), height: Math.round(+vb[2]) }
  return { width: 300, height: 300 }
}

async function rasterThumb(img: HTMLImageElement): Promise<Blob> {
  const w = img.naturalWidth || 1
  const h = img.naturalHeight || 1
  const scale = Math.min(1, THUMB_MAX / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w * scale))
  canvas.height = Math.max(1, Math.round(h * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
  if (!blob) throw new Error('Thumbnail failed')
  return blob
}

export async function analyzeFile(file: File): Promise<Analyzed> {
  if (isSvg(file)) {
    const markup = await file.text()
    const { width, height } = svgDimensions(markup)
    // The SVG file itself is the thumbnail — stays vector.
    return { kind: 'vector', type: 'image/svg+xml', width, height, thumb: file }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    const thumb = await rasterThumb(img)
    return {
      kind: 'raster',
      type: file.type || 'image/png',
      width: img.naturalWidth || 0,
      height: img.naturalHeight || 0,
      thumb,
    }
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('Read failed'))
    reader.readAsDataURL(blob)
  })
}
