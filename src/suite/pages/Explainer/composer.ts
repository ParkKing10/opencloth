/* ============================================================
   Explainer Studio — the compositor
   Draws one frame of the finished explainer: a padded gradient
   stage, the source video inset with rounded corners + shadow,
   a smoothly interpolated auto-zoom toward recent clicks, a
   cursor spotlight, and expanding click ripples.

   The same draw() call powers both the live preview (rAF loop)
   and the export (canvas.captureStream → MediaRecorder), so what
   you see is exactly what downloads.
   ============================================================ */

import type { AspectKey, BgStyle, EffectConfig, PointerEvt } from './types'

export type Vec = { x: number; y: number }

/** Output canvas size for a given aspect + source dimensions. */
export function outputSize(aspect: AspectKey, srcW: number, srcH: number): { w: number; h: number } {
  // Cap the long edge at 1920 for sane export sizes/perf.
  const LONG = 1920
  switch (aspect) {
    case '16:9':
      return { w: LONG, h: Math.round((LONG * 9) / 16) }
    case '9:16':
      return { w: Math.round((LONG * 9) / 16), h: LONG }
    case '1:1':
      return { w: 1080, h: 1080 }
    case 'source':
    default: {
      const scale = LONG / Math.max(srcW, srcH)
      return { w: Math.round(srcW * scale), h: Math.round(srcH * scale) }
    }
  }
}

const BG_STOPS: Record<Exclude<BgStyle, 'transparent'>, [string, string, string]> = {
  aurora: ['#0b1f1a', '#13343f', '#1d1030'],
  mesh: ['#101018', '#1a2340', '#2a1140'],
  sunset: ['#2a0f1e', '#5a2130', '#c76b3f'],
  slate: ['#0c0c11', '#15151d', '#1e1e28'],
}

/** Interpolate the pointer position at time t from the recorded samples. */
export function pointerAt(events: PointerEvt[], t: number): Vec | null {
  if (events.length === 0) return null
  // binary-ish scan (timelines are small, linear is fine)
  let prev = events[0]
  for (let i = 0; i < events.length; i++) {
    const e = events[i]
    if (e.t <= t) prev = e
    else {
      const span = e.t - prev.t || 1
      const k = Math.min(1, Math.max(0, (t - prev.t) / span))
      return { x: prev.x + (e.x - prev.x) * k, y: prev.y + (e.y - prev.y) * k }
    }
  }
  return { x: prev.x, y: prev.y }
}

