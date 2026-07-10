/**
 * Garment generation entry point (Milestone 8.2).
 *
 *   Prompt → AI provider → Editable Garment (front + back, region tree) → THREADOS editor
 *
 * The AI NEVER returns an image. With an OpenAI key the real provider generates and validates a
 * structured editable garment (throws on failure so the UI can retry). Without a key, the
 * deterministic provider builds a real editable garment from the closest template — still a genuine
 * front+back region tree, never a flat picture.
 */
import { resolveProvider, type AiGenerationResult } from './aiProvider'
import { hasApiKey } from './aiSettings'
import { ensureBothViews } from './garmentNormalize'
import {
  EDITABLE_GARMENT_FORMAT,
  EDITABLE_GARMENT_VERSION,
  type EditableGarment,
} from './editableGarment'
import { TECH_FLAT } from './garmentStyle'

/** The animated phases shown during generation (Part 1). Narrate real construction steps. */
export const GENERATION_PHASES = [
  'Understanding garment',
  'Building editable regions',
  'Creating front view',
  'Creating back view',
  'Creating sleeves',
  'Creating collar',
  'Creating pockets',
  'Creating buttons',
  'Optimizing vector structure',
  'Finalizing',
] as const

export function isLiveAi(): boolean {
  return hasApiKey()
}

// Re-export for callers/tests that import it from generation.
export { ensureBothViews } from './garmentNormalize'

/** Generate a new editable garment from a prompt through the active provider. */
export async function generateGarment(prompt: string): Promise<AiGenerationResult> {
  const result = await resolveProvider().generateGarment(prompt)
  // Providers already normalize + guarantee front/back; this is a final safety mirror.
  return { ...result, garment: ensureBothViews(result.garment) }
}

/** An empty editable garment (front + back views, no regions) — the start of the Blank flow (Part 5). */
export function makeEmptyGarment(name = 'Untitled Garment'): EditableGarment {
  return {
    format: EDITABLE_GARMENT_FORMAT,
    version: EDITABLE_GARMENT_VERSION,
    id: 'empty',
    name,
    category: 'Custom',
    style: TECH_FLAT.id,
    views: [
      { id: 'front', label: 'Front', viewBox: { w: 400, h: 560 } },
      { id: 'back', label: 'Back', viewBox: { w: 400, h: 560 } },
    ],
    rootIds: [],
    regions: {},
    source: { kind: 'reference' },
    createdAt: 0,
  }
}

export function isEmptyGarment(g: EditableGarment): boolean {
  return g.rootIds.length === 0 && Object.keys(g.regions).length === 0
}
