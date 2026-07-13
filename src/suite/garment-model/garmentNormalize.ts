/**
 * Tolerant parsing + repair for AI garment output. Real models return JSON that is usually
 * MOSTLY right — a missing field, a stray view, an unreferenced region. Rather than reject it (and
 * show the user an error), loom studios repairs it into a valid front+back editable garment. This is
 * what makes generation feel reliable: the strict schema is the target, but the intake is forgiving.
 */
import {
  EDITABLE_GARMENT_FORMAT,
  EDITABLE_GARMENT_VERSION,
  defaultCapabilities,
  type EditableGarment,
  type GarmentRegion,
  type GarmentView,
  type RegionShape,
  type RegionType,
} from './editableGarment'
import { TECH_FLAT } from './garmentStyle'

const REGION_TYPES = new Set<RegionType>([
  'body', 'panel', 'sleeve', 'hood', 'collar', 'pocket', 'button', 'zipper', 'rib', 'waistband', 'cuff', 'label', 'drawstring', 'stitch', 'group', 'other',
])
const ROLES = new Set(['fill', 'outline', 'seam', 'stitch', 'detail'])

const asStr = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d)
const asNum = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d)

/** Extract a JSON object from model text even if wrapped in prose or ```json fences. */
export function parseJsonLoose(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    /* try harder */
  }
  const fence = /```(?:json)?\s*([\s\S]*?)```/.exec(text)
  if (fence) {
    try {
      return JSON.parse(fence[1])
    } catch {
      /* keep trying */
    }
  }
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1))
    } catch {
      /* give up */
    }
  }
  return null
}

function coerceShape(raw: unknown): RegionShape | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const d = asStr(r.d).trim()
  if (d.length < 2 || !/[MmLlHhVvCcSsQqTtAaZz]/.test(d)) return null // must look like a path
  const view: RegionShape['view'] = r.view === 'back' ? 'back' : 'front'
  const role = ROLES.has(r.role as string) ? (r.role as RegionShape['role']) : 'fill'
  return { view, d, role }
}

function coerceType(v: unknown): RegionType {
  return REGION_TYPES.has(v as RegionType) ? (v as RegionType) : 'panel'
}

/** Ensure every region renders in BOTH views (mirror front↔back per region when one is missing). */
export function ensureBothViews(garment: EditableGarment): EditableGarment {
  let changed = false
  const regions: EditableGarment['regions'] = {}
  for (const [id, r] of Object.entries(garment.regions)) {
    const hasFront = r.shapes.some((s) => s.view === 'front')
    const hasBack = r.shapes.some((s) => s.view === 'back')
    if (hasFront && !hasBack) {
      regions[id] = { ...r, shapes: [...r.shapes, ...r.shapes.filter((s) => s.view === 'front').map((s) => ({ ...s, view: 'back' as const }))] }
      changed = true
    } else if (hasBack && !hasFront) {
      regions[id] = { ...r, shapes: [...r.shapes, ...r.shapes.filter((s) => s.view === 'back').map((s) => ({ ...s, view: 'front' as const }))] }
      changed = true
    } else {
      regions[id] = r
    }
  }
  return changed ? { ...garment, regions } : garment
}

function normViews(raw: unknown): GarmentView[] {
  let w = 400
  let h = 560
  if (Array.isArray(raw) && raw[0] && typeof raw[0] === 'object') {
    const vb = (raw[0] as { viewBox?: { w?: unknown; h?: unknown } }).viewBox
    if (vb) {
      w = asNum(vb.w, 400)
      h = asNum(vb.h, 560)
    }
  }
  // Always front + back — the mandatory contract.
  return [
    { id: 'front', label: 'Front', viewBox: { w, h } },
    { id: 'back', label: 'Back', viewBox: { w, h } },
  ]
}

/**
 * Repair arbitrary model output into a valid editable garment (front + back). Returns null only
 * when there is no usable geometry at all — the caller then retries or falls back to a template.
 */
export function normalizeGarment(input: unknown): EditableGarment | null {
  if (!input || typeof input !== 'object') return null
  const wrapper = input as Record<string, unknown>
  // Unwrap { garment: {...} } shapes some models return.
  const src = (wrapper.garment && typeof wrapper.garment === 'object' ? wrapper.garment : wrapper) as Record<string, unknown>

  const rawRegions = (src.regions && typeof src.regions === 'object' ? src.regions : {}) as Record<string, unknown>
  const regions: Record<string, GarmentRegion> = {}
  for (const [id, value] of Object.entries(rawRegions)) {
    if (!value || typeof value !== 'object') continue
    const r = value as Record<string, unknown>
    const shapes = Array.isArray(r.shapes) ? (r.shapes.map(coerceShape).filter(Boolean) as RegionShape[]) : []
    if (shapes.length === 0) continue // drop regions with no usable geometry
    const type = coerceType(r.type)
    regions[id] = {
      id,
      name: asStr(r.name, id),
      type,
      children: Array.isArray(r.children) ? (r.children.filter((c) => typeof c === 'string') as string[]) : [],
      shapes,
      visible: r.visible !== false,
      locked: r.locked === true,
      capabilities: defaultCapabilities(type),
    }
  }

  const validIds = Object.keys(regions)
  if (validIds.length === 0) return null

  // Build a strict acyclic forest: children must exist, not be self, have a single parent, and
  // never form a cycle (a cyclic tree would make the region walker recurse forever and crash).
  const parent = new Map<string, string>()
  const isAncestor = (a: string, b: string): boolean => {
    let cur: string | undefined = b
    let guard = 0
    while (cur !== undefined && guard++ <= validIds.length) {
      cur = parent.get(cur)
      if (cur === a) return true
    }
    return false
  }
  for (const [pid, r] of Object.entries(regions)) {
    const kept: string[] = []
    for (const c of r.children) {
      if (!regions[c] || c === pid || parent.has(c) || isAncestor(c, pid)) continue
      parent.set(c, pid)
      kept.push(c)
    }
    r.children = kept
  }

  // rootIds: honor the model's order, then append any region that isn't someone's child.
  const childSet = new Set(Object.values(regions).flatMap((r) => r.children))
  const rootIds = (Array.isArray(src.rootIds) ? (src.rootIds as unknown[]).filter((id): id is string => typeof id === 'string' && !!regions[id]) : []) as string[]
  for (const id of validIds) if (!childSet.has(id) && !rootIds.includes(id)) rootIds.push(id)
  const finalRoots = rootIds.length > 0 ? rootIds : validIds

  const garment: EditableGarment = {
    format: EDITABLE_GARMENT_FORMAT,
    version: EDITABLE_GARMENT_VERSION,
    id: asStr(src.id) || 'ai-garment',
    name: asStr(src.name, 'AI Garment'),
    category: asStr(src.category, 'Custom'),
    style: TECH_FLAT.id,
    views: normViews(src.views),
    rootIds: finalRoots,
    regions,
    source: { kind: 'reference' },
    createdAt: 0,
  }
  return ensureBothViews(garment)
}
