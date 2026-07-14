/* ============================================================
   Motion engine — the five scene renderers.

   Each scene is a pure function of local progress t (0..1):
   - intro      logo pop + kinetic title + tagline
   - statement  big word-by-word message with a marker highlight
   - feature    animated app mockup, scripted cursor, camera moves
   - stats      counting metrics
   - cta        closing card, pulsing button, confetti
   ============================================================ */

import type { Brand, CtaProps, FeatureProps, IntroProps, Scene, StatementProps, StatsProps } from '../types'
import { clamp01, easeInOutCubic, easeOutBack, easeOutCubic, easeOutExpo, lerp, pulse, rand, seg } from './ease'
import {
  drawBrowserMock,
  drawCallout,
  drawClickRing,
  drawCursor,
  drawKineticWords,
  drawOrbs,
  fillRR,
  hexToRgba,
  layoutWords,
  mockAnchors,
  strokeRR,
  type MockAnchors,
  type MockState,
  type Rect,
  type Vec2,
} from './draw'
import { formatCount } from './render'
import { renderCustom } from './renderCustom'

export function renderScene(ctx: CanvasRenderingContext2D, scene: Scene, brand: Brand, t: number, W: number, H: number): void {
  switch (scene.type) {
    case 'intro':
      renderIntro(ctx, W, H, t, scene.duration, brand, scene.props)
      break
    case 'statement':
      renderStatement(ctx, W, H, t, brand, scene.props)
      break
    case 'feature':
      renderFeature(ctx, W, H, t, scene.duration, brand, scene.props)
      break
    case 'stats':
      renderStats(ctx, W, H, t, brand, scene.props)
      break
    case 'cta':
      renderCta(ctx, W, H, t, scene.duration, brand, scene.props)
      break
    case 'custom':
      renderCustom(ctx, W, H, t, scene.duration, brand, scene.props)
      break
  }
}

/* ---------------- intro ---------------- */

