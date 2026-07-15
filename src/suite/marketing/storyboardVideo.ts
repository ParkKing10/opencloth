/* ============================================================
   Storyboard → REAL video. A "VIDEO" card that opens into a list
   of stills is not a video — this renders the storyboard's beats
   (keyframe + caption) into an actual 9:16 clip: Ken-Burns motion
   on each keyframe, a hard TikTok-style cut-in per beat, bold
   captions with an accent highlight, exported via canvas
   captureStream + MediaRecorder (same WYSIWYG path as the Ad
   Director). Timing/layout math is pure and unit-tested.
   ============================================================ */

import { pickMime } from '../pages/Explainer/recorder'
import { fileExtFor } from '../pages/Explainer/exporter'

export type RenderScene = { image: string | null; title: string; caption: string }

export const SCENE_SECONDS = 3
export const CUT_IN_SECONDS = 0.28

/* ---------------- pure timing / layout ---------------- */

export function storyboardDuration(sceneCount: number): number {
  return Math.max(1, sceneCount) * SCENE_SECONDS
}

/** Map an output time to the beat on screen and its local 0..1 progress. */
export function sceneAt(t: number, sceneCount: number): { index: number; local: number } {
  const n = Math.max(1, sceneCount)
  const index = Math.min(n - 1, Math.max(0, Math.floor(t / SCENE_SECONDS)))
  const local = Math.min(1, Math.max(0, (t - index * SCENE_SECONDS) / SCENE_SECONDS))
  return { index, local }
}

/** Ken-Burns params for a beat: slow zoom (direction alternates) + a gentle drift. */
export function kenBurns(local: number, index: number): { zoom: number; driftX: number } {
  const zoomIn = index % 2 === 0
  const zoom = zoomIn ? 1.03 + 0.09 * local : 1.12 - 0.09 * local
  const dir = index % 2 === 0 ? 1 : -1
  return { zoom, driftX: dir * 0.03 * (local - 0.5) }
}

/** Greedy word wrap using an injectable measure function (canvas-free for tests). */
export function wrapLines(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w
    if (line && measure(candidate) > maxWidth) {
      lines.push(line)
      line = w
    } else {
      line = candidate
    }
  }
  if (line) lines.push(line)
  return lines
}

/* ---------------- drawing ---------------- */

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, W: number, H: number, zoom: number, driftX: number) {
  const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight) * zoom
  const dw = img.naturalWidth * scale
  const dh = img.naturalHeight * scale
  const dx = (W - dw) / 2 + driftX * W
  const dy = (H - dh) / 2
  ctx.drawImage(img, Math.min(0, Math.max(W - dw, dx)), Math.min(0, Math.max(H - dh, dy)), dw, dh)
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  scenes: RenderScene[],
  imgs: (HTMLImageElement | null)[],
  t: number,
  W: number,
  H: number,
  accent: string,
): void {
  const { index, local } = sceneAt(t, scenes.length)
  const scene = scenes[index]
  ctx.fillStyle = '#08080b'
  ctx.fillRect(0, 0, W, H)

  // Hard cut with weight: a short scale-in at each beat start (Ad-Director look).
  const cutIn = 0.94 + 0.06 * Math.min(1, local * (SCENE_SECONDS / CUT_IN_SECONDS))
  ctx.save()
  ctx.translate(W / 2, H / 2)
  ctx.scale(cutIn, cutIn)
  ctx.translate(-W / 2, -H / 2)
  const img = imgs[index]
  if (img) {
    const { zoom, driftX } = kenBurns(local, index)
    drawCover(ctx, img, W, H, zoom, driftX)
  } else {
    // No keyframe: dark stage with a soft accent glow so the caption carries the beat.
    const g = ctx.createRadialGradient(W / 2, H * 0.55, W * 0.1, W / 2, H * 0.55, W * 0.9)
    g.addColorStop(0, `${accent}26`)
    g.addColorStop(1, `${accent}00`)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
  }
  ctx.restore()

  // Legibility gradient behind the caption block.
  const grad = ctx.createLinearGradient(0, H * 0.6, 0, H)
  grad.addColorStop(0, 'rgba(0,0,0,0)')
  grad.addColorStop(1, 'rgba(0,0,0,0.72)')
  ctx.fillStyle = grad
  ctx.fillRect(0, H * 0.6, W, H * 0.4)

  // Beat counter, top-left.
  ctx.font = `700 ${Math.round(H * 0.018)}px Inter, system-ui, sans-serif`
  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.fillText(`${index + 1}/${scenes.length} · ${scene.title}`, W * 0.05, H * 0.05)

  // Caption: bold, centred, accent-highlighted bars (TikTok style).
  const size = Math.round(H * 0.032)
  ctx.font = `800 ${size}px Inter, system-ui, sans-serif`
  const lines = wrapLines(scene.caption, W * 0.82, (s) => ctx.measureText(s).width)
  const lineH = size * 1.35
  const baseY = H * 0.86 - (lines.length - 1) * lineH
  ctx.textAlign = 'center'
  lines.forEach((line, i) => {
    const y = baseY + i * lineH
    const w = ctx.measureText(line).width
    ctx.fillStyle = accent
    ctx.fillRect(W / 2 - w / 2 - 14, y - size * 0.92, w + 28, size * 1.3)
    ctx.fillStyle = '#0d0f08'
    ctx.fillText(line, W / 2, y)
  })
}

/* ---------------- the renderer ---------------- */

function loadImage(src: string | null): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null)
  return new Promise((res) => {
    const img = new Image()
    img.onload = () => res(img)
    img.onerror = () => res(null)
    img.src = src
  })
}

/** Render the storyboard to a real 9:16 video (realtime capture — takes ~duration). */
export async function renderStoryboardVideo(opts: {
  scenes: RenderScene[]
  accent?: string
  onProgress?: (p: number) => void
}): Promise<{ blob: Blob; ext: string; duration: number }> {
  const { scenes, accent = '#d1f94f', onProgress } = opts
  const W = 1080
  const H = 1920
  const imgs = await Promise.all(scenes.map((s) => loadImage(s.image)))
  const duration = storyboardDuration(scenes.length)

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d unavailable')
  drawFrame(ctx, scenes, imgs, 0, W, H, accent)

  const mime = pickMime()
  const stream = canvas.captureStream(30)
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 10_000_000 })
  const chunks: BlobPart[] = []
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  const done = new Promise<Blob>((res) => (rec.onstop = () => res(new Blob(chunks, { type: mime }))))
  rec.start(200)

  await new Promise<void>((finish) => {
    let t = 0
    let last = performance.now()
    const tick = (now: number) => {
      t += (now - last) / 1000
      last = now
      if (t >= duration) {
        finish()
        return
      }
      drawFrame(ctx, scenes, imgs, t, W, H, accent)
      onProgress?.(Math.min(0.99, t / duration))
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  drawFrame(ctx, scenes, imgs, duration - 0.01, W, H, accent)
  await new Promise((r) => setTimeout(r, 80))
  if (rec.state !== 'inactive') rec.stop()
  const blob = await done
  onProgress?.(1)
  return { blob, ext: fileExtFor(mime), duration }
}
