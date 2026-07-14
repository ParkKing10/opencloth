/* ============================================================
   Motion engine — drawing primitives + the animated mock SaaS UI.

   Everything here is resolution-independent: sizes derive from the
   rect / canvas passed in, so the same code renders the live
   preview and the full-res export. All "randomness" is seeded so
   frames are a pure function of time.
   ============================================================ */

import type { Brand, DemoKind } from '../types'
import { clamp01, easeInOutCubic, easeOutBack, easeOutCubic, lerp, rand, seg } from './ease'

export type Rect = { x: number; y: number; w: number; h: number }
export type Vec2 = { x: number; y: number }

/* ---------------- primitives ---------------- */

export function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

export function fillRR(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string): void {
  roundRectPath(ctx, x, y, w, h, r)
  ctx.fillStyle = fill
  ctx.fill()
}

export function strokeRR(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  stroke: string,
  width = 1,
): void {
  roundRectPath(ctx, x, y, w, h, r)
  ctx.strokeStyle = stroke
  ctx.lineWidth = width
  ctx.stroke()
}

export function hexToRgba(hex: string, alpha: number): string {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = parseInt(h.slice(0, 6), 16)
  if (Number.isNaN(n)) return `rgba(209,249,79,${alpha})`
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

const truncate = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

const slugText = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'product'

/* ---------------- stage background ---------------- */

const BG_BASE: Record<Brand['bg'], [string, string]> = {
  midnight: ['#07070c', '#0d0d16'],
  aurora: ['#061414', '#0e1c2c'],
  sunset: ['#160b12', '#241019'],
  mono: ['#0a0a0d', '#0a0a0d'],
}

export function paintBackground(ctx: CanvasRenderingContext2D, W: number, H: number, time: number, brand: Brand): void {
  const [c0, c1] = BG_BASE[brand.bg]
  const g = ctx.createLinearGradient(0, 0, W, H)
  g.addColorStop(0, c0)
  g.addColorStop(1, c1)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  if (brand.bg !== 'mono') {
    // Two slow-drifting glows give the "expensive gradient" feel.
    const gx = W * (0.28 + 0.08 * Math.sin(time * 0.31))
    const gy = H * (0.24 + 0.06 * Math.cos(time * 0.23))
    const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(W, H) * 0.55)
    glow.addColorStop(0, hexToRgba(brand.accent, 0.075))
    glow.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, W, H)

    const hx = W * (0.78 - 0.06 * Math.sin(time * 0.19))
    const hy = H * (0.8 + 0.05 * Math.sin(time * 0.27))
    const glow2 = ctx.createRadialGradient(hx, hy, 0, hx, hy, Math.max(W, H) * 0.5)
    glow2.addColorStop(0, brand.bg === 'sunset' ? 'rgba(255,140,90,0.06)' : 'rgba(90,140,255,0.055)')
    glow2.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = glow2
    ctx.fillRect(0, 0, W, H)
  }

  // Vignette for depth.
  const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.75)
  v.addColorStop(0, 'rgba(0,0,0,0)')
  v.addColorStop(1, 'rgba(0,0,0,0.42)')
  ctx.fillStyle = v
  ctx.fillRect(0, 0, W, H)
}

/** Slowly floating bokeh orbs used by intro / CTA scenes. */
export function drawOrbs(ctx: CanvasRenderingContext2D, W: number, H: number, time: number, accent: string, alpha = 1): void {
  for (let i = 0; i < 7; i++) {
    const r = (0.05 + rand(i * 3 + 3) * 0.09) * Math.min(W, H)
    const x = rand(i * 3 + 1) * W + Math.sin(time * (0.3 + rand(i) * 0.4) + i * 2.1) * W * 0.03
    const y = rand(i * 3 + 2) * H + Math.cos(time * (0.25 + rand(i + 9) * 0.35) + i * 1.7) * H * 0.035
    const col = i % 3 === 0 ? accent : '#ffffff'
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, hexToRgba(col, 0.085 * alpha))
    g.addColorStop(1, hexToRgba(col, 0))
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
}