function renderIntro(ctx: CanvasRenderingContext2D, W: number, H: number, t: number, dur: number, brand: Brand, props: IntroProps): void {
  const S = Math.min(W, H) / 1080
  const cx = W / 2
  const cy = H / 2
  const base = ctx.globalAlpha
  drawOrbs(ctx, W, H, t * dur, brand.accent, 0.9)

  // logo chip + expanding pulse ring
  const logoY = cy - 170 * S
  const lp = seg(t, 0.04, 0.2)
  if (lp > 0) {
    const e = easeOutBack(lp)
    const size = 92 * S * Math.max(0.05, e)
    ctx.globalAlpha = base * clamp01(lp * 2)
    const rp = seg(t, 0.16, 0.5)
    if (rp > 0 && rp < 1) {
      ctx.beginPath()
      ctx.arc(cx, logoY, (58 + rp * 90) * S, 0, Math.PI * 2)
      ctx.strokeStyle = hexToRgba(brand.accent, (1 - rp) * 0.45)
      ctx.lineWidth = 2 * S
      ctx.stroke()
    }
    fillRR(ctx, cx - size / 2, logoY - size / 2, size, size, 26 * S * e, brand.accent)
    ctx.font = `800 ${Math.max(1, 44 * S * e)}px Inter, sans-serif`
    ctx.fillStyle = '#10140a'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText((brand.product[0] ?? 'A').toUpperCase(), cx, logoY + 2 * S)
    ctx.globalAlpha = base
  }

  // kinetic title
  const font = `800 ${76 * S}px Inter, sans-serif`
  const lineH = 88 * S
  const { words, height } = layoutWords(ctx, props.title, font, W * 0.82, lineH)
  ctx.font = font
  const titleBaseline = cy - 30 * S
  drawKineticWords(ctx, words, cx, titleBaseline, seg(t, 0.16, 0.62), 44 * S, () => '#ffffff')
  const blockBottom = titleBaseline + height - lineH + 26 * S

  // accent underline sweep
  const up = easeInOutCubic(seg(t, 0.52, 0.68))
  if (up > 0) {
    const uw = W * 0.15 * up
    fillRR(ctx, cx - uw / 2, blockBottom + 18 * S, uw, 6 * S, 3 * S, brand.accent)
  }

  // tagline
  const tp = easeOutCubic(seg(t, 0.6, 0.8))
  if (tp > 0) {
    ctx.globalAlpha = base * tp
    ctx.font = `500 ${22 * S}px Inter, sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.62)'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(props.tagline, cx, blockBottom + 66 * S + (1 - tp) * 16 * S)
    ctx.globalAlpha = base
  }
}

/* ---------------- statement ---------------- */

const stripWord = (s: string): string => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')

function renderStatement(ctx: CanvasRenderingContext2D, W: number, H: number, t: number, brand: Brand, props: StatementProps): void {
  const S = Math.min(W, H) / 1080
  const cx = W / 2
  const fontSize = 58 * S
  const font = `700 ${fontSize}px Inter, sans-serif`
  const lineH = 76 * S
  const { words, height } = layoutWords(ctx, props.text, font, W * 0.74, lineH)
  const firstBaseline = H / 2 - height / 2 + fontSize

  // marker behind the highlighted word (draws first, under the text)
  const hl = stripWord(props.highlight)
  const mp = easeInOutCubic(seg(t, 0.55, 0.7))
  if (mp > 0 && hl) {
    for (const w of words) {
      if (stripWord(w.text) !== hl) continue
      fillRR(
        ctx,
        cx + w.x - 8 * S,
        firstBaseline + w.y - fontSize * 0.82,
        (w.w + 16 * S) * mp,
        fontSize * 1.06,
        8 * S,
        hexToRgba(brand.accent, 0.26),
      )
      break
    }
  }

  ctx.font = font
  drawKineticWords(ctx, words, cx, firstBaseline, seg(t, 0.05, 0.6), 36 * S, (w) =>
    hl && stripWord(w.text) === hl ? brand.accent : '#ffffff',
  )
}

/* ---------------- feature demo ---------------- */

type CamKey = { t: number; s: number; x: number; y: number }

function camAt(kf: CamKey[], t: number): { s: number; x: number; y: number } {
  if (t <= kf[0].t) return kf[0]
  for (let i = 0; i < kf.length - 1; i++) {
    const a = kf[i]
    const b = kf[i + 1]
    if (t >= a.t && t <= b.t) {
      const k = easeInOutCubic(seg(t, a.t, b.t))
      return { s: lerp(a.s, b.s, k), x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) }
    }
  }
  return kf[kf.length - 1]
}

const NAV_CLICK = 0.3
const BTN_CLICK = 0.7

function cursorAt(t: number, A: MockAnchors, f: Rect, S: number): Vec2 {
  const p0: Vec2 = { x: f.x + f.w + 60 * S, y: f.y + f.h * 0.85 }
  const p1 = A.nav[2]
  const p2 = A.button
  const p3: Vec2 = { x: p2.x + 80 * S, y: p2.y + 120 * S }
  const legs: [number, number, Vec2, Vec2][] = [
    [0.12, 0.27, p0, p1],
    [0.52, 0.66, p1, p2],
    [0.84, 0.97, p2, p3],
  ]
  for (const [a, b, from, to] of legs) {
    if (t >= a && t <= b) {
      const k = easeInOutCubic(seg(t, a, b))
      // slight arc so the motion feels hand-made
      return { x: lerp(from.x, to.x, k), y: lerp(from.y, to.y, k) - Math.sin(k * Math.PI) * 26 * S }
    }
  }
  if (t < legs[0][0]) return p0
  if (t < legs[1][0]) return p1
  if (t < legs[2][0]) return p2
  return p3
}

function renderFeature(ctx: CanvasRenderingContext2D, W: number, H: number, t: number, dur: number, brand: Brand, props: FeatureProps): void {
  const S = Math.min(W, H) / 1080
  const portrait = H > W * 1.1
  const fw = portrait ? W * 0.94 : Math.min(W * 0.7, H * 1.28)
  const fh = fw * 0.625
  const f: Rect = { x: (W - fw) / 2, y: (H - fh) / 2 + (portrait ? 0 : H * 0.045), w: fw, h: fh }
  const A = mockAnchors(f)
  const base = ctx.globalAlpha
  const cx = W / 2
  const cy = H / 2

  // camera: hold wide → dive to the stat card → glide to the button → ease back out
  const card1 = A.statCards[1]
  const c1x = card1.x + card1.w / 2
  const c1y = card1.y + card1.h / 2
  const kf: CamKey[] = [
    { t: 0, s: 1, x: cx, y: cy },
    { t: 0.36, s: 1, x: cx, y: cy },
    { t: 0.48, s: 1.32, x: c1x, y: c1y },
    { t: 0.6, s: 1.32, x: c1x, y: c1y },
    { t: 0.72, s: 1.28, x: A.button.x, y: A.button.y + 30 * S },
    { t: 0.86, s: 1.28, x: A.button.x, y: A.button.y + 30 * S },
    { t: 1, s: 1.05, x: cx, y: cy },
  ]
  const cam = camAt(kf, t)

  const enter = seg(t, 0, 0.13)
  const ee = easeOutCubic(enter)

  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(cam.s, cam.s)
  ctx.translate(-cam.x, -cam.y)
  // entrance slide+settle (finishes before the camera starts moving)
  ctx.translate(0, (1 - ee) * 90 * S)
  const es = 0.94 + 0.06 * easeOutBack(enter)
  ctx.translate(f.x + fw / 2, f.y + fh / 2)
  ctx.scale(es, es)
  ctx.translate(-(f.x + fw / 2), -(f.y + fh / 2))
  ctx.globalAlpha = base * clamp01(enter * 2.5)

  const st: MockState = {
    ui: seg(t, 0.05, 0.42),
    navActive: 2,
    navBlend: seg(t, NAV_CLICK + 0.01, NAV_CLICK + 0.12),
    chart: seg(t, 0.2, 0.52),
    press: pulse(t, BTN_CLICK - 0.02, 0.04),
    toast: seg(t, BTN_CLICK + 0.03, BTN_CLICK + 0.15),
    demo: props.demo,
    time: t * dur,
  }
  drawBrowserMock(ctx, f, brand, st)

  drawClickRing(ctx, A.nav[2].x, A.nav[2].y, seg(t, NAV_CLICK, NAV_CLICK + 0.06), brand.accent)
  drawClickRing(ctx, A.button.x, A.button.y, seg(t, BTN_CLICK, BTN_CLICK + 0.06), brand.accent)

  drawCallout(ctx, { x: c1x, y: card1.y }, props.calloutA, seg(t, 0.5, 0.6), S, brand.accent, { x: 0.55, y: -1 })
  drawCallout(ctx, { x: A.button.x, y: A.button.y - 18 * S }, props.calloutB, seg(t, 0.76, 0.86), S, brand.accent, { x: -0.9, y: -0.75 })

  const cur = cursorAt(t, A, f, S)
  const press = Math.max(pulse(t, NAV_CLICK - 0.02, 0.04), pulse(t, BTN_CLICK - 0.02, 0.04))
  const cp = seg(t, 0.1, 0.16)
  if (cp > 0) {
    ctx.globalAlpha = base * clamp01(enter * 2.5) * cp
    drawCursor(ctx, cur.x, cur.y, 1.25 * S, press)
  }
  ctx.restore()

  // heading + caption live outside the camera; they step aside while it dives in
  const hp = easeOutCubic(seg(t, 0.02, 0.14))
  const headVis = clamp01(1 - seg(t, 0.4, 0.48) + seg(t, 0.9, 0.97))
  const ha = hp * headVis
  if (ha > 0.01) {
    ctx.save()
    ctx.globalAlpha = base * ha
    const y0 = H * 0.085 + (1 - hp) * 22 * S
    ctx.font = `800 ${34 * S}px Inter, sans-serif`
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(props.heading, cx, y0)
    ctx.font = `500 ${17 * S}px Inter, sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.fillText(props.caption, cx, y0 + 30 * S)
    ctx.restore()
  }
}

