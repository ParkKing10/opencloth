/**
 * Concept engine — the real, on-device graphic generator behind the THREADOS AI command bar. It
 * turns a prompt into transparent, print-ready vector concepts by composing a motif with a style
 * treatment. Deterministic (same prompt+seed → same art), so "Generate 3 more" and "regenerate this
 * one" are honest re-seeds, not random noise.
 *
 * Future-proofing: `generateConcepts` is the single seam. When a real image/diffusion provider is
 * connected it implements the same signature and returns PNG data URLs — the modal UI never changes,
 * only `isLiveConceptAi()` flips and the output format evolves. Today it is honestly false.
 */
import { hashSeed, makeRng } from './rng'
import { buildMotif } from './motifs'
import { buildStyle, type Style } from './styles'
import { parsePrompt, type StyleKey } from './promptParse'

export type Concept = {
  id: string
  prompt: string
  tags: string[]
  styleLabel: string
  seed: number
  /** Raw transparent SVG markup (0..200 viewBox) — also the editable source once vectors land. */
  svg: string
  /** `image/svg+xml` data URL, ready for an <img> preview or makeImageLayer(). */
  dataUrl: string
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function renderNode(node: ReturnType<typeof buildMotif>[number], style: Style): string {
  if (node.kind === 'text') {
    const p = style.paint(node.role)
    const fill = p.fill === 'none' ? p.line : p.fill
    return `<text x="${node.x}" y="${node.y}" font-family="'Arial Black', Arial Narrow, Arial, sans-serif" font-weight="900" font-size="${node.size}" text-anchor="middle" dominant-baseline="central" letter-spacing="-2" fill="${fill}" stroke="${p.edge}" stroke-width="${p.edgeWidth}">${esc(node.text)}</text>`
  }
  const p = style.paint(node.role)
  if (node.stroke) {
    return `<path d="${node.d}" fill="none" stroke="${p.line}" stroke-width="${node.stroke}" stroke-linecap="round" stroke-linejoin="round"/>`
  }
  return `<path d="${node.d}" fill="${p.fill}" stroke="${p.edge}" stroke-width="${p.edgeWidth}" stroke-linejoin="round"/>`
}

/** Build one concept's transparent SVG from a prompt + seed (+ optional forced style). */
export function buildConceptSvg(prompt: string, seed: number, styleOverride?: StyleKey): { svg: string; style: Style } {
  const parsed = parsePrompt(prompt)
  const rng = makeRng(seed || 1)
  const ns = `c${(seed >>> 0).toString(36)}`
  const style = buildStyle(styleOverride ? [styleOverride] : parsed.styles, rng, ns)
  const nodes = buildMotif(parsed.motif, rng, parsed.initials)
  const body = nodes.map((n) => renderNode(n, style)).join('')
  const gf = style.groupFilter ? ` filter="${style.groupFilter}"` : ''
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">` +
    `<defs>${style.defs}</defs><g${gf}>${body}</g></svg>`
  return { svg, style }
}

export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/** When the user names no style, cycle the three concepts through these for range. */
const DEFAULT_CYCLE: StyleKey[] = ['chrome', 'neon', 'vintage']

export type GenerateOpts = { count?: number; baseSeed?: number }

/** Generate N distinct concepts for a prompt. Pure + deterministic given (prompt, baseSeed). */
export function generateConcepts(prompt: string, opts: GenerateOpts = {}): Concept[] {
  const clean = prompt.trim()
  const base = opts.baseSeed ?? hashSeed(clean.toLowerCase())
  const count = Math.max(1, opts.count ?? 3)
  const parsed = parsePrompt(clean)
  const specified = parsed.styles.length > 0
  const out: Concept[] = []
  for (let i = 0; i < count; i++) {
    const seed = (base + i * 0x9e3779b1) >>> 0
    const styleOverride = specified ? undefined : DEFAULT_CYCLE[i % DEFAULT_CYCLE.length]
    const { svg, style } = buildConceptSvg(clean, seed, styleOverride)
    out.push({
      id: `cc-${seed.toString(36)}`,
      prompt: clean,
      tags: parsed.tags,
      styleLabel: style.label,
      seed,
      svg,
      dataUrl: svgToDataUrl(svg),
    })
  }
  return out
}

/** Re-seed a single concept in place (the per-card "regenerate this variation" action). */
export function regenerateConcept(prompt: string, prevSeed: number): Concept {
  const parsed = parsePrompt(prompt.trim())
  const specified = parsed.styles.length > 0
  const seed = ((prevSeed >>> 0) + 0x51ed270b) >>> 0
  const styleOverride = specified ? undefined : DEFAULT_CYCLE[seed % DEFAULT_CYCLE.length]
  const { svg, style } = buildConceptSvg(prompt.trim(), seed, styleOverride)
  return { id: `cc-${seed.toString(36)}`, prompt: prompt.trim(), tags: parsed.tags, styleLabel: style.label, seed, svg, dataUrl: svgToDataUrl(svg) }
}

/** A clean, Title-Cased layer/design name from a prompt. */
export function conceptName(prompt: string): string {
  const words = prompt.trim().replace(/\s+/g, ' ').split(' ').slice(0, 5)
  const name = words.map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ')
  return name || 'AI Graphic'
}

/**
 * Whether a live image/diffusion model is producing these concepts. Honestly false today — the
 * concepts are real on-device vector synthesis. Flips to true when a diffusion provider is wired to
 * `generateConcepts` (same UI, richer output).
 */
export function isLiveConceptAi(): boolean {
  return false
}
