/**
 * AI Garment Editor — the seam for the future AI worker.
 *
 * PIPELINE:  Editable Garment → analyze regions → understand prompt → edit ONLY the required
 * regions → reconstruct a NEW Editable Garment (IDs, hierarchy and layer order preserved).
 *
 * IMPORTANT: no LLM is connected (no OpenAI / Gemini / Claude, per Milestone 8). This is a
 * DETERMINISTIC PLACEHOLDER that performs real, region-scoped edits for a known set of intents
 * and is honest about the rest: an unrecognized prompt returns the garment UNCHANGED with
 * `understood: false`, never a fabricated or random garment, and never a PNG/JPG — always an
 * EditableGarment. When the worker ships it implements this same signature with a model.
 */
import type { EditableGarment, GarmentRegion, GarmentViewId, RegionShape } from './editableGarment'
import { defaultCapabilities } from './editableGarment'
import { addRootRegion, mapRegionShapes, removeRegions, replaceShapes } from './regionEdit'
import { scalePath } from './pathTransform'

export type AiEditResult = {
  garment: EditableGarment
  changedRegionIds: string[]
  summary: string[]
  understood: boolean
  intent: string
}

const CENTER_X = 200

/** Keywords → a predicate that matches the region(s) a "remove/…" prompt refers to. */
const TARGETS: { keys: RegExp; match: (r: GarmentRegion) => boolean; label: string }[] = [
  { keys: /\bbuttons?\b|\bsnaps?\b/, match: (r) => r.type === 'button', label: 'buttons' },
  { keys: /\bzips?\b|\bzippers?\b/, match: (r) => r.type === 'zipper', label: 'zipper' },
  { keys: /\bpockets?\b/, match: (r) => r.type === 'pocket', label: 'pockets' },
  { keys: /\bhoods?\b/, match: (r) => r.type === 'hood', label: 'hood' },
  { keys: /\bcollars?\b/, match: (r) => r.type === 'collar', label: 'collar' },
  { keys: /\blabels?\b/, match: (r) => r.type === 'label', label: 'labels' },
  { keys: /\bcuffs?\b/, match: (r) => r.type === 'cuff', label: 'cuffs' },
  { keys: /\bdrawstrings?\b/, match: (r) => r.type === 'drawstring', label: 'drawstrings' },
  { keys: /\bstitch(ing)?\b|\btopstitch(ing)?\b/, match: (r) => r.type === 'stitch', label: 'stitching' },
  { keys: /\bwaistband\b|\bribs?\b/, match: (r) => r.type === 'waistband' || r.type === 'rib', label: 'waistband rib' },
]

function idsMatching(garment: EditableGarment, match: (r: GarmentRegion) => boolean): string[] {
  return Object.values(garment.regions).filter(match).map((r) => r.id)
}

function keptSummary(garment: EditableGarment, changed: Set<string>): string[] {
  const kept = ['collar', 'pocket', 'button', 'zipper', 'sleeve']
    .filter((t) => Object.values(garment.regions).some((r) => r.type === t && !changed.has(r.id)))
    .map((t) => `Kept ${t === 'pocket' ? 'pockets' : t + 's'}`)
  return [...kept, 'Kept silhouette & proportions']
}

// ---- Intent handlers ----

const REMOVE_VERB = /\b(remove|delete|without|lose|drop|hide|get\s+rid\s+of|take\s+off|no\s+more)\b/

function doRemove(garment: EditableGarment, prompt: string): AiEditResult | null {
  if (!REMOVE_VERB.test(prompt)) return null
  const target = TARGETS.find((t) => t.keys.test(prompt))
  if (!target) return null
  const ids = idsMatching(garment, target.match)
  if (ids.length === 0) {
    return { garment, changedRegionIds: [], summary: [`No ${target.label} to remove — garment already has none.`], understood: true, intent: 'remove' }
  }
  const { garment: next, removed } = removeRegions(garment, new Set(ids))
  return {
    garment: next,
    changedRegionIds: removed,
    summary: [`Removed ${target.label} (${removed.length} region${removed.length === 1 ? '' : 's'})`, ...keptSummary(next, new Set(removed))],
    understood: true,
    intent: 'remove',
  }
}