/* ---------------- stats ---------------- */

function renderStats(ctx: CanvasRenderingContext2D, W: number, H: number, t: number, brand: Brand, props: StatsProps): void {
  const S = Math.min(W, H) / 1080
  const base = ctx.globalAlpha
  const cx = W / 2
  const n = Math.max(1, props.stats.length)

  const hp = easeOutCubic(seg(t, 0.02, 0.16))
  if (hp > 0) {
    ctx.globalAlpha = base * hp
    ctx.font = `800 ${44 * S}px Inter, sans-serif`
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(props.heading, cx, H * 0.24 + (1 - hp) * 24 * S)
    ctx.globalAlpha = base
  }

  const rowY = H * 0.56
  props.stats.forEach((stat, i) => {
    // column dividers
    if (i > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'
      ctx.lineWidth = 1.5
      const dx = (W * i) / n
      ctx.beginPath()
      ctx.moveTo(dx, rowY - 90 * S)
      ctx.lineTo(dx, rowY + 70 * S)
      ctx.stroke()
    }

    const xi = (W * (i + 0.5)) / n
    const start = 0.14 + i * 0.12
    const p = easeOutCubic(seg(t, start, start + 0.25))
    if (p <= 0) return
    const count = easeOutExpo(seg(t, start, start + 0.5))
    ctx.globalAlpha = base * p

    // value + suffix centred as one block — LAYOUT uses the final value so the
    // block never snaps sideways while the count-up gains digits mid-animation
    const vs = formatCount(stat.value, count)
    ctx.font = `800 ${88 * S}px Inter, sans-serif`
    const vw = ctx.measureText(formatCount(stat.value, 1)).width
    ctx.font = `800 ${44 * S}px Inter, sans-serif`
    const sw = ctx.measureText(stat.suffix).width
    const vx = xi - (vw + sw + 4 * S) / 2
    const vy = rowY + (1 - p) * 30 * S
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.font = `800 ${88 * S}px Inter, sans-serif`
    ctx.fillStyle = '#ffffff'
    ctx.fillText(vs, vx, vy)
    ctx.font = `800 ${44 * S}px Inter, sans-serif`
    ctx.fillStyle = brand.accent
    ctx.fillText(stat.suffix, vx + vw + 4 * S, vy)

    const bw = 56 * S * p
    fillRR(ctx, xi - bw / 2, vy + 26 * S, bw, 5 * S, 2.5 * S, brand.accent)
    ctx.font = `500 ${19 * S}px Inter, sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.textAlign = 'center'
    ctx.fillText(stat.label, xi, vy + 64 * S)
    ctx.globalAlpha = base
  })
}

/* ---------------- CTA ---------------- */

function renderCta(ctx: CanvasRenderingContext2D, W: number, H: number, t: number, dur: number, brand: Brand, props: CtaProps): void {
  const S = Math.min(W, H) / 1080
  const cx = W / 2
  const cy = H / 2
  const base = ctx.globalAlpha
  const sec = t * dur

  drawOrbs(ctx, W, H, sec, brand.accent, 0.8)
  confetti(ctx, cx, cy - 40 * S, sec - 0.25, Math.min(W, H), brand.accent)

  const cp = seg(t, 0.02, 0.18)
  if (cp <= 0) return
  const e = easeOutBack(cp)
  const cw = Math.min(W * 0.72, 820 * S)
  const chh = 420 * S

  ctx.save()
  ctx.globalAlpha = base * clamp01(cp * 2)
  ctx.translate(cx, cy)
  ctx.scale(Math.max(0.05, e), Math.max(0.05, e))
  ctx.translate(-cx, -cy)

  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 70 * S
  ctx.shadowOffsetY = 26 * S
  fillRR(ctx, cx - cw / 2, cy - chh / 2, cw, chh, 26 * S, '#101016')
  ctx.restore()
  strokeRR(ctx, cx - cw / 2, cy - chh / 2, cw, chh, 26 * S, 'rgba(255,255,255,0.1)', 1.5 * S)

  // logo chip
  const ls = 64 * S
  fillRR(ctx, cx - ls / 2, cy - chh / 2 + 46 * S, ls, ls, 18 * S, brand.accent)
  ctx.font = `800 ${30 * S}px Inter, sans-serif`
  ctx.fillStyle = '#10140a'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText((brand.product[0] ?? 'A').toUpperCase(), cx, cy - chh / 2 + 46 * S + ls / 2 + 1)

  // title + sub
  const tp = easeOutCubic(seg(t, 0.16, 0.32))
  if (tp > 0) {
    ctx.globalAlpha = base * clamp01(cp * 2) * tp
    ctx.font = `800 ${52 * S}px Inter, sans-serif`
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(props.title, cx, cy - 10 * S + (1 - tp) * 18 * S)
    ctx.font = `500 ${20 * S}px Inter, sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.58)'
    ctx.fillText(props.sub, cx, cy + 28 * S + (1 - tp) * 18 * S)
  }

  // pulsing button
  const bp = seg(t, 0.3, 0.46)
  if (bp > 0) {
    const be = easeOutBack(bp)
    ctx.globalAlpha = base * clamp01(cp * 2) * clamp01(bp * 2)
    ctx.font = `700 ${21 * S}px Inter, sans-serif`
    const tw = ctx.measureText(props.button).width
    const bw = tw + 76 * S
    const bh = 60 * S
    ctx.save()
    ctx.translate(cx, cy + 96 * S)
    ctx.scale(Math.max(0.05, be), Math.max(0.05, be))
    ctx.shadowColor = hexToRgba(brand.accent, 0.55)
    ctx.shadowBlur = (22 + Math.sin(sec * 3.2) * 9) * S
    fillRR(ctx, -bw / 2, -bh / 2, bw, bh, bh / 2, brand.accent)
    ctx.shadowBlur = 0
    ctx.fillStyle = '#10140a'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(props.button, 0, 1)
    ctx.restore()
  }

  // url
  const up = easeOutCubic(seg(t, 0.44, 0.58))
  if (up > 0) {
    ctx.globalAlpha = base * clamp01(cp * 2) * up
    ctx.font = `500 ${17 * S}px Inter, sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.45)'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(props.url, cx, cy + chh / 2 - 34 * S)
  }
  ctx.restore()
}

function confetti(ctx: CanvasRenderingContext2D, ox: number, oy: number, tt: number, minWH: number, accent: string): void {
  if (tt <= 0 || tt > 1.7) return
  const COLORS = [accent, '#ffffff', '#7ab8ff', '#ff9c6b']
  const base = ctx.globalAlpha
  for (let i = 0; i < 56; i++) {
    const ang = -Math.PI / 2 + (rand(i * 5 + 1) - 0.5) * 1.7
    const speed = (0.32 + rand(i * 5 + 2) * 0.5) * minWH
    const x = ox + Math.cos(ang) * speed * tt * 0.9
    const y = oy + Math.sin(ang) * speed * tt + 0.5 * minWH * 0.6 * tt * tt
    const size = (5 + rand(i * 5 + 3) * 6) * (minWH / 1080)
    ctx.save()
    ctx.globalAlpha = base * (1 - seg(tt, 1.1, 1.7))
    ctx.translate(x, y)
    ctx.rotate(tt * (rand(i * 5 + 4) * 9 - 4.5))
    ctx.fillStyle = COLORS[i % COLORS.length]
    ctx.fillRect(-size / 2, -size / 2, size, size * 0.6)
    ctx.restore()
  }
}
