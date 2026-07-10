/**
 * Export a garment from the editor using EXISTING formats (no new formats added in M9):
 * the editable garment as a `.threados` JSON document, and the technical flat as a PNG.
 * Both are exports of the garment itself; the full manufacturing package still lives in the
 * Design Studio's export system.
 */
import type { EditableGarment } from './editableGarment'
import { garmentThumbnailSvg } from './garmentThumbnail'

function slug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'garment'
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Download the editable garment as a `.threados` document (structured vector, never an image). */
export function exportGarmentThreados(garment: EditableGarment): void {
  const doc = { _format: garment.format, _version: garment.version, exportedAt: new Date().toISOString(), garment }
  download(new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }), `${slug(garment.name)}.threados`)
}

/** Render the front-view technical flat to a PNG at `scale`× and download it. */
export async function exportGarmentFlatPng(garment: EditableGarment, scale = 2): Promise<void> {
  const svg = garmentThumbnailSvg(garment)
  const vb = garment.views[0]?.viewBox ?? { w: 400, h: 560 }
  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Could not render the garment flat'))
    img.src = `data:image/svg+xml,${encodeURIComponent(svg)}`
  })
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(vb.w * scale)
  canvas.height = Math.round(vb.h * scale)
  if (canvas.width <= 0 || canvas.height <= 0) throw new Error('Invalid garment dimensions')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
  if (!blob) throw new Error('PNG export failed')
  download(blob, `${slug(garment.name)}-flat.png`)
}
