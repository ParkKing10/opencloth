/* ============================================================
   Motion engine — the timeline renderer.
   renderProject(ctx, project, time) draws the complete composed
   frame for an absolute time: stage background, the active scene,
   and the cross-zoom transition into the next scene. Pure function
   of (project, time) → identical in preview and export.
   ============================================================ */

import type { Project } from '../types'
import { clamp01, easeInOutCubic, easeOutCubic, seg } from './ease'
import { paintBackground } from './draw'
import { renderScene } from './scenes'

/** Cross-transition length in seconds (centred on each scene boundary). */
export const TRANSITION = 0.5

export function totalDuration(p: Project): number {
  return p.scenes.reduce((s, sc) => s + sc.duration, 0)
}

export function sceneStarts(p: Project): number[] {
  const out: number[] = []
  let acc = 0
  for (const s of p.scenes) {
    out.push(acc)
    acc += s.duration
  }
  return out
}

/** Which scene owns absolute `time`, and the 0..1 local progress within it. */
export function sceneAt(p: Project, time: number): { index: number; local: number } {
  if (p.scenes.length === 0) return { index: -1, local: 0 }
  const starts = sceneStarts(p)
  const total = totalDuration(p)
  const tt = Math.min(Math.max(time, 0), Math.max(0, total - 1e-6))
  for (let i = p.scenes.length - 1; i >= 0; i--) {
    if (tt >= starts[i]) return { index: i, local: clamp01((tt - starts[i]) / p.scenes[i].duration) }
  }
  return { index: 0, local: 0 }
}

/** Count-up display: integers get thousands separators, floats one decimal. */
export function formatCount(target: number, p: number): string {
  return Number.isInteger(target) ? Math.round(target * p).toLocaleString('en-US') : (target * p).toFixed(1)
}

export function renderProject(ctx: CanvasRenderingContext2D, p: Project, time: number, W: number, H: number): void {
  paintBackground(ctx, W, H, time, p.brand)
  if (p.scenes.length === 0) return

  const starts = sceneStarts(p)
  for (let i = 0; i < p.scenes.length; i++) {
    const sc = p.scenes[i]
    const start = starts[i]
    const end = start + sc.duration
    // Render window extends half a transition beyond the scene on interior edges.
    const a = i === 0 ? start : start - TRANSITION / 2
    const b = i === p.scenes.length - 1 ? end : end + TRANSITION / 2
    if (time < a || time >= b) continue

    const inP = i === 0 ? 1 : easeOutCubic(seg(time, a, a + TRANSITION))
    const outP = i === p.scenes.length - 1 ? 0 : easeInOutCubic(seg(time, b - TRANSITION, b))
    const alpha = inP * (1 - outP)
    if (alpha <= 0.002) continue

    // Incoming scenes settle from 97%, outgoing scenes drift toward 105%.
    const scale = (0.97 + 0.03 * inP) * (1 + 0.05 * outP)
    const local = clamp01((time - start) / sc.duration)

    ctx.save()
    ctx.globalAlpha = alpha
    ctx.translate(W / 2, H / 2)
    ctx.scale(scale, scale)
    ctx.translate(-W / 2, -H / 2)
    renderScene(ctx, sc, p.brand, local, W, H)
    ctx.restore()
  }
}
