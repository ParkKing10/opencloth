/**
 * Campaign generation — the model library, shoot options, and the hidden system prompt that turns a
 * finished garment render into on-model campaign photography. The prompt's single job is to make the
 * model wear the EXACT garment from the reference; it never lets the model redesign the clothing.
 *
 * There is no honest on-device fallback for a photoreal human, so this feature requires a real image
 * model (gpt-image-1). The UI gates on the key and says so — it never fakes a person.
 */
import type { ImageQuality, ImageSize } from './imageProvider'
import { IMAGE_QUALITY_BY_TIER } from './imageProvider'

/** A curated model reference — more natural for fashion than raw age/gender axes. */
export type CampaignModel = { id: string; label: string; prompt: string }

export const CAMPAIGN_MODELS: CampaignModel[] = [
  { id: 'street-m', label: 'Streetwear Male', prompt: 'a male streetwear model with an urban, relaxed presence' },
  { id: 'luxury-f', label: 'Luxury Female', prompt: 'an elegant female luxury-fashion model with an editorial presence' },
  { id: 'fitness', label: 'Fitness Model', prompt: 'an athletic fitness model with a toned physique' },
  { id: 'asian-f', label: 'Asian Female', prompt: 'an East Asian female fashion model' },
  { id: 'black-m', label: 'Black Male', prompt: 'a Black male fashion model' },
  { id: 'older-m', label: 'Older Male', prompt: 'a distinguished older male model, greying hair, mature' },
  { id: 'teen-f', label: 'Teen Female', prompt: 'a youthful teenage female model' },
  { id: 'plus', label: 'Plus Size', prompt: 'a confident plus-size fashion model with a curvy figure' },
  { id: 'runway', label: 'Runway Model', prompt: 'a tall, striking high-fashion runway model' },
]

export const CAMPAIGN_POSES = ['Front', 'Back', 'Side', 'Walking', 'Standing', 'Sitting'] as const
export const CAMPAIGN_STYLES = ['Streetwear', 'Luxury', 'Minimal', 'Techwear', 'Vintage', 'Sportswear', 'High Fashion'] as const
export const CAMPAIGN_BACKGROUNDS = ['Studio', 'White', 'Black', 'Outdoor', 'Urban', 'Transparent'] as const
export const CAMPAIGN_LIGHTING = ['Studio', 'Natural', 'Sunset', 'Neon', 'Dramatic'] as const
export const CAMPAIGN_QUALITIES: { id: 'fast' | 'high' | 'ultra'; label: string }[] = [
  { id: 'fast', label: 'Fast' },
  { id: 'high', label: 'High' },
  { id: 'ultra', label: 'Ultra' },
]

export type CampaignSelection = {
  modelId: string
  pose: string
  style: string
  background: string
  lighting: string
  quality: 'fast' | 'high' | 'ultra'
}

export const DEFAULT_CAMPAIGN: CampaignSelection = {
  modelId: 'street-m',
  pose: 'Front',
  style: 'Streetwear',
  background: 'Studio',
  lighting: 'Studio',
  quality: 'high',
}

function poseClause(pose: string): string {
  switch (pose) {
    case 'Back': return 'photographed from behind so the back of the garment is fully visible'
    case 'Side': return 'in a three-quarter side profile'
    case 'Walking': return 'walking naturally toward camera'
    case 'Sitting': return 'seated in a relaxed pose'
    case 'Standing': return 'standing in a confident full-length pose'
    default: return 'in a front-facing full-length pose'
  }
}

function bgClause(bg: string): string {
  switch (bg) {
    case 'White': return 'a clean seamless white studio backdrop'
    case 'Black': return 'a deep black studio backdrop'
    case 'Outdoor': return 'a natural outdoor setting with soft depth of field'
    case 'Urban': return 'a gritty urban street setting'
    case 'Transparent': return 'a plain neutral backdrop, subject cleanly isolated'
    default: return 'a professional photography studio backdrop'
  }
}

/**
 * The hidden, engineered system prompt sent with the garment reference. The user never sees it.
 * Its overriding instruction: preserve the garment exactly — only generate the human wearing it.
 */
export function campaignPrompt(sel: CampaignSelection): string {
  const model = CAMPAIGN_MODELS.find((m) => m.id === sel.modelId) ?? CAMPAIGN_MODELS[0]
  return (
    `Professional ${sel.style.toLowerCase()} fashion campaign photograph of ${model.prompt}, ` +
    `${poseClause(sel.pose)}, wearing the EXACT garment shown in the reference image. ` +
    `CRITICAL — preserve the garment precisely: do NOT redesign the clothing; keep every colour, ` +
    `all artwork and print placement, the logo position, print scale, proportions, sleeves, fit and ` +
    `stitching identical to the reference. The clothing is the priority and must match the reference exactly. ` +
    `Generate only the person and the scene. Set against ${bgClause(sel.background)}, with ${sel.lighting.toLowerCase()} lighting. ` +
    `Photorealistic high-end editorial fashion photography, sharp focus, natural skin texture, realistic fabric drape.`
  )
}

/** Image request parameters derived from the selection. Portrait, background per selection. */
export function campaignImageParams(sel: CampaignSelection): { size: ImageSize; quality: ImageQuality; background: 'transparent' | 'opaque' } {
  return {
    size: '1024x1536',
    quality: IMAGE_QUALITY_BY_TIER[sel.quality],
    background: sel.background === 'Transparent' ? 'transparent' : 'opaque',
  }
}
