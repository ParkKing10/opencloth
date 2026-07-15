/* ============================================================
   Prompt compiler — the user writes intent, we write direction.

   "Show Claude and ChatGPT connecting to Loom Studios" becomes a
   full production brief (shot goal, camera, light, style, brand,
   asset handling, continuity) for the provider. Pure function:
   same input → same compiled prompt, so it is testable and the
   admin/debug inspector shows exactly what was sent.
   ============================================================ */

import type { MotionAspect } from '../types'
import type { ClipStyle, ClipTypeId } from '../clipModel'
import type { GenerationMode } from './types'

export type CompileInput = {
  clipType: ClipTypeId
  userPrompt: string
  style: ClipStyle
  aspect: MotionAspect
  durationSec: number
  /** Product/brand context (brand kit lives project-side). */
  brandProduct: string
  brandAccent: string
  hasImages: boolean
  imageCount: number
  /** Continue Scene context. */
  continuesFrom?: { userPrompt: string }
}

/* What each clip type is FOR — the director's shot goal. */
const TYPE_GOALS: Record<ClipTypeId, string> = {
  'ai-scene': 'A single premium commercial scene.',
  typography: 'A kinetic typography moment: the words are the hero, nothing else competes.',
  screenshot: 'Bring the attached REAL product screenshot to life: subtle cursor movement, a decisive click, a confident zoom onto the action. The interface pixels must stay exactly as provided — never redraw, never invent UI.',
  recording: 'Cut the attached screen recording into a fast, premium product moment.',
  garment: 'A cinematic fashion reveal of the attached garment: fabric detail, depth, premium light.',
  shopify: 'A store-launch announcement moment with confident, commercial energy.',
  logo: 'A minimal, premium logo reveal. Restraint over spectacle.',
  workflow: 'Visualize an AI workflow: a request goes in, the result appears. Clean, technical, elegant.',
  commercial: 'A hero product commercial shot, Apple-keynote calibre.',
  feature: 'A focused feature showcase: one capability, clearly staged.',
  custom: 'Follow the brief precisely.',
}

const STYLE_NOTES: Record<ClipStyle, string> = {
  cinematic: 'Cinematic grade: soft volumetric light, shallow depth of field, slow deliberate camera, filmic contrast.',
  minimal: 'Minimal grade: vast negative space, one light source, almost still camera, nothing decorative.',
  bold: 'Bold grade: high contrast, hard shadows, fast confident cuts, oversized composition.',
  electric: 'Electric grade: neon glow accents, energetic motion, pulses on the beat, vivid saturation.',
}

const ASPECT_NOTES: Record<MotionAspect, string> = {
  '16:9': 'Landscape 16:9 — compose for a website hero / YouTube.',
  '9:16': 'Vertical 9:16 — compose for Reels/TikTok, subject centred, safe margins top and bottom.',
  '1:1': 'Square 1:1 — centre-weighted composition for feed placements.',
}

/** Compile the provider prompt. The user's own words always lead. */
export function compilePrompt(i: CompileInput): string {
  const lines: string[] = []
  const brief = i.userPrompt.trim()
  lines.push(brief.length > 0 ? brief : TYPE_GOALS[i.clipType])
  lines.push('')
  lines.push(`SHOT GOAL: ${TYPE_GOALS[i.clipType]}`)
  lines.push(`STYLE: ${STYLE_NOTES[i.style]}`)
  lines.push(`FORMAT: ${ASPECT_NOTES[i.aspect]} Target length ~${i.durationSec.toFixed(0)}s — one continuous beat, no montage.`)
  lines.push(`BRAND: ${i.brandProduct}. Accent colour ${i.brandAccent} — use it sparingly as the single highlight colour.`)
  if (i.hasImages) {
    lines.push(
      i.imageCount > 1
        ? `REFERENCES: ${i.imageCount} attached images are the ground truth for product/subject appearance — preserve their identity exactly.`
        : 'REFERENCE: the attached image is the ground truth for the subject — preserve its identity exactly; animate it, never replace it.',
    )
  }
  if (i.continuesFrom) {
    lines.push(`CONTINUITY: this shot continues the previous clip ("${i.continuesFrom.userPrompt.slice(0, 120)}"). Match its environment, light and subject so the cut feels intentional. Begin close to the attached final frame.`)
  }
  lines.push('QUALITY BAR: premium SaaS/fashion commercial. No watermarks, no text artifacts, no UI hallucination, no morphing hands or logos.')
  return lines.join('\n')
}

/** Which generation mode a clip resolves to, from its inputs — provider-agnostic. */
export function resolveMode(i: { clipType: ClipTypeId; hasImages: boolean; continuesFrom: boolean }): GenerationMode {
  if (i.continuesFrom) return 'continuation'
  if (i.clipType === 'garment' || i.clipType === 'commercial') return i.hasImages ? 'product-shot' : 'text-to-video'
  if (!i.hasImages) return 'text-to-video'
  return 'image-to-video'
}