/* ---------------- kinetic text ---------------- */

export type WordBox = { text: string; x: number; y: number; w: number; index: number }

/**
 * Wrap `text` into centred lines for `maxWidth`. Word x positions are
 * relative to the block's horizontal centre; y is the line offset.
 * ctx.font is set to `font` as a side effect.
 */
export function layoutWords(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: string,
  maxWidth: number,
  lineHeight: number,
): { words: WordBox[]; height: number } {
  ctx.font = font
  const spaceW = ctx.measureText(' ').width
  const raw = text.split(/\s+/).filter(Boolean)
  const lines: { words: { text: string; w: number }[]; width: number }[] = []
  let cur: { text: string; w: number }[] = []
  let curW = 0
  for (const t of raw) {
    const w = ctx.measureText(t).width
    const next = cur.length === 0 ? w : curW + spaceW + w
    if (next > maxWidth && cur.length > 0) {
      lines.push({ words: cur, width: curW })
      cur = [{ text: t, w }]
      curW = w
    } else {
      cur.push({ text: t, w })
      curW = next
    }
  }
  if (cur.length) lines.push({ words: cur, width: curW })

  const words: WordBox[] = []
  let index = 0
  lines.forEach((line, li) => {
    let x = -line.width / 2
    for (const w of line.words) {
      words.push({ text: w.text, x, y: li * lineHeight, w: w.w, index: index++ })
      x += w.w + spaceW
    }
  })
  return { words, height: lines.length * lineHeight }
}

/** Staggered word-by-word rise+fade reveal. Caller sets ctx.font first. */
export function drawKineticWords(
  ctx: CanvasRenderingContext2D,
  words: WordBox[],
  cx: number,
  cy: number,
  reveal: number,
  rise: number,
  color: (w: WordBox) => string,
): void {
  const n = Math.max(1, words.length)
  const base = ctx.globalAlpha
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  for (const w of words) {
    const start = (w.index / n) * 0.6
    const p = easeOutCubic(seg(reveal, start, start + 0.4))
    if (p <= 0) continue
    ctx.globalAlpha = base * p
    ctx.fillStyle = color(w)
    ctx.fillText(w.text, cx + w.x, cy + w.y + (1 - p) * rise)
  }
  ctx.globalAlpha = base
}

/* ---------------- cursor / callouts / toast ---------------- */

export function drawCursor(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, press: number): void {
  ctx.save()
  ctx.translate(x, y)
  const k = s * (1 - press * 0.14)
  ctx.scale(k, k)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, 20)
  ctx.lineTo(5, 15)
  ctx.lineTo(9, 23)
  ctx.lineTo(12, 21)
  ctx.lineTo(8, 13)
  ctx.lineTo(15, 13)
  ctx.closePath()
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'
  ctx.lineWidth = 1.6
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

export function drawClickRing(ctx: CanvasRenderingContext2D, x: number, y: number, p: number, accent: string): void {
  if (p <= 0 || p >= 1) return
  ctx.save()
  ctx.beginPath()
  ctx.arc(x, y, 6 + p * 46, 0, Math.PI * 2)
  ctx.strokeStyle = hexToRgba(accent, (1 - p) * 0.9)
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.restore()
}

