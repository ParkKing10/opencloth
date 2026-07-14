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

// Silhouette vocabulary — deliberately broad so free-text prompts work, not just the example chips.
// These are the words a user actually types ("make it baggy", "roomier", "slim fit", "longline").
// Bilingual (EN + DE): the app ships German and the example chips are localised, so the editor must
// understand both — otherwise a German user's prompts (and even the chips) silently do nothing.
const WIDER = /\b(oversized?|over-sized|boxy|boxier|baggy|baggier|roomy|roomier|relaxed|loose|looser|wider|widen|bigger|broad|broader|voluminous|chunky|weiter|weiten|breiter|größer|groesser|lockerer)\b/
const SLIMMER = /\b(fitted|slim|slimmer|skinny|tailored|tapered|tighter|tight|narrow|narrower|snug|streamlined|enger|schmaler|schlanker|tailliert|taillierter)\b/
const CROPPED = /\b(crop|cropped|shorter|kürzer|kuerzer|gecroppt)\b/
const LONGER = /\b(longer|elongated|longline|lengthen|lengthened|länger|laenger|verlängern|verlängert)\b/

/** Keywords → a predicate that matches the region(s) a "remove/…" prompt refers to. */
const TARGETS: { keys: RegExp; match: (r: GarmentRegion) => boolean; label: string }[] = [
  { keys: /\bbuttons?\b|\bsnaps?\b|\bknöpfe?\b|\bknopf\b/, match: (r) => r.type === 'button', label: 'buttons' },
  { keys: /\bzips?\b|\bzippers?\b|\breißverschl\w*\b|\breissverschl\w*\b/, match: (r) => r.type === 'zipper', label: 'zipper' },
  { keys: /\bpockets?\b|taschen?/, match: (r) => r.type === 'pocket', label: 'pockets' },
  { keys: /\bhoods?\b|\bkapuzen?\b/, match: (r) => r.type === 'hood', label: 'hood' },
  { keys: /\bcollars?\b|\bkragen\b/, match: (r) => r.type === 'collar', label: 'collar' },
  { keys: /\blabels?\b|\betiketten?\b/, match: (r) => r.type === 'label', label: 'labels' },
  { keys: /\bcuffs?\b|\bbündchen\b|\bmanschetten?\b/, match: (r) => r.type === 'cuff', label: 'cuffs' },
  { keys: /\bdrawstrings?\b|\bkordeln?\b|\btunnelzug\b/, match: (r) => r.type === 'drawstring', label: 'drawstrings' },
  { keys: /\bstitch(ing)?\b|\btopstitch(ing)?\b|\bnähte?\b|\bsteppnaht\b|\bsteppnähte\b/, match: (r) => r.type === 'stitch', label: 'stitching' },
  { keys: /\bwaistband\b|\bribs?\b|\bbund\b|\brippenbund\b/, match: (r) => r.type === 'waistband' || r.type === 'rib', label: 'waistband rib' },
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

const REMOVE_VERB = /\b(remove|delete|without|lose|drop|hide|get\s+rid\s+of|take\s+off|no\s+more|entfern\w*|lösch\w*|loesch\w*|weg|ohne|raus|kein\w*)\b/

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
  if (!ADD_VERB.test(prompt) || !/\bbuttons?\b|\bknöpfe?\b|\bknopf\b/.test(prompt)) return null
  const n = Math.max(1, Math.min(14, parseInt(/(\d+)\s*(?:buttons?|knöpfe?|knopf)/.exec(prompt)?.[1] ?? '6', 10)))
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
  // "ärmel" starts with an umlaut, which JS's ASCII \b won't treat as a word boundary, so match it
  // without a leading boundary.
  if (!/\bsleeves?\b|ärmel/.test(prompt)) return null
  const isWider = WIDER.test(prompt) || /\blarger\b/.test(prompt)
  const isNarrower = SLIMMER.test(prompt) || /\bsmaller\b/.test(prompt)
  const isLonger = LONGER.test(prompt)
  const isShorter = CROPPED.test(prompt)
  if (!isWider && !isNarrower && !isLonger && !isShorter) return null
  const sx = isWider ? 1.22 : isNarrower ? 0.82 : 1
  const sy = isLonger ? 1.16 : isShorter ? 0.85 : 1
  const ids = Object.values(garment.regions).filter((r) => r.type === 'sleeve' || r.type === 'cuff').map((r) => r.id)
  const { garment: next, changed } = scaleRegions(garment, ids, sx, sy, { x: CENTER_X, y: 210 })
  if (changed.length === 0) return { garment, changedRegionIds: [], summary: ['No sleeve geometry could be adjusted.'], understood: true, intent: 'sleeves' }
  const words = [isWider ? 'wider' : isNarrower ? 'slimmer' : '', isLonger ? 'longer' : isShorter ? 'shorter' : ''].filter(Boolean).join(' & ')
  return { garment: next, changedRegionIds: changed, summary: [`Made the sleeves ${words}`, 'Only sleeve & cuff regions modified', ...keptSummary(next, new Set(changed))], understood: true, intent: 'sleeves' }
}

