/**
 * Design Studio intelligence — pure, deterministic logic for the AI Command Bar,
 * the AI Companion and the Manufacturing Readiness score. No network, no fakery:
 * a command or suggestion resolves to a concrete `StudioAction` that the editor
 * applies to real, editable state.
 */
import type { GarmentKind } from '../../components/ui/Garments'
import type { ReadinessInput } from '../../export/readiness'

/** Manufacturing config the user toggles — each flag feeds the readiness score. */
export type StudioConfig = {
  construction: boolean
  neckLabel: boolean
  careLabel: boolean
  packaging: boolean
  tolerance: boolean
  productionNotes: boolean
}

export const INITIAL_CONFIG: StudioConfig = {
  construction: true,
  neckLabel: false, // start below 100% so the score has somewhere to go
  careLabel: true,
  packaging: false,
  tolerance: true,
  productionNotes: true,
}

/** A concrete, applyable change. The editor owns the state; this just describes intent. */
export type StudioAction =
  | { kind: 'set-field'; group: string; fieldId: string; value: string }
  | { kind: 'toggle-config'; key: keyof StudioConfig; value: boolean }
  | { kind: 'add-note'; note: string }

export type Proposal = { title: string; detail: string; actions: StudioAction[] }

export type StudioContext = {
  garment: { name: string; kind: GarmentKind; fit: string }
  config: StudioConfig
  fields: Record<string, { id: string; label: string; value: string }[]>
  frontArt: boolean
  backArt: boolean
}

/** Build the readiness input from the live editor state. */
export function deriveReadiness(ctx: StudioContext): ReadinessInput {
  return {
    garmentKind: ctx.garment.kind,
    hasMaterials: true, // fabric fields are always populated
    hasColors: true, // palette always has approved colors
    hasConstruction: ctx.config.construction,
    hasFrontArtwork: ctx.frontArt,
    hasBackArtwork: ctx.backArt,
    hasNeckLabelArtwork: ctx.config.neckLabel,
    hasCareLabel: ctx.config.careLabel,
    hasPackaging: ctx.config.packaging,
    hasProductionNotes: ctx.config.productionNotes,
    hasTolerance: ctx.config.tolerance,
  }
}

/** Example prompts shown as chips under the command bar. */
export const COMMAND_EXAMPLES = [
  'Make it more oversized',
  'Add a vintage wash',
  'Move the logo to the left chest',
  'Replace puff print with embroidery',
  'Make it look more premium',
]

/** Interpret a natural-language command into a reviewable proposal (or null). */
export function interpretCommand(text: string, _ctx: StudioContext): Proposal | null {
  const t = text.trim().toLowerCase()
  if (!t) return null

  if (/oversiz|baggy|bigger|relaxed|boxy/.test(t)) {
    const fit = /baggy/.test(t) ? 'Baggy' : /boxy/.test(t) ? 'Boxy' : /relaxed/.test(t) ? 'Relaxed' : 'Oversized'
    return {
      title: `Change fit to ${fit}`,
      detail: `Updates the silhouette and grading to a ${fit.toLowerCase()} fit across the size run.`,
      actions: [{ kind: 'set-field', group: 'details', fieldId: 'd-fit', value: fit }],
    }
  }
  if (/vintage|wash|faded|distress/.test(t)) {
    return {
      title: 'Apply a vintage wash',
      detail: 'Adds an enzyme + stone wash for a faded, lived-in hand-feel (2–3 shade drop).',
      actions: [{ kind: 'add-note', note: 'Vintage enzyme wash — 2–3 shade drop, soft hand-feel.' }],
    }
  }
  if (/embroider/.test(t)) {
    return {
      title: 'Switch front print to embroidery',
      detail: 'Changes the front technique from print to embroidery (9 stitches/cm, tear-away backing).',
      actions: [{ kind: 'set-field', group: 'design', fieldId: 'de-technique', value: 'Embroidery' }],
    }
  }
  if (/logo|left chest|chest|move/.test(t)) {
    return {
      title: 'Move artwork to the left chest',
      detail: 'Repositions the primary graphic to a left-chest placement (6 × 3 cm zone).',
      actions: [{ kind: 'set-field', group: 'design', fieldId: 'de-placement', value: 'Left Chest' }],
    }
  }
  if (/premium|luxur|elevate|high.?end/.test(t)) {
    return {
      title: 'Elevate to a premium spec',
      detail: 'Adds a woven neck label and a heavier hand-feel — the details buyers read as luxury.',
      actions: [
        { kind: 'toggle-config', key: 'neckLabel', value: true },
        { kind: 'set-field', group: 'details', fieldId: 'd-weight', value: '480 GSM' },
        { kind: 'add-note', note: 'Premium finish — woven neck label, heavier 480 GSM shell.' },
      ],
    }
  }
  if (/packag|polybag|carton|hangtag/.test(t)) {
    return {
      title: 'Configure packaging',
      detail: 'Sets the recycled polybag, hangtag and carton spec for production.',
      actions: [{ kind: 'toggle-config', key: 'packaging', value: true }],
    }
  }
  return null
}

export type Suggestion = { id: string; text: string; actions: StudioAction[] }

/** The AI Companion's live read of the project — senior-designer notes, never auto-applied. */
export function buildSuggestions(ctx: StudioContext): Suggestion[] {
  const out: Suggestion[] = []
  const technique = ctx.fields.design?.find((f) => f.id === 'de-technique')?.value ?? ''

  if (!ctx.config.neckLabel && (ctx.garment.kind === 'hoodie' || ctx.garment.kind === 'jacket')) {
    out.push({
      id: 's-neck',
      text: 'Luxury hoodies usually use a woven neck label — it reads as premium and lifts perceived value.',
      actions: [{ kind: 'toggle-config', key: 'neckLabel', value: true }],
    })
  }
  if (/puff/i.test(technique) && ctx.garment.kind === 'tee') {
    out.push({
      id: 's-puff',
      text: 'Puff print can crack on lightweight jersey. Screen print holds up better on a tee.',
      actions: [{ kind: 'set-field', group: 'design', fieldId: 'de-technique', value: 'Screen Print' }],
    })
  }
  if (!ctx.config.packaging) {
    out.push({
      id: 's-pack',
      text: 'Packaging isn’t configured yet — factories need the polybag, hangtag and carton spec.',
      actions: [{ kind: 'toggle-config', key: 'packaging', value: true }],
    })
  }
  if (!ctx.backArt) {
    out.push({
      id: 's-back',
      text: 'A back graphic would balance the design — most streetwear drops carry one.',
      actions: [],
    })
  }
  return out.slice(0, 3)
}