/** Pill label with a connector line, popping out from an anchor point. */
export function drawCallout(
  ctx: CanvasRenderingContext2D,
  anchor: Vec2,
  text: string,
  pop: number,
  S: number,
  accent: string,
  dir: Vec2,
): void {
  if (pop <= 0) return
  const e = easeOutBack(clamp01(pop))
  const base = ctx.globalAlpha
  ctx.save()
  ctx.globalAlpha = base * clamp01(pop * 2)
  ctx.font = `600 ${15 * S}px Inter, sans-serif`
  const tw = ctx.measureText(text).width
  const pw = tw + 30 * S
  const ph = 36 * S
  const dist = 68 * S
  const pcx = anchor.x + dir.x * (dist * e + pw / 2)
  const pcy = anchor.y + dir.y * (dist * e + ph / 2)
  // connector + anchor dot
  ctx.beginPath()
  ctx.moveTo(anchor.x, anchor.y)
  ctx.lineTo(pcx, pcy)
  ctx.strokeStyle = hexToRgba(accent, 0.55)
  ctx.lineWidth = 2 * S
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(anchor.x, anchor.y, 5 * S, 0, Math.PI * 2)
  ctx.fillStyle = accent
  ctx.fill()
  // pill
  fillRR(ctx, pcx - pw / 2, pcy - ph / 2, pw, ph, ph / 2, 'rgba(13,13,19,0.94)')
  strokeRR(ctx, pcx - pw / 2, pcy - ph / 2, pw, ph, ph / 2, hexToRgba(accent, 0.7), 1.5 * S)
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, pcx, pcy + 1)
  ctx.restore()
}

export function drawToast(
  ctx: CanvasRenderingContext2D,
  right: number,
  top: number,
  text: string,
  p: number,
  S: number,
  accent: string,
): void {
  if (p <= 0) return
  const e = easeOutCubic(clamp01(p))
  const base = ctx.globalAlpha
  ctx.save()
  ctx.globalAlpha = base * e
  ctx.font = `600 ${14 * S}px Inter, sans-serif`
  const tw = ctx.measureText(text).width
  const w = tw + 56 * S
  const h = 40 * S
  const bx = right - w
  const by = top + (1 - e) * -16 * S
  fillRR(ctx, bx, by, w, h, 12 * S, 'rgba(15,17,13,0.96)')
  strokeRR(ctx, bx, by, w, h, 12 * S, hexToRgba(accent, 0.5), 1.5 * S)
  ctx.beginPath()
  ctx.arc(bx + 20 * S, by + h / 2, 9 * S, 0, Math.PI * 2)
  ctx.fillStyle = accent
  ctx.fill()
  ctx.strokeStyle = '#10160a'
  ctx.lineWidth = 2.2 * S
  ctx.beginPath()
  ctx.moveTo(bx + 15.5 * S, by + h / 2)
  ctx.lineTo(bx + 19 * S, by + h / 2 + 3.4 * S)
  ctx.lineTo(bx + 24.5 * S, by + h / 2 - 3.6 * S)
  ctx.stroke()
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, bx + 36 * S, by + h / 2 + 1)
  ctx.restore()
}

/* ---------------- the animated mock SaaS app ---------------- */

export type MockState = {
  /** 0..1 master progress driving the interior's staggered entrance. */
  ui: number
  /** Index of the nav row the demo "clicks" to. */
  navActive: number
  /** 0..1 blend of the active highlight travelling to navActive. */
  navBlend: number
  /** 0..1 chart draw-in progress. */
  chart: number
  /** 0..1 primary button press depth. */
  press: number
  /** 0..1 toast slide-in. */
  toast: number
  demo: DemoKind
  /** Scene-local seconds, for idle micro-motion. */
  time: number
}

export type MockAnchors = {
  nav: Vec2[]
  button: Vec2
  statCards: Rect[]
  chartArea: Rect
  content: Rect
}

/** Layout of interactive points inside the mock window — shared by the renderer and the cursor script. */
export function mockAnchors(f: Rect): MockAnchors {
  const chromeH = f.h * 0.085
  const content: Rect = { x: f.x, y: f.y + chromeH, w: f.w, h: f.h - chromeH }
  const sideW = content.w * 0.23
  const nav: Vec2[] = []
  const navH = content.h * 0.082
  const navY0 = content.y + content.h * 0.17
  for (let i = 0; i < 5; i++) nav.push({ x: content.x + sideW / 2, y: navY0 + i * (navH + content.h * 0.022) + navH / 2 })
  const mainX = content.x + sideW
  const mainW = content.w - sideW
  const pad = mainW * 0.05
  const headY = content.y + content.h * 0.085
  const button: Vec2 = { x: mainX + mainW - pad - mainW * 0.078, y: headY }
  const cardsY = content.y + content.h * 0.17
  const cardH = content.h * 0.21
  const gap = pad * 0.6
  const cardW = (mainW - pad * 2 - gap * 2) / 3
  const statCards: Rect[] = [0, 1, 2].map((i) => ({ x: mainX + pad + i * (cardW + gap), y: cardsY, w: cardW, h: cardH }))
  const chartTop = cardsY + cardH + gap
  const chartArea: Rect = { x: mainX + pad, y: chartTop, w: mainW - pad * 2, h: content.y + content.h - chartTop - pad }
  return { nav, button, statCards, chartArea, content }
}

