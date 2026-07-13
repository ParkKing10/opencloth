import type { ManufacturingProject } from '../types'
import { canvasToPngBlob, drawGarment, makeCanvas } from './canvasKit'

/** The full project model as a pretty-printed JSON blob (re-importable source of truth). */
export function generateProjectJson(p: ManufacturingProject): Blob {
  const payload = {
    _format: 'threados.manufacturing-project',
    _version: 1,
    generatedBy: 'loom studios Manufacturing Export System',
    project: p,
  }
  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
}

/** A styled front product render (filled garment on transparent) for the design sheet. */
export async function generateDesignPng(p: ManufacturingProject): Promise<Blob> {
  const W = 1200
  const H = 1500
  const canvas = makeCanvas(W, H)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas unavailable')

  const fill = p.colors[0]?.hex ?? '#1E1E1E'
  const gBox = { x: W * 0.14, y: H * 0.12, w: W * 0.72, h: H * 0.76 }

  // soft drop shadow
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.28)'
  ctx.shadowBlur = W * 0.03
  ctx.shadowOffsetY = W * 0.02
  drawGarment(ctx, p.garment.kind, 'front', gBox, { fill, stroke: shade(fill, -30), lineWidth: W * 0.003 })
  ctx.restore()

  // accent chest mark
  const accent = p.colors.find((c) => c.name.toLowerCase().includes('lime'))?.hex ?? '#D8FF3E'
  ctx.fillStyle = accent
  ctx.beginPath()
  ctx.arc(gBox.x + gBox.w * 0.62, gBox.y + gBox.h * 0.3, W * 0.02, 0, Math.PI * 2)
  ctx.fill()

  // caption
  ctx.fillStyle = '#14141A'
  ctx.font = `700 ${W * 0.03}px Inter, Arial, sans-serif`
  ctx.textBaseline = 'top'
  ctx.fillText(p.meta.styleName, W * 0.08, H * 0.045)
  ctx.fillStyle = '#8A8A96'
  ctx.font = `500 ${W * 0.018}px Inter, Arial, sans-serif`
  ctx.fillText(`${p.meta.brand} · ${p.colors[0]?.name ?? ''}`, W * 0.08, H * 0.085)

  return canvasToPngBlob(canvas)
}

/** Lighten/darken a hex color by amount (-255..255). */
function shade(hex: string, amt: number): string {
  const n = hex.replace('#', '')
  const num = parseInt(n.length === 3 ? n.split('').map((c) => c + c).join('') : n, 16)
  const clamp = (v: number) => Math.max(0, Math.min(255, v))
  const r = clamp((num >> 16) + amt)
  const g = clamp(((num >> 8) & 0xff) + amt)
  const b = clamp((num & 0xff) + amt)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}