function doFit(garment: EditableGarment, prompt: string): AiEditResult | null {
  // Whole-garment silhouette. Sleeve-specific requests are handled earlier by doSleeves, so a plain
  // "oversized" / "slim fit" / "longer" reshapes the body. Width is the "oversized" fix the user
  // asked for: a clearly visible broadening (~22% wider), not the old timid 10%.
  const cropped = CROPPED.test(prompt)
  const longer = LONGER.test(prompt)
  const wider = WIDER.test(prompt)
  const slimmer = SLIMMER.test(prompt)
  if (!cropped && !longer && !wider && !slimmer) return null
  const cfg = cropped
    ? { sx: 1, sy: 0.82, pivot: { x: CENTER_X, y: 100 }, word: 'cropped' }
    : longer
      ? { sx: 1, sy: 1.16, pivot: { x: CENTER_X, y: 100 }, word: 'longer' }
      : wider
        ? { sx: 1.22, sy: 1.05, pivot: { x: CENTER_X, y: 290 }, word: 'oversized' }
        : { sx: 0.84, sy: 1, pivot: { x: CENTER_X, y: 290 }, word: 'slim' }
  const ids = Object.keys(garment.regions)
  const { garment: next, changed } = scaleRegions(garment, ids, cfg.sx, cfg.sy, cfg.pivot)
  if (changed.length === 0) return { garment, changedRegionIds: [], summary: ['Fit could not be adjusted.'], understood: true, intent: 'fit' }
  return { garment: next, changedRegionIds: changed, summary: [`Reshaped to a ${cfg.word} fit`, `${changed.length} fabric regions reshaped`, 'Hierarchy, IDs & layer order preserved'], understood: true, intent: 'fit' }
}

function doDistress(garment: EditableGarment, prompt: string): AiEditResult | null {
  if (!/\b(distress(ed)?|ripped?|torn|worn|vintage|damaged|kaputt|zerrissen|abgenutzt|getragen|used)\b/.test(prompt)) return null
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

/** Build a pocket region — a small patch pocket on the chest, or a wide pouch on the front. */
function pocketRegion(kind: 'chest' | 'front'): GarmentRegion {
  const shapes: RegionShape[] =
    kind === 'chest'
      ? [
          { view: 'front', d: 'M150,176 L185,176 L185,214 L150,214 Z', role: 'fill' },
          { view: 'front', d: 'M150,184 L185,184', role: 'stitch' },
        ]
      : [
          { view: 'front', d: 'M146,322 L254,322 L246,394 L154,394 Z', role: 'fill' },
          { view: 'front', d: 'M176,322 L162,352', role: 'seam' },
          { view: 'front', d: 'M224,322 L238,352', role: 'seam' },
        ]
  return {
    id: kind === 'chest' ? 'ai-chest-pocket' : 'ai-front-pocket',
    name: kind === 'chest' ? 'Chest Pocket' : 'Front Pocket',
    type: 'pocket',
    children: [],
    shapes,
    visible: true,
    locked: false,
    capabilities: defaultCapabilities('pocket'),
  }
}

const ADD_VERB = /\b(add|give|put|insert|include|attach|need|want|with|sew|hinzu\w*|gib|mach\w*|setz\w*|füg\w*|fueg\w*|ergänz\w*|ergaenz\w*|mit)\b/

function doAddPocket(garment: EditableGarment, prompt: string): AiEditResult | null {
  if (!/\bpockets?\b|\bpouch\b|taschen?/.test(prompt)) return null
  if (!ADD_VERB.test(prompt)) return null
  const kind: 'chest' | 'front' = /\bchest\b|\bbreast\b|\bbrust\w*\b/.test(prompt) ? 'chest' : 'front'
  const region = pocketRegion(kind)
  if (garment.regions[region.id]) {
    return { garment, changedRegionIds: [], summary: [`A ${kind} pocket is already on the garment.`], understood: true, intent: 'add-pocket' }
  }
  const next = addRootRegion(garment, region)
  return {
    garment: next,
    changedRegionIds: [region.id],
    summary: [`Added a ${kind} pocket`, ...keptSummary(next, new Set([region.id]))],
    understood: true,
    intent: 'add-pocket',
  }
}

// Order matters: removals win over adds (so "remove the pockets" never reaches doAddPocket), and
// sleeve-specific edits win over the whole-garment fit so "wider sleeves" ≠ "wider everything".
const HANDLERS = [doRemove, doAddButtons, doAddPocket, doSleeves, doFit, doDistress]

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
      "I couldn't map that to a structural edit yet.",
      'Try: “make it oversized”, “slim fit”, “make the sleeves wider”, “make it longer”, “add a chest pocket”, “add 6 buttons”, “remove the pockets”, or “make it distressed”.',
      'Full free-form editing arrives with the AI worker — connect a model under Settings → AI.',
    ],
    understood: false,
    intent: 'unknown',
  }
}

/** Async wrapper matching the future worker's call shape (Editable Garment in → out). */
export async function runAiEdit(garment: EditableGarment, prompt: string): Promise<AiEditResult> {
  return editGarment(garment, prompt)
}