const MOCK_STAT_VALUES: [string, string][] = [
  ['24.6k', '▲ 12%'],
  ['+18.2%', '▲ 4.1%'],
  ['99.4%', '▲ 0.6%'],
]

export function drawBrowserMock(ctx: CanvasRenderingContext2D, f: Rect, brand: Brand, st: MockState): void {
  const S = f.w / 1200
  const A = mockAnchors(f)
  const accent = brand.accent
  const base = ctx.globalAlpha

  // Drop shadow + window body.
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.55)'
  ctx.shadowBlur = 60 * S
  ctx.shadowOffsetY = 26 * S
  fillRR(ctx, f.x, f.y, f.w, f.h, 18 * S, '#101016')
  ctx.restore()
  strokeRR(ctx, f.x, f.y, f.w, f.h, 18 * S, 'rgba(255,255,255,0.09)', 1.5 * S)

  ctx.save()
  roundRectPath(ctx, f.x, f.y, f.w, f.h, 18 * S)
  ctx.clip()

  /* browser chrome */
  const chromeH = A.content.y - f.y
  ctx.fillStyle = '#15151d'
  ctx.fillRect(f.x, f.y, f.w, chromeH)
  ;['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
    ctx.beginPath()
    ctx.arc(f.x + (26 + i * 22) * S, f.y + chromeH / 2, 5.5 * S, 0, Math.PI * 2)
    ctx.fillStyle = c
    ctx.fill()
  })
  const uw = f.w * 0.42
  fillRR(ctx, f.x + (f.w - uw) / 2, f.y + chromeH * 0.22, uw, chromeH * 0.56, chromeH * 0.28, 'rgba(255,255,255,0.06)')
  ctx.font = `500 ${12.5 * S}px Inter, sans-serif`
  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(`${slugText(brand.product)}.app`, f.x + f.w / 2, f.y + chromeH / 2 + 0.5)

  /* sidebar */
  const c = A.content
  const sideW = c.w * 0.23
  ctx.fillStyle = '#0d0d13'
  ctx.fillRect(c.x, c.y, sideW, c.h)
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(c.x + sideW, c.y)
  ctx.lineTo(c.x + sideW, c.y + c.h)
  ctx.stroke()

  // logo row
  const lp = easeOutCubic(seg(st.ui, 0, 0.2))
  if (lp > 0) {
    ctx.globalAlpha = base * lp
    ctx.beginPath()
    ctx.arc(c.x + 26 * S, c.y + c.h * 0.085, 9 * S, 0, Math.PI * 2)
    ctx.fillStyle = accent
    ctx.fill()
    ctx.font = `700 ${15 * S}px Inter, sans-serif`
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(truncate(brand.product, 15), c.x + 42 * S, c.y + c.h * 0.085 + 1)
    ctx.globalAlpha = base
  }

  // travelling active-row highlight
  const navH = c.h * 0.082
  const hlFrom = A.nav[0].y - navH / 2
  const hlTo = (A.nav[Math.min(st.navActive, A.nav.length - 1)]?.y ?? A.nav[0].y) - navH / 2
  const hlY = lerp(hlFrom, hlTo, easeInOutCubic(st.navBlend))
  const hlP = easeOutCubic(seg(st.ui, 0.08, 0.28))
  if (hlP > 0) {
    ctx.globalAlpha = base * hlP
    fillRR(ctx, c.x + 12 * S, hlY, sideW - 24 * S, navH, 9 * S, hexToRgba(accent, 0.16))
    ctx.globalAlpha = base
  }

  // nav rows: icon square + fake-text bar
  A.nav.forEach((nv, i) => {
    const p = easeOutCubic(seg(st.ui, 0.08 + i * 0.05, 0.28 + i * 0.05))
    if (p <= 0) return
    ctx.globalAlpha = base * p
    const active = st.navBlend > 0.5 ? i === st.navActive : i === 0
    fillRR(ctx, c.x + 24 * S, nv.y - 6.5 * S, 13 * S, 13 * S, 4 * S, active ? accent : 'rgba(255,255,255,0.35)')
    const bw = (0.34 + rand(i * 11 + 5) * 0.26) * (sideW - 70 * S)
    fillRR(ctx, c.x + 48 * S, nv.y - 4 * S, bw, 8 * S, 4 * S, active ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.16)')
    ctx.globalAlpha = base
  })

  /* main header: title bar + primary button */
  const mainX = c.x + sideW
  const mainW = c.w - sideW
  const pad = mainW * 0.05
  const hp = easeOutCubic(seg(st.ui, 0.15, 0.35))
  if (hp > 0) {
    ctx.globalAlpha = base * hp
    fillRR(ctx, mainX + pad, A.button.y - 8 * S, mainW * 0.26, 16 * S, 8 * S, 'rgba(255,255,255,0.55)')
    fillRR(ctx, mainX + pad, A.button.y + 14 * S, mainW * 0.16, 8 * S, 4 * S, 'rgba(255,255,255,0.14)')
    const btnW = mainW * 0.155
    const btnH = c.h * 0.078
    const press = 1 - st.press * 0.07
    ctx.save()
    ctx.translate(A.button.x, A.button.y)
    ctx.scale(press, press)
    fillRR(ctx, -btnW / 2, -btnH / 2, btnW, btnH, btnH / 2, accent)
    ctx.font = `700 ${13.5 * S}px Inter, sans-serif`
    ctx.fillStyle = '#10140a'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('+ New', 0, 1)
    ctx.restore()
    ctx.globalAlpha = base
  }

  /* stat cards */
  A.statCards.forEach((r, i) => {
    const p = seg(st.ui, 0.3 + i * 0.07, 0.52 + i * 0.07)
    if (p <= 0) return
    const e = easeOutBack(p)
    ctx.globalAlpha = base * clamp01(p * 1.6)
    const dy = (1 - e) * 14 * S
    fillRR(ctx, r.x, r.y + dy, r.w, r.h, 12 * S, '#14141b')
    strokeRR(ctx, r.x, r.y + dy, r.w, r.h, 12 * S, 'rgba(255,255,255,0.07)', 1)
    fillRR(ctx, r.x + 16 * S, r.y + dy + 16 * S, r.w * 0.4, 7 * S, 3.5 * S, 'rgba(255,255,255,0.16)')
    const [val, delta] = MOCK_STAT_VALUES[i % MOCK_STAT_VALUES.length]
    ctx.font = `800 ${26 * S}px Inter, sans-serif`
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(val, r.x + 16 * S, r.y + dy + r.h - 22 * S)
    ctx.font = `700 ${11 * S}px Inter, sans-serif`
    const dw = ctx.measureText(delta).width + 14 * S
    fillRR(ctx, r.x + r.w - dw - 12 * S, r.y + dy + 13 * S, dw, 18 * S, 9 * S, hexToRgba(accent, 0.16))
    ctx.fillStyle = accent
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(delta, r.x + r.w - dw / 2 - 12 * S, r.y + dy + 22 * S)
    ctx.globalAlpha = base
  })

  /* chart card */
  const ch = A.chartArea
  const cp = easeOutCubic(seg(st.ui, 0.42, 0.6))
  if (cp > 0) {
    ctx.globalAlpha = base * cp
    fillRR(ctx, ch.x, ch.y, ch.w, ch.h, 12 * S, '#14141b')
    strokeRR(ctx, ch.x, ch.y, ch.w, ch.h, 12 * S, 'rgba(255,255,255,0.07)', 1)
    fillRR(ctx, ch.x + 16 * S, ch.y + 14 * S, ch.w * 0.22, 8 * S, 4 * S, 'rgba(255,255,255,0.2)')

    const plot: Rect = { x: ch.x + 20 * S, y: ch.y + 38 * S, w: ch.w - 40 * S, h: ch.h - 58 * S }
    if (plot.h > 10 * S) {
      const prog = easeInOutCubic(st.chart)
      if (st.demo === 'dashboard') drawLineChart(ctx, plot, accent, prog, st.time, S)
      else drawBarChart(ctx, plot, accent, prog, S)
    }
    ctx.globalAlpha = base
  }

  /* toast */
  if (st.toast > 0) drawToast(ctx, c.x + c.w - 18 * S, c.y + 14 * S, 'Design saved', st.toast, S, accent)

  ctx.restore() // window clip
}

