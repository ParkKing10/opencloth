/* ============================================================
   Ad Director — the compositor.
   Renders ONE finished frame of the ad for any output time:
     intro headline  →  the real footage (cut per the plan, with a
     punch-in zoom on each key moment + a premium frame)  →  logo /
     CTA outro. Pure timing math (mapOutputToSource / adOutputDuration)
     is unit-tested; composeAdFrame draws it. Same function drives the
     preview and the export → WYSIWYG.
   ============================================================ */

import type { AdPlan } from './adPlan'
import { easeInOutCubic, easeOutCubic, clamp01 } from './ease'
import { emphasisAt, localZoomAt, textHiddenAt, type LocalEdit } from './adRefine'

export type AdConfig = {
  intro: number
  outro: number
  headline: string
  cta: string
  accent: string
  /** Refine knobs (multipliers around 1). */
  zoom: number
  accentUse: number
  vignette: number
  /** Time-anchored local edits (output seconds). */
  edits: LocalEdit[]
}

export const DEFAULT_AD_CONFIG: AdConfig = {
  intro: 1.4,
  outro: 2.0,
  headline: '',
  cta: 'Try it now',
  accent: '#d1f94f',
  zoom: 1,
  accentUse: 1,
  vignette: 1,
  edits: [],
}

/** Total output length: intro card + the cut body + outro card. */
export function adOutputDuration(plan: AdPlan, cfg: AdConfig): number {
  return cfg.intro + plan.cutDuration + cfg.outro
}

export type SourceMap =
  | { section: 'intro'; p: number }
  | { section: 'outro'; p: number }
  | { section: 'body'; srcTime: number; clip: number; video: number; focus?: number; clipP: number }

/** Map an OUTPUT time to what should be on screen: intro, a source frame of the footage, or outro. */
export function mapOutputToSource(plan: AdPlan, cfg: AdConfig, outT: number): SourceMap {
  if (outT < cfg.intro) return { section: 'intro', p: clamp01(outT / Math.max(0.001, cfg.intro)) }
  const bodyT = outT - cfg.intro
  const bodyDur = plan.cutDuration
  if (bodyT >= bodyDur) {
    const p = clamp01((outT - cfg.intro - bodyDur) / Math.max(0.001, cfg.outro))
    return { section: 'outro', p }
  }
  // Walk the clips: each contributes (end-start)/speed output seconds.
  let acc = 0
  for (let i = 0; i < plan.clips.length; i++) {
    const c = plan.clips[i]
    const outLen = (c.end - c.start) / c.speed
    if (bodyT < acc + outLen || i === plan.clips.length - 1) {
      const clipP = clamp01((bodyT - acc) / Math.max(0.001, outLen))
      const srcTime = c.start + clipP * (c.end - c.start)
      return { section: 'body', srcTime, clip: i, video: c.video, focus: c.focus, clipP }
    }
    acc += outLen
  }
  return { section: 'body', srcTime: 0, clip: 0, video: 0, clipP: 0 }
}

/* ---------------- layout ---------------- */

export type FootageLayout = { cover: boolean; x: number; y: number; w: number; h: number }

/**
 * Where the footage sits in the output frame. PURE.
 * Landscape output: the footage covers the whole frame (v1 look).
 * Portrait/square (TikTok, Reels, feed): a width-fitted rounded card floating
 * on the stage — cover-cropping a landscape screencast into 9:16 would leave
 * an unreadable center slice.
 */
export function footageLayout(W: number, H: number, sw: number, sh: number): FootageLayout {
  if (W > H) return { cover: true, x: 0, y: 0, w: W, h: H }
  const maxW = W * 0.92
  const maxH = H * 0.64
  const s = Math.min(maxW / Math.max(1, sw), maxH / Math.max(1, sh))
  const w = sw * s
  const h = sh * s
  // Slightly above centre — leaves breathing room for the accent glow below.
  return { cover: false, x: (W - w) / 2, y: H * 0.44 - h / 2, w, h }
}

/* ---------------- drawing ---------------- */

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

/** Draw a video/image "cover" into (W,H) with a zoom and normalised pan focus (fx,fy in 0..1). */
function drawCover(ctx: CanvasRenderingContext2D, src: CanvasImageSource, sw: number, sh: number, W: number, H: number, zoom: number, fx: number, fy: number) {
  const scale = Math.max(W / sw, H / sh) * zoom
  const dw = sw * scale
  const dh = sh * scale
  // Pan so the focus point sits slightly above centre.
  const dx = W / 2 - fx * dw
  const dy = H / 2 - fy * dh
  ctx.drawImage(src, clampPan(dx, W, dw), clampPan(dy, H, dh), dw, dh)
}
const clampPan = (d: number, view: number, size: number): number => Math.min(0, Math.max(view - size, d))

function vignette(ctx: CanvasRenderingContext2D, W: number, H: number, strength: number) {
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, `rgba(0,0,0,${strength})`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
}

function fitFont(ctx: CanvasRenderingContext2D, text: string, maxW: number, start: number, weight = 800): number {
  let size = start
  do {
    ctx.font = `${weight} ${size}px Inter, system-ui, sans-serif`
    if (ctx.measureText(text).width <= maxW) break
    size -= 2
  } while (size > 16)
  return size
}

export type FrameAssets = { videos: (HTMLVideoElement | null)[]; logo: HTMLImageElement | null }