function buttonShape(y: number): RegionShape {
  return { view: 'front', d: `M${CENTER_X - 5},${y} a5,5 0 1,0 10,0 a5,5 0 1,0 -10,0`, role: 'detail' }
}

function doAddButtons(garment: EditableGarment, prompt: string): AiEditResult | null {
  if (!/\badd\b/.test(prompt) || !/\bbuttons?\b/.test(prompt)) return null
  const n = Math.max(1, Math.min(14, parseInt(/(\d+)\s*buttons?/.exec(prompt)?.[1] ?? '6', 10)))
  const top = 150
  const bottom = 430
  const step = n > 1 ? (bottom - top) / (n - 1) : 0
  const shapes = Array.from({ length: n }, (_, i) => buttonShape(Math.round(top + step * i)))

  const existing = idsMatching(garment, (r) => r.type === 'button')[0]
  if (existing) {
    const next = replaceShapes(garment, existing, shapes)
    return { garment: next, changedRegionIds: [existing], summary: [`Set ${n} buttons down the front placket`, ...keptSummary(next, new Set([existing]))], understood: true, intent: 'add-buttons' }
  }
  const region: GarmentRegion = { id: 'ai-buttons', name: 'Buttons', type: 'button', children: [], shapes, visible: true, locked: false, capabilities: defaultCapabilities('button') }
  const next = addRootRegion(garment, region)
  return { garment: next, changedRegionIds: ['ai-buttons'], summary: [`Added a button placket with ${n} buttons`, ...keptSummary(next, new Set(['ai-buttons']))], understood: true, intent: 'add-buttons' }
}

function scaleRegions(garment: EditableGarment, ids: string[], sx: number, sy: number, pivot: { x: number; y: number }): { garment: EditableGarment; changed: string[] } {
  let g = garment
  const changed: string[] = []
  for (const id of ids) {
    const res = mapRegionShapes(g, id, (s) => {
      const d = scalePath(s.d, sx, sy, pivot)
      return d ? { ...s, d } : null
    })
    g = res.garment
    if (res.changed) changed.push(id)
  }
  return { garment: g, changed }
}

function doSleeves(garment: EditableGarment, prompt: string): AiEditResult | null {
  if (!/\bsleeves?\b/.test(prompt)) return null
  const wider = /\b(wider|bigger|larger|baggier|looser|oversized)\b/.test(prompt)
  const narrower = /\b(narrower|slimmer|tighter|smaller)\b/.test(prompt)
  if (!wider && !narrower) return null
  const sx = wider ? 1.18 : 0.85
  const ids = Object.values(garment.regions).filter((r) => r.type === 'sleeve' || r.type === 'cuff').map((r) => r.id)
  const { garment: next, changed } = scaleRegions(garment, ids, sx, 1, { x: CENTER_X, y: 210 })
  if (changed.length === 0) return { garment, changedRegionIds: [], summary: ['No sleeve geometry could be adjusted.'], understood: true, intent: 'sleeves' }
  return { garment: next, changedRegionIds: changed, summary: [`Made the sleeves ${wider ? 'wider' : 'narrower'}`, 'Only sleeve & cuff regions modified', ...keptSummary(next, new Set(changed))], understood: true, intent: 'sleeves' }
}

