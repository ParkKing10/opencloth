/**
 * Creative Director — after a graphic lands, THREADOS keeps designing WITH the user. It reads the
 * real object (size, position, blend) and the design as a whole, then proposes concrete next moves,
 * each with an action that genuinely changes the design.
 *
 * Honesty: there is no per-garment chest measurement in the model, so size feedback is worded
 * against the PRINT AREA (the fraction the object spans), never invented centimetres. Every
 * suggestion's action is real and reversible through the normal undo history.
 */
import type { BlendMode, CanvasObject, CanvasObjectType } from './objectModel'

export type DirectorAction =
  | { kind: 'scale'; factor: number }
  | { kind: 'center' }
  | { kind: 'blend'; blendMode: BlendMode }
  | { kind: 'generate'; prompt: string }

export type DirectorSuggestion = { id: string; text: string; cta: string; action: DirectorAction }

export type DirectorContext = {
  /** The prompt that produced this object, when it came from THREADOS AI (enables "matching …"). */
  prompt?: string
  objectType: CanvasObjectType
}

const BIG = 0.55 // spans most of the print area
const SMALL = 0.16 // small for a front print
const OFF_X = 0.14
const OFF_Y = 0.22

export function buildDirector(obj: CanvasObject, ctx: DirectorContext): DirectorSuggestion[] {
  const out: DirectorSuggestion[] = []
  const w = obj.width
  const isArt = ctx.objectType === 'image' || ctx.objectType === 'graphic'

  // Size — real geometry against the print area.
  if (w > BIG) {
    const target = Math.round(w * 0.8 * 100)
    out.push({ id: 'scale-down', text: `That fills most of the print area. Scale it to about ${target}% for a balanced front graphic?`, cta: `Scale to ${target}%`, action: { kind: 'scale', factor: 0.8 } })
  } else if (w < SMALL) {
    const target = Math.round(w * 1.4 * 100)
    out.push({ id: 'scale-up', text: `It reads small for a front print. Size it up to about ${target}%?`, cta: `Scale to ${target}%`, action: { kind: 'scale', factor: 1.4 } })
  }

  // Placement — is it roughly centred on the front?
  if (Math.abs(obj.x - 0.5) > OFF_X || Math.abs(obj.y - 0.5) > OFF_Y) {
    out.push({ id: 'center', text: 'Want it centred on the front chest?', cta: 'Center it', action: { kind: 'center' } })
  }

  // Print realism — blend art into the fabric so it doesn't look like a sticker.
  if (isArt && (!obj.blendMode || obj.blendMode === 'normal')) {
    out.push({ id: 'blend', text: 'Blend it into the fabric with a Multiply pass so it reads like a real print?', cta: 'Apply Multiply', action: { kind: 'blend', blendMode: 'multiply' } })
  }

  // Keep the collection going — matching pieces, only when we know the prompt.
  if (ctx.prompt) {
    out.push({ id: 'sleeve', text: 'Design a matching sleeve graphic in the same style?', cta: 'Generate sleeve', action: { kind: 'generate', prompt: `${ctx.prompt} sleeve graphic` } })
    out.push({ id: 'back', text: 'Create a matching back print to complete the set?', cta: 'Generate back print', action: { kind: 'generate', prompt: `${ctx.prompt} back print` } })
  }

  return out.slice(0, 3)
}
