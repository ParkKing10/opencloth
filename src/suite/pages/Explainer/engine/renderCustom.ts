/* ============================================================
   Motion engine — renderer for AI-composed "custom" scenes.
   A custom scene is a list of elements (text, images, shapes,
   buttons, chips, charts, mockups, a cursor) each with its own
   enter/exit/pulse animation, plus an optional scene camera.
   Pure function of (props, t) — preview equals export.
   ============================================================ */

import type { Brand, CameraKey, CustomProps, SceneElement } from '../types'
import { clamp01, easeInOutCubic, easeOutBack, easeOutCubic, lerp, pulse, seg } from './ease'
import {
  drawBarChart,
  drawBrowserMock,
  drawClickRing,
  drawCursor,
  drawKineticWords,
  drawLineChart,
  drawOrbs,
  fillRR,
  hexToRgba,
  layoutWords,
  roundRectPath,
  strokeRR,
  type Rect,
} from './draw'
import { getAssetImage } from './assets'

type AnimState = { alpha: number; dx: number; dy: number; scale: number; enterP: number }

/** Resolve an element's animation at local time t; null = not visible yet / already gone. */
export function animState(el: SceneElement, t: number, dist: number): AnimState | null {
  const enter = el.enter ?? { effect: 'fade' as const, at: 0, dur: 0.12 }
  const pIn = seg(t, enter.at, enter.at + enter.dur)
  if (pIn <= 0) return null
  const e = easeOutCubic(pIn)
  let alpha = e
  let dx = 0
  let dy = 0
  let scale = 1
  switch (enter.effect) {
    case 'rise':
      dy = (1 - e) * dist
      break
    case 'drop':
      dy = -(1 - e) * dist
      break
    case 'slide-left':
      dx = (1 - e) * dist * 1.6
      break
    case 'slide-right':
      dx = -(1 - e) * dist * 1.6
      break
    case 'pop':
      scale = Math.max(0.05, easeOutBack(pIn))
      alpha = clamp01(pIn * 2)
      break
    case 'wipe': // rendered as a fast directional fade
      dx = (1 - e) * dist * 0.5
      break
    case 'fade':
      break
  }
  if (el.exit) {
    const pOut = seg(t, el.exit.at, el.exit.at + el.exit.dur)
    if (pOut >= 1) return null
    if (pOut > 0) {
      const eo = easeInOutCubic(pOut)
      alpha *= 1 - eo
      switch (el.exit.effect) {
        case 'rise':
          dy -= eo * dist
          break
        case 'drop':
          dy += eo * dist
          break
        case 'slide-left':
          dx -= eo * dist * 1.6
          break
        case 'slide-right':
          dx += eo * dist * 1.6
          break
        case 'pop':
          scale *= 1 - 0.25 * eo
          break
        default:
          break
      }
    }
  }
  if (el.pulseAt) for (const at of el.pulseAt) scale *= 1 + pulse(t, Math.max(0, at - 0.03), 0.05) * 0.08
  return { alpha, dx, dy, scale, enterP: pIn }
}

function camAt(keys: CameraKey[] | undefined, t: number, W: number, H: number): { s: number; x: number; y: number } {
  if (!keys || keys.length === 0) return { s: 1, x: W / 2, y: H / 2 }
  const px = (k: CameraKey) => ({ s: k.scale, x: k.x * W, y: k.y * H })
  if (t <= keys[0].at) return px(keys[0])
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i]
    const b = keys[i + 1]
    if (t >= a.at && t <= b.at) {
      const k = easeInOutCubic(seg(t, a.at, b.at))
      const pa = px(a)
      const pb = px(b)
      return { s: lerp(pa.s, pb.s, k), x: lerp(pa.x, pb.x, k), y: lerp(pa.y, pb.y, k) }
    }
  }
  return px(keys[keys.length - 1])
}

const TEXT_SIZES = { sm: 24, md: 36, lg: 56, xl: 76 } as const

export function renderCustom(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  t: number,
  dur: number,
  brand: Brand,
  props: CustomProps,
): void {
  const S = Math.min(W, H) / 1080
  const base = ctx.globalAlpha
  if (props.orbs) drawOrbs(ctx, W, H, t * dur, brand.accent, 0.85)

  const cam = camAt(props.camera, t, W, H)
  ctx.save()
  ctx.translate(W / 2, H / 2)
  ctx.scale(cam.s, cam.s)
  ctx.translate(-cam.x, -cam.y)

  for (const el of props.elements) {
    const st = animState(el, t, 46 * S)
    if (!st || st.alpha <= 0.003) continue

    if (el.kind === 'cursor') {
      drawCursorElement(ctx, el, t, W, H, S, brand.accent, base * st.alpha)
      continue
    }

    const cx = el.x * W + st.dx
    const cy = el.y * H + st.dy
    ctx.save()
    ctx.globalAlpha = base * st.alpha
    ctx.translate(cx, cy)
    ctx.scale(st.scale, st.scale)

    switch (el.kind) {
      case 'text':
        drawTextEl(ctx, el, st, W, S, brand)
        break
      case 'image':
        drawImageEl(ctx, el, W, S)
        break
      case 'shape':
        drawShapeEl(ctx, el, W, H, S, brand)
        break
      case 'button':
        drawButtonEl(ctx, el, t, S, brand)
        break
      case 'chip':
        drawChipEl(ctx, el, S, brand)
        break
      case 'chart':
        drawChartEl(ctx, el, t, dur, W, H, S, brand)
        break
      case 'mockup':
        drawMockupEl(ctx, el, t, dur, W, brand)
        break
    }
    ctx.restore()
  }

  ctx.restore()
}

