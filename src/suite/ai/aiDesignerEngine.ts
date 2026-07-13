/**
 * AI Designer prompt engineering. The user writes a short brief; these functions wrap it in the
 * hidden system guidance that makes the model output a CONSISTENT, production-usable garment — front
 * and back of the SAME piece — and, on request, a photoreal on-model shot of that exact garment.
 *
 * Real generation only (Runware). There is no honest on-device fallback for a photoreal garment, so
 * the AI Designer requires a key and says so — it never fakes a render.
 */
import type { ImageSize } from './imageProvider'

export type DesignBrief = { prompt: string; style: string; type: string }

/** Shared product-shot framing every garment render uses, so front and back read as one library. */
const FRAMING =
  'ghost-mannequin flat product shot, the garment centered and fully visible edge to edge, ' +
  'on a plain seamless off-white studio background, no person, no mannequin, no hanger, no props, no text or watermark, ' +
  'photorealistic fabric with accurate weave and drape, true accurate colours, crisp stitching, seams and trims, ' +
  'even soft studio lighting, sharp focus, ultra high detail, catalogue quality.'

/** FRONT render — the anchor image every back/on-model shot is conditioned on. When reference images
 *  are attached the model is told to treat them as loose GUIDANCE, not something to reproduce. */
export function frontPrompt(b: DesignBrief, hasRefs = false): string {
  const guidance = hasRefs
    ? ' The attached reference image(s) are STYLE / MOOD GUIDANCE ONLY — take loose inspiration, but DESIGN A NEW, ORIGINAL garment from the written brief. Do NOT copy, trace or reproduce the reference; do not replicate its exact print, logo, layout or composition.'
    : ''
  return (
    `Professional apparel product render — the FRONT view of a ${b.style.toLowerCase()} ${b.type}. ` +
    `Design brief: ${b.prompt.trim()}. ` +
    `Show the front of the garment only.${guidance} ${FRAMING}`
  )
}

/** BACK render — conditioned on the front image so it's the SAME garment, from behind. */
export function backPrompt(b: DesignBrief): string {
  return (
    `The BACK view of the EXACT same garment shown in the reference image — a ${b.style.toLowerCase()} ${b.type}. ` +
    `Keep the identical garment type, silhouette, colour, fabric, fit, trims and any prints/logos; only rotate to show it from behind. ` +
    `Do NOT redesign the garment. ${FRAMING}`
  )
}

/**
 * ON-MODEL "real-life" photo — a person wearing the EXACT garment from the reference. Its only job is
 * to show how the piece looks worn; it must never redesign the clothing.
 */
export function onModelPrompt(b: DesignBrief): string {
  return (
    `Professional ${b.style.toLowerCase()} fashion photograph of a model wearing the EXACT garment shown in the reference image, ` +
    `full-length front-facing pose, natural stance. ` +
    `CRITICAL — preserve the garment precisely: keep every colour, all artwork and print placement, proportions, sleeves, fit and stitching ` +
    `identical to the reference. The clothing is the priority and must match the reference exactly. Generate only the person and the scene. ` +
    `Clean seamless studio backdrop, soft studio lighting, photorealistic high-end editorial fashion photography, sharp focus, natural skin texture, realistic fabric drape.`
  )
}

/** Garment renders are portrait product shots; on-model is taller portrait. */
export const DESIGN_SIZE: ImageSize = '1024x1536'
export const MODEL_SIZE: ImageSize = '1024x1536'

/** Style presets and garment types the panel offers (kept here so the engine owns the vocabulary). */
export const DESIGN_STYLES = ['Streetwear', 'Luxury', 'Vintage Wash', 'Sportswear', 'Minimal', 'Techwear', 'High Fashion'] as const
export const DESIGN_TYPES = ['Hoodie', 'Tee', 'Jacket', 'Pants', 'Cap', 'Dress', 'Shirt', 'Shorts'] as const

/** Add crisp studio detail to a thin brief without overriding the user's intent. */
export function enhanceBrief(text: string): string {
  const clean = text.trim().replace(/\s*[.,]?\s*$/, '')
  const add = 'heavyweight premium fabric, considered proportions, refined trims and hardware, cohesive colour story'
  if (clean.toLowerCase().includes(add.slice(0, 12))) return clean
  return `${clean}. ${add}.`
}