export function drawLineChart(ctx: CanvasRenderingContext2D, r: Rect, accent: string, prog: number, time: number, S: number): void {
  if (prog <= 0) return
  const N = 11
  const pts: Vec2[] = []
  for (let i = 0; i < N; i++) {
    const v = 0.22 + rand(i * 7 + 2) * 0.62 + i * 0.012 // gentle upward trend
    pts.push({ x: r.x + (i / (N - 1)) * r.w, y: r.y + r.h * (1 - Math.min(v, 0.95)) })
  }
  ctx.save()
  ctx.beginPath()
  ctx.rect(r.x, r.y - 10 * S, r.w * prog, r.h + 20 * S)
  ctx.clip()
  // area fill
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < N; i++) {
    const mx = (pts[i - 1].x + pts[i].x) / 2
    ctx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, mx, (pts[i - 1].y + pts[i].y) / 2)
  }
  ctx.lineTo(pts[N - 1].x, pts[N - 1].y)
  ctx.lineTo(r.x + r.w, r.y + r.h)
  ctx.lineTo(r.x, r.y + r.h)
  ctx.closePath()
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h)
  g.addColorStop(0, hexToRgba(accent, 0.28))
  g.addColorStop(1, hexToRgba(accent, 0))
  ctx.fillStyle = g
  ctx.fill()
  // stroke
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < N; i++) {
    const mx = (pts[i - 1].x + pts[i].x) / 2
    ctx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, mx, (pts[i - 1].y + pts[i].y) / 2)
  }
  ctx.lineTo(pts[N - 1].x, pts[N - 1].y)
  ctx.strokeStyle = accent
  ctx.lineWidth = 3 * S
  ctx.lineJoin = 'round'
  ctx.stroke()
  ctx.restore()
  // end dot with a soft idle pulse once drawn in
  if (prog >= 1) {
    const last = pts[N - 1]
    ctx.beginPath()
    ctx.arc(last.x, last.y, (5 + Math.sin(time * 4) * 1.2) * S, 0, Math.PI * 2)
    ctx.fillStyle = accent
    ctx.fill()
  }
}

export function drawBarChart(ctx: CanvasRenderingContext2D, r: Rect, accent: string, prog: number, S: number): void {
  const N = 9
  const gap = r.w * 0.028
  const bw = (r.w - gap * (N - 1)) / N
  for (let i = 0; i < N; i++) {
    const p = easeOutCubic(seg(prog, i * 0.055, i * 0.055 + 0.5))
    if (p <= 0) continue
    const v = 0.25 + rand(i * 13 + 4) * 0.65
    const bh = r.h * v * p
    const top = i === N - 2 // highlight the tallest-ish bar
    fillRR(ctx, r.x + i * (bw + gap), r.y + r.h - bh, bw, bh, 4 * S, top ? accent : hexToRgba(accent, 0.32))
  }
}