/** Auto-zoom target at time t: scale + centre in 0..1 video space. */
function zoomTarget(
  events: PointerEvt[],
  t: number,
  cfg: EffectConfig,
): { scale: number; center: Vec } {
  if (!cfg.autoZoom) return { scale: 1, center: { x: 0.5, y: 0.5 } }
  // Find the most recent click still within its hold window.
  let active: PointerEvt | null = null
  for (const e of events) {
    if (!e.click) continue
    if (e.t <= t && t - e.t <= cfg.zoomHold) active = e
    if (e.t > t) break
  }
  if (!active) return { scale: 1, center: { x: 0.5, y: 0.5 } }
  // While held, gently follow the live cursor so panning feels natural.
  const live = pointerAt(events, t) ?? { x: active.x, y: active.y }
  const center = { x: active.x * 0.55 + live.x * 0.45, y: active.y * 0.55 + live.y * 0.45 }
  return { scale: cfg.zoomLevel, center }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

/**
 * Stateful renderer. Holds the smoothed zoom so motion is fluid across
 * frames regardless of frame delta. Reset it before each export pass.
 */
export class Compositor {
  private curScale = 1
  private curCenter: Vec = { x: 0.5, y: 0.5 }
  private lastT = 0
  private inited = false

  reset() {
    this.curScale = 1
    this.curCenter = { x: 0.5, y: 0.5 }
    this.inited = false
  }

  /** Draw the composed frame for source time `t` (seconds). */
  draw(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    t: number,
    cfg: EffectConfig,
    events: PointerEvt[],
    out: { w: number; h: number },
  ) {
    const { w: OW, h: OH } = out
    const dt = this.inited ? Math.min(0.1, Math.max(0, t - this.lastT)) : 0
    this.lastT = t
    this.inited = true

    // ---- smoothed zoom (frame-rate independent exponential ease) ----
    const target = zoomTarget(events, t, cfg)
    const tau = 0.22
    const k = dt > 0 ? 1 - Math.exp(-dt / tau) : 0.14
    this.curScale += (target.scale - this.curScale) * k
    this.curCenter.x += (target.center.x - this.curCenter.x) * k
    this.curCenter.y += (target.center.y - this.curCenter.y) * k

    // ---- stage background ----
    ctx.clearRect(0, 0, OW, OH)
    if (cfg.background !== 'transparent') {
      const [a, b, c] = BG_STOPS[cfg.background]
      const g = ctx.createLinearGradient(0, 0, OW, OH)
      g.addColorStop(0, a)
      g.addColorStop(0.55, b)
      g.addColorStop(1, c)
      ctx.fillStyle = g
      ctx.fillRect(0, 0, OW, OH)
      // soft glow blooms for depth
      const bloom = ctx.createRadialGradient(OW * 0.75, OH * 0.2, 0, OW * 0.75, OH * 0.2, OW * 0.6)
      bloom.addColorStop(0, 'rgba(255,255,255,0.10)')
      bloom.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = bloom
      ctx.fillRect(0, 0, OW, OH)
    }

    // ---- inset video frame ----
    const pad = cfg.padding * Math.min(OW, OH)
    const availW = OW - pad * 2
    const availH = OH - pad * 2
    const srcAR = video.videoWidth / video.videoHeight || 16 / 9
    // Fit video inside the available frame (contain).
    let fw = availW
    let fh = fw / srcAR
    if (fh > availH) {
      fh = availH
      fw = fh * srcAR
    }
    const fx = (OW - fw) / 2
    const fy = (OH - fh) / 2

    ctx.save()
    // shadow under the frame
    if (cfg.shadow > 0 && cfg.background !== 'transparent') {
      ctx.save()
      ctx.shadowColor = `rgba(0,0,0,${0.6 * cfg.shadow})`
      ctx.shadowBlur = 60 * cfg.shadow
      ctx.shadowOffsetY = 30 * cfg.shadow
      roundRect(ctx, fx, fy, fw, fh, cfg.radius)
      ctx.fillStyle = '#000'
      ctx.fill()
      ctx.restore()
    }
    // clip to rounded frame and draw the (zoomed) video
    roundRect(ctx, fx, fy, fw, fh, cfg.radius)
    ctx.clip()

    // source crop rect for the current zoom
    const s = this.curScale
    const cropW = video.videoWidth / s
    const cropH = video.videoHeight / s
    let sx = this.curCenter.x * video.videoWidth - cropW / 2
    let sy = this.curCenter.y * video.videoHeight - cropH / 2
    sx = Math.max(0, Math.min(video.videoWidth - cropW, sx))
    sy = Math.max(0, Math.min(video.videoHeight - cropH, sy))
    try {
      ctx.drawImage(video, sx, sy, cropW, cropH, fx, fy, fw, fh)
    } catch {
      /* video not yet decodable for this frame — skip */
    }

    // ---- cursor + ripples (drawn in frame space, respecting zoom) ----
    const toFrame = (p: Vec): Vec => {
      // p is 0..1 in video space; map through the crop to frame pixels.
      const vx = p.x * video.videoWidth
      const vy = p.y * video.videoHeight
      return { x: fx + ((vx - sx) / cropW) * fw, y: fy + ((vy - sy) / cropH) * fh }
    }

    if (cfg.ripples) {
      for (const e of events) {
        if (!e.click) continue
        const age = t - e.t
        if (age < 0 || age > 0.6) continue
        const p = toFrame({ x: e.x, y: e.y })
        const prog = age / 0.6
        const r = 8 + prog * 60
        ctx.beginPath()
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(209,249,79,${(1 - prog) * 0.8})`
        ctx.lineWidth = 3
        ctx.stroke()
      }
    }

    if (cfg.cursor) {
      const p0 = pointerAt(events, t)
      if (p0) {
        const p = toFrame(p0)
        // spotlight glow
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 46)
        glow.addColorStop(0, 'rgba(209,249,79,0.35)')
        glow.addColorStop(1, 'rgba(209,249,79,0)')
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(p.x, p.y, 46, 0, Math.PI * 2)
        ctx.fill()
        // pointer arrow
        drawPointer(ctx, p.x, p.y)
      }
    }

    ctx.restore()
  }
}

function drawPointer(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, 20)
  ctx.lineTo(5, 15)
  ctx.lineTo(9, 23)
  ctx.lineTo(12, 21)
  ctx.lineTo(8, 13)
  ctx.lineTo(15, 13)
  ctx.closePath()
  ctx.fillStyle = '#fff'
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'
  ctx.lineWidth = 1.5
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}
