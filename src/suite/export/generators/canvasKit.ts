import type { GarmentKind } from '../types'

export type RenderOpts = {
  /** Fill the garment body with this color (product render). Omit for a line flat. */
  fill?: string
  /** Outline stroke color. */
  stroke?: string
  lineWidth?: number
}

/**
 * Draw a garment silhouette into the rectangle (x, y, w, h) on a 2D canvas.
 * Coordinates are normalized 0..1 inside the box, so the same shapes scale to any
 * resolution (used for both 300-DPI print assets and on-screen renders).
 */
export function drawGarment(
  ctx: CanvasRenderingContext2D,
  kind: GarmentKind,
  view: 'front' | 'back' | 'sleeves',
  box: { x: number; y: number; w: number; h: number },
  opts: RenderOpts = {},
) {
  const stroke = opts.stroke ?? '#14141A'
  const lw = opts.lineWidth ?? Math.max(2, box.w * 0.006)
  ctx.save()
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.strokeStyle = stroke
  ctx.lineWidth = lw
  const px = (nx: number) => box.x + nx * box.w
  const py = (ny: number) => box.y + ny * box.h

  const path = (pts: [number, number][], close = true) => {
    ctx.beginPath()
    pts.forEach(([nx, ny], i) => (i === 0 ? ctx.moveTo(px(nx), py(ny)) : ctx.lineTo(px(nx), py(ny))))
    if (close) ctx.closePath()
    if (opts.fill) {
      ctx.fillStyle = opts.fill
      ctx.fill()
    }
    ctx.stroke()
  }

  if (kind === 'pants') {
    path([
      [0.28, 0.06], [0.72, 0.06], [0.74, 0.34], [0.6, 0.96], [0.5, 0.62], [0.4, 0.96], [0.26, 0.34],
    ])
    ctx.restore()
    return
  }
  if (kind === 'cap') {
    ctx.beginPath()
    ctx.ellipse(px(0.46), py(0.42), box.w * 0.26, box.h * 0.22, 0, Math.PI, 0)
    if (opts.fill) {
      ctx.fillStyle = opts.fill
      ctx.fill()
    }
    ctx.stroke()
    path([[0.2, 0.42], [0.86, 0.5], [0.8, 0.58], [0.2, 0.52]])
    ctx.restore()
    return
  }

  // Top-style garment (tee / hoodie / jacket)
  const body: [number, number][] = [
    [0.36, 0.1], // left neck
    [0.24, 0.14], // left shoulder
    [0.08, 0.32], // left sleeve out
    [0.16, 0.44], // left cuff
    [0.28, 0.36], // left underarm
    [0.28, 0.92], // left hem
    [0.72, 0.92], // right hem
    [0.72, 0.36], // right underarm
    [0.84, 0.44], // right cuff
    [0.92, 0.32], // right sleeve out
    [0.76, 0.14], // right shoulder
    [0.64, 0.1], // right neck
  ]
  path(body)

  // neckline
  ctx.beginPath()
  if (kind === 'hoodie' && view !== 'sleeves') {
    // hood
    ctx.moveTo(px(0.36), py(0.1))
    ctx.bezierCurveTo(px(0.4), py(-0.02), px(0.6), py(-0.02), px(0.64), py(0.1))
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(px(0.36), py(0.1))
    ctx.bezierCurveTo(px(0.44), py(0.2), px(0.56), py(0.2), px(0.64), py(0.1))
    ctx.stroke()
  } else {
    ctx.moveTo(px(0.36), py(0.1))
    ctx.bezierCurveTo(px(0.44), py(0.17), px(0.56), py(0.17), px(0.64), py(0.1))
    ctx.stroke()
  }

  // back seam detail
  if (view === 'back') {
    ctx.save()
    ctx.setLineDash([lw * 2, lw * 2])
    ctx.beginPath()
    ctx.moveTo(px(0.5), py(0.14))
    ctx.lineTo(px(0.5), py(0.9))
    ctx.stroke()
    ctx.restore()
  }

  // hoodie pocket (front)
  if (kind === 'hoodie' && view === 'front') {
    path([[0.34, 0.62], [0.66, 0.62], [0.62, 0.82], [0.38, 0.82]], true)
  }
  // jacket center zip (front)
  if (kind === 'jacket' && view === 'front') {
    ctx.save()
    ctx.setLineDash([lw * 1.5, lw * 1.5])
    ctx.beginPath()
    ctx.moveTo(px(0.5), py(0.12))
    ctx.lineTo(px(0.5), py(0.92))
    ctx.stroke()
    ctx.restore()
  }
  ctx.restore()
}

/** Draw a dashed placement zone with a label + dimensions (print-asset guide). */
export function drawPlacement(
  ctx: CanvasRenderingContext2D,
  box: { x: number; y: number; w: number; h: number },
  label: string,
  accent = '#8FB800',
) {
  ctx.save()
  ctx.strokeStyle = accent
  ctx.lineWidth = Math.max(2, box.w * 0.02)
  ctx.setLineDash([box.w * 0.05, box.w * 0.04])
  ctx.strokeRect(box.x, box.y, box.w, box.h)
  ctx.setLineDash([])
  ctx.fillStyle = accent
  ctx.font = `600 ${Math.max(14, box.w * 0.09)}px Inter, Arial, sans-serif`
  ctx.textBaseline = 'bottom'
  ctx.fillText(label, box.x, box.y - box.w * 0.03)
  ctx.restore()
}

/** Create an offscreen canvas at the given pixel size. */
export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

/** Promise-wrapped canvas.toBlob for a transparent PNG. */
export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('canvas.toBlob failed'))), 'image/png')
  })
}