function doFit(garment: EditableGarment, prompt: string): AiEditResult | null {
  const cropped = /\b(crop|cropped|shorter)\b/.test(prompt)
  const longer = /\b(longer|elongated)\b/.test(prompt)
  const oversized = /\b(oversized|boxy|baggy)\b/.test(prompt) && !/\bsleeves?\b/.test(prompt)
  if (!cropped && !longer && !oversized) return null
  const ids = Object.keys(garment.regions)
  const cfg = cropped ? { sx: 1, sy: 0.82, pivot: { x: CENTER_X, y: 100 } } : longer ? { sx: 1, sy: 1.15, pivot: { x: CENTER_X, y: 100 } } : { sx: 1.1, sy: 1.06, pivot: { x: CENTER_X, y: 300 } }
  const { garment: next, changed } = scaleRegions(garment, ids, cfg.sx, cfg.sy, cfg.pivot)
  const word = cropped ? 'cropped' : longer ? 'longer' : 'oversized'
  if (changed.length === 0) return { garment, changedRegionIds: [], summary: ['Fit could not be adjusted.'], understood: true, intent: 'fit' }
  return { garment: next, changedRegionIds: changed, summary: [`Reshaped to an ${word} fit`, `${changed.length} fabric regions reshaped`, 'Hierarchy, IDs & layer order preserved'], understood: true, intent: 'fit' }
}

function doDistress(garment: EditableGarment, prompt: string): AiEditResult | null {
  if (!/\b(distress(ed)?|ripped?|torn|worn|vintage|damaged)\b/.test(prompt)) return null
  if (garment.regions['ai-distress']) return { garment, changedRegionIds: [], summary: ['Distressing already applied.'], understood: true, intent: 'distress' }
  const marks = (view: GarmentViewId): RegionShape[] => [
    { view, d: 'M168,300 l6,-4 l-3,8 l7,-2', role: 'seam' },
    { view, d: 'M226,340 l7,-3 l-4,9 l8,-1', role: 'seam' },
    { view, d: 'M188,392 l6,5 l-7,3 l8,4', role: 'seam' },
    { view, d: 'M150,250 l10,3 M240,268 l10,-3 M196,430 l9,4', role: 'stitch' },
  ]
  const region: GarmentRegion = {
    id: 'ai-distress',
    name: 'Distressing',
    type: 'stitch',
    children: [],
    shapes: [...marks('front'), ...marks('back')],
    visible: true,
    locked: false,
    capabilities: defaultCapabilities('stitch'),
  }
  const next = addRootRegion(garment, region)
  return {
    garment: next,
    changedRegionIds: ['ai-distress'],
    summary: ['Added fabric damage & ripped edges', 'Added distressed stitching & worn texture', 'Kept collar, pockets, buttons', 'Kept silhouette & proportions'],
    understood: true,
    intent: 'distress',
  }
}

const HANDLERS = [doRemove, doAddButtons, doSleeves, doFit, doDistress]

/**
 * Edit an existing garment from a prompt. Deterministic; returns a new garment with only the
 * required regions changed, or the unchanged garment with understood=false when the placeholder
 * doesn't recognize the request (the future model-backed worker will handle the long tail).
 */
export function editGarment(garment: EditableGarment, prompt: string): AiEditResult {
  const p = prompt.toLowerCase().trim()
  if (!p) return { garment, changedRegionIds: [], summary: ['Enter a prompt to edit the garment.'], understood: false, intent: 'empty' }
  for (const handler of HANDLERS) {
    const result = handler(garment, p)
    if (result) return result
  }
  return {
    garment,
    changedRegionIds: [],
    summary: [
      "The placeholder editor doesn't understand this prompt yet.",
      'Try: “remove the buttons”, “add 6 buttons”, “make the sleeves wider”, “make it cropped”, “oversized fit”, or “make it distressed”.',
      'Broader edits arrive with the AI worker (no model is connected in Milestone 8).',
    ],
    understood: false,
    intent: 'unknown',
  }
}

/** Async wrapper matching the future worker's call shape (Editable Garment in → out). */
export async function runAiEdit(garment: EditableGarment, prompt: string): Promise<AiEditResult> {
  return editGarment(garment, prompt)
}
