/**
 * The seam for the FUTURE AI garment pipeline:
 *
 *   Prompt → AI Garment Generator → Editable Garment Model → loom studios Editor → Design → Export
 *
 * Milestone 7 defines this contract and builds the editor around it, but connects NO model.
 * `generateGarment` intentionally throws — there is no OpenAI/Gemini/Claude call, no prompt
 * engineering, and it never fabricates a garment. When the AI worker ships (a future milestone)
 * it will implement this one function, returning an EditableGarment in the tech-flat style.
 */
import type { EditableGarment } from './editableGarment'
import { makeReferenceBomber } from './referenceGarment'

export type GarmentGenerationRequest = {
  /** e.g. "Create an oversized cropped bomber jacket with two chest pockets." */
  prompt: string
}

export type GarmentGenerationResult = {
  garment: EditableGarment
}

/** Thrown by generateGarment until the AI worker is connected. Callers show this honestly. */
export class GarmentGeneratorNotConnectedError extends Error {
  readonly code = 'AI_GENERATOR_NOT_CONNECTED'
  constructor() {
    super('AI garment generation is not available yet. The generator worker is a future milestone; no model is connected.')
    this.name = 'GarmentGeneratorNotConnectedError'
  }
}

/**
 * FUTURE: convert a prompt into an editable tech-flat garment. Not implemented in Milestone 7.
 * The `_request` is accepted so the signature is stable for the worker that will replace this body.
 */
export async function generateGarment(_request: GarmentGenerationRequest): Promise<GarmentGenerationResult> {
  throw new GarmentGeneratorNotConnectedError()
}

/** Load the hand-authored reference garment so the editor foundation has real content today. */
export function loadReferenceGarment(): EditableGarment {
  return makeReferenceBomber()
}

/** Human-readable description of the target pipeline, surfaced in the foundation UI. */
export const FUTURE_PIPELINE_STAGES = ['Prompt', 'AI Garment Generator', 'Editable Garment', 'loom studios Editor', 'Design', 'Export'] as const
