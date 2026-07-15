/* ============================================================
   Image compression for canvas placement.
   Placed images are inlined as data URLs in the localStorage design
   doc — raw phone photos (2–4 MB each as base64) blow the ~5 MB
   origin quota within two or three placements. Downscaling to canvas
   resolution and re-encoding typically shrinks them 10–20× with no
   visible difference at design-studio sizes. PNGs with transparency
   stay PNG (logos/cutouts must keep their alpha); everything else
   becomes JPEG.
   ============================================================ */

const MAX_DIM = 1600
const JPEG_QUALITY = 0.85

function hasAlpha(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  // Sample the alpha channel on a sparse grid — exact enough, and cheap even for large images.
  const step = Math.max(1, Math.floor(Math.min(w, h) / 64))
  const data = ctx.getImageData(0, 0, w, h).data
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      if (data[(y * w + x) * 4 + 3] < 255) return true
    }
  }
  return false
}

/**
 * Read a File as a data URL, downscaled to at most MAX_DIM on the long edge and re-encoded.
 * Falls back to the raw file data URL when decoding fails (e.g. exotic formats) — a failed
 * compression must never block placing the image.
 */
export function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onerror = () => resolve('')
    reader.onload = () => {
      const raw = String(reader.result)
      const img = new Image()
      img.onerror = () => resolve(raw)
      img.onload = () => {
        try {
          const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight))
          const w = Math.max(1, Math.round(img.naturalWidth * scale))
          const h = Math.max(1, Math.round(img.naturalHeight * scale))
          const canvas = document.createElement('canvas')
          canvas.width = w
          canvas.height = h
          const ctx = canvas.getContext('2d')
          if (!ctx) return resolve(raw)
          ctx.drawImage(img, 0, 0, w, h)
          const keepPng = file.type === 'image/png' && hasAlpha(ctx, w, h)
          const out = keepPng ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', JPEG_QUALITY)
          // Re-encoding can inflate small graphics — keep whichever is smaller.
          resolve(out.length < raw.length ? out : raw)
        } catch {
          resolve(raw)
        }
      }
      img.src = raw
    }
    reader.readAsDataURL(file)
  })
}