/** Draw the whole composed ad frame at output time `t`. The caller must have the video seeked/positioned. */
export function composeAdFrame(ctx: CanvasRenderingContext2D, plan: AdPlan, cfg: AdConfig, assets: FrameAssets, t: number, W: number, H: number): void {
  ctx.save()
  ctx.fillStyle = '#08080b'
  ctx.fillRect(0, 0, W, H)

  const map = mapOutputToSource(plan, cfg, t)
  const cx = W / 2

  if (map.section === 'intro') {
    // Rising headline over a dark stage with an accent underline.
    const p = easeOutCubic(map.p)
    ctx.globalAlpha = p
    const words = (cfg.headline || 'Watch this').toUpperCase()
    const size = fitFont(ctx, words, W * 0.84, Math.round(H * 0.12))
    ctx.font = `900 ${size}px Inter, system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(words, cx, H / 2 + (1 - p) * 40)
    ctx.fillStyle = cfg.accent
    const uw = Math.min(W * 0.4, ctx.measureText(words).width) * p
    ctx.fillRect(cx - uw / 2, H / 2 + size * 0.5, uw, Math.max(3, H * 0.006))
    ctx.restore()
    return
  }

  if (map.section === 'outro') {
    const p = easeOutCubic(map.p)
    ctx.globalAlpha = Math.min(1, p * 1.4)
    if (assets.logo) {
      const lw = Math.min(W * 0.34, assets.logo.naturalWidth)
      const lh = (assets.logo.naturalHeight / Math.max(1, assets.logo.naturalWidth)) * lw
      ctx.drawImage(assets.logo, cx - lw / 2, H / 2 - lh - 10, lw, lh)
    } else {
      const size = Math.round(H * 0.09)
      ctx.font = `900 ${size}px Inter, system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.fillStyle = '#fff'
      ctx.fillText('loom studios', cx, H / 2)
    }
    // CTA pill.
    const ctaSize = Math.round(H * 0.038)
    ctx.font = `700 ${ctaSize}px Inter, system-ui, sans-serif`
    const tw = ctx.measureText(cfg.cta).width
    const padX = ctaSize
    const pillW = tw + padX * 2
    const pillH = ctaSize * 2.1
    const pillY = H / 2 + H * 0.06
    ctx.fillStyle = cfg.accent
    roundRect(ctx, cx - pillW / 2, pillY, pillW, pillH, pillH / 2)
    ctx.fill()
    ctx.fillStyle = '#0d0f08'
    ctx.textBaseline = 'middle'
    ctx.fillText(cfg.cta, cx, pillY + pillH / 2 + 1)
    ctx.textBaseline = 'alphabetic'
    ctx.restore()
    return
  }

  // ---- body: the real footage with a punch-in zoom on the moment (+ refine knobs / local edits) ----
  const v = assets.videos[map.video] ?? null
  if (v && v.videoWidth > 0) {
    // Zoom eases up as we approach the clip's focus, scaled by the vibe knob + any local zoom edit.
    const focusPhase = map.focus != null ? 1 - Math.min(1, Math.abs(map.srcTime - map.focus) / 1.2) : 0
    const zoom = 1.02 + 0.12 * cfg.zoom * easeInOutCubic(clamp01(focusPhase)) + localZoomAt(cfg.edits, t)
    const fx = 0.5
    const fy = 0.46
    // A short scale-in at each clip start reads as a cut with weight.
    const cutIn = 0.94 + 0.06 * easeOutCubic(clamp01(map.clipP / 0.12))
    const lay = footageLayout(W, H, v.videoWidth, v.videoHeight)
    // The footage frame: full-bleed (landscape) or the floating card (portrait/square).
    const frame = lay.cover
      ? (() => {
          const inset = Math.round(Math.min(W, H) * 0.03)
          return { x: inset, y: inset, w: W - inset * 2, h: H - inset * 2 }
        })()
      : lay
    const radius = Math.round(Math.min(W, H) * 0.03)

    if (!lay.cover) {
      // Stage glow behind the card so the vertical frame never feels empty.
      const g = ctx.createRadialGradient(W / 2, lay.y + lay.h * 0.85, lay.w * 0.1, W / 2, lay.y + lay.h * 0.75, lay.w * 0.95)
      g.addColorStop(0, `${cfg.accent}2e`)
      g.addColorStop(1, `${cfg.accent}00`)
      ctx.fillStyle = g
      ctx.fillRect(0, 0, W, H)
    }

    ctx.save()
    ctx.translate(W / 2, H / 2)
    ctx.scale(cutIn, cutIn)
    ctx.translate(-W / 2, -H / 2)
    roundRect(ctx, frame.x, frame.y, frame.w, frame.h, radius)
    ctx.clip()
    ctx.translate(frame.x, frame.y)
    drawCover(ctx, v, v.videoWidth, v.videoHeight, frame.w, frame.h, zoom, fx, fy)
    ctx.restore()
    vignette(ctx, W, H, (lay.cover ? 0.35 : 0.26) * cfg.vignette)

    // Accent highlight ring: on a reveal moment, or on an "emphasis" local edit — unless "text away".
    const revealPulse = map.focus != null && focusPhase > 0.6 ? (focusPhase - 0.6) / 0.4 : 0
    const emph = emphasisAt(cfg.edits, t) ? 1 : 0
    const ring = Math.max(revealPulse, emph)
    if (ring > 0 && !textHiddenAt(cfg.edits, t)) {
      ctx.globalAlpha = ring * 0.8 * cfg.accentUse
      ctx.strokeStyle = cfg.accent
      ctx.lineWidth = Math.max(2, H * 0.006 * (1 + emph * 0.6))
      roundRect(ctx, frame.x, frame.y, frame.w, frame.h, radius)
      ctx.stroke()
      ctx.globalAlpha = 1
    }
  }
  ctx.restore()
}