/* ---------------- element painters (local space, centred on 0,0) ---------------- */

function drawTextEl(
  ctx: CanvasRenderingContext2D,
  el: Extract<SceneElement, { kind: 'text' }>,
  st: AnimState,
  W: number,
  S: number,
  brand: Brand,
): void {
  const size = TEXT_SIZES[el.size] * S
  const font = `${el.size === 'sm' ? 600 : 800} ${size}px Inter, sans-serif`
  const color = el.color === 'accent' ? brand.accent : el.color === 'muted' ? 'rgba(255,255,255,0.62)' : '#ffffff'
  const maxW = (el.maxWidth ?? 0.8) * W
  const { words, height } = layoutWords(ctx, el.text, font, maxW, size * 1.22)
  ctx.font = font
  const firstBaseline = -height / 2 + size * 0.85
  if (el.kinetic) {
    drawKineticWords(ctx, words, 0, firstBaseline, st.enterP, size * 0.5, () => color)
  } else {
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = color
    for (const w of words) ctx.fillText(w.text, w.x, firstBaseline + w.y)
  }
}

function drawImageEl(ctx: CanvasRenderingContext2D, el: Extract<SceneElement, { kind: 'image' }>, W: number, S: number): void {
  const w = el.w * W
  const img = getAssetImage(el.assetId)
  const ratio = img ? img.naturalHeight / img.naturalWidth : 9 / 16
  const h = w * ratio
  const r = (el.radius ?? 14) * S
  const chromeH = el.frame === 'browser' ? Math.max(26 * S, h * 0.07) : 0
  const totalH = h + chromeH
  const x = -w / 2
  const y = -totalH / 2

  if (el.shadow !== false) {
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.5)'
    ctx.shadowBlur = 48 * S
    ctx.shadowOffsetY = 20 * S
    fillRR(ctx, x, y, w, totalH, r, '#0d0d13')
    ctx.restore()
  }

  ctx.save()
  roundRectPath(ctx, x, y, w, totalH, r)
  ctx.clip()
  if (chromeH > 0) {
    ctx.fillStyle = '#15151d'
    ctx.fillRect(x, y, w, chromeH)
    ;['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
      ctx.beginPath()
      ctx.arc(x + (18 + i * 16) * S, y + chromeH / 2, 4.5 * S, 0, Math.PI * 2)
      ctx.fillStyle = c
      ctx.fill()
    })
  }
  if (img) {
    ctx.drawImage(img, x, y + chromeH, w, h)
  } else {
    // asset still loading (or deleted) — honest placeholder, never a crash
    ctx.fillStyle = '#14141b'
    ctx.fillRect(x, y + chromeH, w, h)
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'
    ctx.lineWidth = 2 * S
    ctx.setLineDash([8 * S, 6 * S])
    ctx.strokeRect(x + 8 * S, y + chromeH + 8 * S, w - 16 * S, h - 16 * S)
    ctx.setLineDash([])
    ctx.font = `600 ${15 * S}px Inter, sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.45)'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('image', 0, chromeH / 2)
  }
  ctx.restore()
  strokeRR(ctx, x, y, w, totalH, r, 'rgba(255,255,255,0.1)', 1.5 * S)
}

function drawShapeEl(
  ctx: CanvasRenderingContext2D,
  el: Extract<SceneElement, { kind: 'shape' }>,
  W: number,
  H: number,
  S: number,
  brand: Brand,
): void {
  const color =
    el.color === 'accent'
      ? brand.accent
      : el.color === 'white'
        ? '#ffffff'
        : el.color === 'muted'
          ? 'rgba(255,255,255,0.35)'
          : '#14141b'
  ctx.globalAlpha *= el.opacity ?? 1
  if (el.shape === 'circle') {
    const r = (el.w * W) / 2
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
  } else if (el.shape === 'line') {
    const w = el.w * W
    const h = Math.max(2 * S, el.h * H * 0.2)
    fillRR(ctx, -w / 2, -h / 2, w, h, h / 2, color)
  } else {
    const w = el.w * W
    const h = el.h * H
    fillRR(ctx, -w / 2, -h / 2, w, h, (el.radius ?? 8) * S, color)
    if (el.color === 'panel') strokeRR(ctx, -w / 2, -h / 2, w, h, (el.radius ?? 8) * S, 'rgba(255,255,255,0.08)', 1.5 * S)
  }
}

function drawButtonEl(
  ctx: CanvasRenderingContext2D,
  el: Extract<SceneElement, { kind: 'button' }>,
  t: number,
  S: number,
  brand: Brand,
): void {
  ctx.font = `700 ${20 * S}px Inter, sans-serif`
  const tw = ctx.measureText(el.label).width
  const w = tw + 64 * S
  const h = 54 * S
  const press = el.clickAt !== undefined ? pulse(t, el.clickAt - 0.02, 0.04) : 0
  ctx.save()
  ctx.scale(1 - press * 0.06, 1 - press * 0.06)
  ctx.shadowColor = hexToRgba(brand.accent, 0.45)
  ctx.shadowBlur = 24 * S
  fillRR(ctx, -w / 2, -h / 2, w, h, h / 2, brand.accent)
  ctx.shadowBlur = 0
  ctx.fillStyle = '#10140a'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(el.label, 0, 1)
  ctx.restore()
  if (el.clickAt !== undefined) drawClickRing(ctx, 0, 0, seg(t, el.clickAt, el.clickAt + 0.06), brand.accent)
}

function drawChipEl(ctx: CanvasRenderingContext2D, el: Extract<SceneElement, { kind: 'chip' }>, S: number, brand: Brand): void {
  ctx.font = `600 ${15 * S}px Inter, sans-serif`
  const tw = ctx.measureText(el.label).width
  const w = tw + 30 * S
  const h = 36 * S
  fillRR(ctx, -w / 2, -h / 2, w, h, h / 2, 'rgba(13,13,19,0.94)')
  strokeRR(ctx, -w / 2, -h / 2, w, h, h / 2, hexToRgba(brand.accent, 0.7), 1.5 * S)
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(el.label, 0, 1)
}

function drawChartEl(
  ctx: CanvasRenderingContext2D,
  el: Extract<SceneElement, { kind: 'chart' }>,
  t: number,
  dur: number,
  W: number,
  H: number,
  S: number,
  brand: Brand,
): void {
  const w = el.w * W
  const h = el.h * H
  fillRR(ctx, -w / 2, -h / 2, w, h, 12 * S, '#14141b')
  strokeRR(ctx, -w / 2, -h / 2, w, h, 12 * S, 'rgba(255,255,255,0.08)', 1.5 * S)
  const enter = el.enter ?? { effect: 'fade' as const, at: 0, dur: 0.12 }
  const prog = easeInOutCubic(seg(t, enter.at, enter.at + Math.max(enter.dur, 0.35)))
  const plot: Rect = { x: -w / 2 + 18 * S, y: -h / 2 + 16 * S, w: w - 36 * S, h: h - 32 * S }
  if (el.chart === 'bars') drawBarChart(ctx, plot, brand.accent, prog, S)
  else drawLineChart(ctx, plot, brand.accent, prog, t * dur, S)
}

function drawMockupEl(
  ctx: CanvasRenderingContext2D,
  el: Extract<SceneElement, { kind: 'mockup' }>,
  t: number,
  dur: number,
  W: number,
  brand: Brand,
): void {
  const w = el.w * W
  const h = w * 0.625
  const enter = el.enter ?? { effect: 'fade' as const, at: 0, dur: 0.12 }
  drawBrowserMock(ctx, { x: -w / 2, y: -h / 2, w, h }, brand, {
    ui: seg(t, enter.at, enter.at + 0.45),
    navActive: 2,
    navBlend: seg(t, enter.at + 0.35, enter.at + 0.5),
    chart: seg(t, enter.at + 0.15, enter.at + 0.55),
    press: 0,
    toast: 0,
    demo: el.demo,
    time: t * dur,
  })
}

function drawCursorElement(
  ctx: CanvasRenderingContext2D,
  el: Extract<SceneElement, { kind: 'cursor' }>,
  t: number,
  W: number,
  H: number,
  S: number,
  accent: string,
  alpha: number,
): void {
  const path = el.path
  // interpolate along the waypoint list
  let x = path[0].x
  let y = path[0].y
  if (t >= path[path.length - 1].at) {
    x = path[path.length - 1].x
    y = path[path.length - 1].y
  } else {
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i]
      const b = path[i + 1]
      if (t >= a.at && t <= b.at) {
        const k = easeInOutCubic(seg(t, a.at, b.at))
        x = lerp(a.x, b.x, k)
        y = lerp(a.y, b.y, k) - (Math.sin(k * Math.PI) * 22 * S) / H
        break
      }
      if (t < a.at) break
    }
  }
  ctx.save()
  ctx.globalAlpha = alpha
  let press = 0
  for (const p of path) {
    if (!p.click) continue
    drawClickRing(ctx, p.x * W, p.y * H, seg(t, p.at, p.at + 0.06), accent)
    press = Math.max(press, pulse(t, Math.max(0, p.at - 0.02), 0.04))
  }
  drawCursor(ctx, x * W, y * H, 1.25 * S, press)
  ctx.restore()
}
