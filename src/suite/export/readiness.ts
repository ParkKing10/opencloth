/**
 * Manufacturing readiness engine — the shared brain behind the Readiness Score,
 * the AI Factory Check and the export gate. Every check is derived from the real
 * design state (no placeholders); fixing a control raises the score live.
 */
import type { GarmentKind } from './types'

export type CheckCategory = 'Appearance' | 'Design' | 'Brand' | 'Construction' | 'Manufacturing'
export type CheckSeverity = 'required' | 'recommended'

export type ReadinessCheck = {
  id: string
  label: string
  category: CheckCategory
  severity: CheckSeverity
  ok: boolean
  weight: number
  /** Shown when the check is not satisfied. */
  hint?: string
}

/** The design facts the studio feeds in. Every field maps to a real, editable control. */
export type ReadinessInput = {
  garmentKind: GarmentKind
  hasMaterials: boolean
  hasColors: boolean
  hasConstruction: boolean
  hasFrontArtwork: boolean
  hasNeckLabelArtwork: boolean
  hasCareLabel: boolean
  hasPackaging: boolean
  hasProductionNotes: boolean
  hasTolerance: boolean
}

export type Readiness = {
  score: number
  checks: ReadinessCheck[]
  ready: ReadinessCheck[]
  missing: ReadinessCheck[]
  /** Missing checks that block a clean factory hand-off. */
  blockers: ReadinessCheck[]
}

const DEFS: Omit<ReadinessCheck, 'ok'>[] = [
  { id: 'size-chart', label: 'Size Chart', category: 'Manufacturing', severity: 'required', weight: 16 },
  { id: 'materials', label: 'Materials', category: 'Appearance', severity: 'required', weight: 16, hint: 'Set the main fabric and weight.' },
  { id: 'colors', label: 'Colors', category: 'Appearance', severity: 'required', weight: 12, hint: 'Approve at least one colorway.' },
  { id: 'construction', label: 'Construction', category: 'Construction', severity: 'required', weight: 12, hint: 'Confirm stitch, seams and hems.' },
  { id: 'front-art', label: 'Artwork', category: 'Design', severity: 'recommended', weight: 14, hint: 'Place at least one graphic or text on the garment.' },
  { id: 'neck-label', label: 'Neck Label Artwork', category: 'Brand', severity: 'required', weight: 8, hint: 'Upload or generate the woven neck label.' },
  { id: 'care-label', label: 'Care Label', category: 'Brand', severity: 'required', weight: 6, hint: 'Add the care & content label.' },
  { id: 'tolerance', label: 'Tolerance Table', category: 'Manufacturing', severity: 'recommended', weight: 6, hint: 'Confirm the per-measure tolerances.' },
  { id: 'production-notes', label: 'Production Notes', category: 'Manufacturing', severity: 'recommended', weight: 6, hint: 'Add wash, finishing and QC notes.' },
  { id: 'packaging', label: 'Packaging', category: 'Manufacturing', severity: 'required', weight: 4, hint: 'Configure polybag, hangtag and carton.' },
]

/** Build the full check list from the current design state. */
export function computeReadiness(input: ReadinessInput): Readiness {
  const okById: Record<string, boolean> = {
    'size-chart': true, // graded chart is always generated from the garment
    materials: input.hasMaterials,
    colors: input.hasColors,
    construction: input.hasConstruction,
    'front-art': input.hasFrontArtwork,
    'neck-label': input.hasNeckLabelArtwork,
    'care-label': input.hasCareLabel,
    tolerance: input.hasTolerance,
    'production-notes': input.hasProductionNotes,
    packaging: input.hasPackaging,
  }

  const checks: ReadinessCheck[] = DEFS.map((d) => ({ ...d, ok: okById[d.id] ?? false }))
  const totalWeight = checks.reduce((s, c) => s + c.weight, 0)
  const okWeight = checks.filter((c) => c.ok).reduce((s, c) => s + c.weight, 0)
  const score = Math.round((okWeight / totalWeight) * 100)

  const ready = checks.filter((c) => c.ok)
  const missing = checks.filter((c) => !c.ok)
  const blockers = missing.filter((c) => c.severity === 'required')
  return { score, checks, ready, missing, blockers }
}

export type FactoryVerdict = {
  status: 'ready' | 'issues'
  headline: string
  detail: string
  blockers: ReadinessCheck[]
  warnings: ReadinessCheck[]
}

/** The AI Factory Check verdict shown before export. */
export function factoryCheck(readiness: Readiness): FactoryVerdict {
  const warnings = readiness.missing.filter((c) => c.severity === 'recommended')
  if (readiness.blockers.length === 0) {
    return {
      status: 'ready',
      headline: readiness.score === 100 ? 'Ready for Production' : 'Ready for Sampling',
      detail:
        warnings.length === 0
          ? 'No issues found. Every required spec is in place.'
          : `No critical issues found. ${warnings.length} optional item${warnings.length > 1 ? 's' : ''} could still be added.`,
      blockers: [],
      warnings,
    }
  }
  return {
    status: 'issues',
    headline: `${readiness.blockers.length} item${readiness.blockers.length > 1 ? 's' : ''} to resolve`,
    detail: 'Resolve the required specs below before handing off to a factory.',
    blockers: readiness.blockers,
    warnings,
  }
}
