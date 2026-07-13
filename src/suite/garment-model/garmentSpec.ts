/**
 * A structured garment SPEC — the honest contract for photo reconstruction.
 *
 * A vision model CANNOT faithfully trace a photo into SVG path geometry (it hallucinates paths).
 * It CAN reliably classify a garment and read its construction: type, length, sleeves, collar,
 * closure, pockets, dominant colours. So loom studios asks the model for THIS spec, then assembles the
 * editable garment from its own trusted templates (see specToGarment.ts). Clean, editable, front+back.
 *
 * Every field is a closed enum + a real 0–100 confidence FROM THE MODEL. Nothing is invented: an
 * out-of-enum value is treated as "not said" (confidence 0). Colours are captured but not painted —
 * the renderer is a monochrome technical flat today (garmentStyle.ts), so we report, never fake.
 */
export type GarmentTypeId =
  | 'jacket'
  | 'puffer'
  | 'coat'
  | 'parka'
  | 'blazer'
  | 'hoodie'
  | 'sweater'
  | 'cardigan'
  | 'tee'
  | 'polo'
  | 'tank'
  | 'dress'
  | 'skirt'
  | 'pants'
  | 'shorts'
  | 'jumpsuit'
  | 'unknown'
export type LengthId = 'cropped' | 'regular' | 'long'
export type SleevesId = 'sleeveless' | 'short' | 'long'
export type CollarId = 'none' | 'crew' | 'ribbed' | 'hood' | 'lapel'
export type ClosureId = 'none' | 'zip' | 'buttons' | 'snaps'
export type PocketsId = 'none' | 'side' | 'kangaroo' | 'chest'
export type PatternId = 'solid' | 'striped' | 'graphic'

export type SpecField<T> = { value: T; confidence: number }

export interface GarmentSpec {
  garmentType: SpecField<GarmentTypeId>
  length: SpecField<LengthId>
  sleeves: SpecField<SleevesId>
  collar: SpecField<CollarId>
  closure: SpecField<ClosureId>
  pockets: SpecField<PocketsId>
  primaryColor?: SpecField<string>
  secondaryColor?: SpecField<string>
  pattern?: SpecField<PatternId>
}

const TYPES: GarmentTypeId[] = ['jacket', 'puffer', 'coat', 'parka', 'blazer', 'hoodie', 'sweater', 'cardigan', 'tee', 'polo', 'tank', 'dress', 'skirt', 'pants', 'shorts', 'jumpsuit', 'unknown']
const LENGTHS: LengthId[] = ['cropped', 'regular', 'long']
const SLEEVES: SleevesId[] = ['sleeveless', 'short', 'long']
const COLLARS: CollarId[] = ['none', 'crew', 'ribbed', 'hood', 'lapel']
const CLOSURES: ClosureId[] = ['none', 'zip', 'buttons', 'snaps']
const POCKETS: PocketsId[] = ['none', 'side', 'kangaroo', 'chest']
const PATTERNS: PatternId[] = ['solid', 'striped', 'graphic']

const clampConf = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0

/** Read one enum field. `provided` is true only when the model gave a genuine in-enum value. */
function pick<T extends string>(raw: unknown, allowed: T[], fallback: T): { field: SpecField<T>; provided: boolean } {
  const o = raw && typeof raw === 'object' ? (raw as { value?: unknown; confidence?: unknown }) : {}
  const provided = typeof o.value === 'string' && (allowed as string[]).includes(o.value)
  const value = provided ? (o.value as T) : fallback
  return { field: { value, confidence: provided ? clampConf(o.confidence) : 0 }, provided }
}

function color(raw: unknown): SpecField<string> | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as { value?: unknown; confidence?: unknown }
  if (typeof o.value !== 'string' || !o.value.trim()) return undefined
  return { value: o.value.trim().slice(0, 40), confidence: clampConf(o.confidence) }
}

/**
 * Coerce arbitrary model JSON into a GarmentSpec. Returns null ONLY when there is no usable signal
 * (not an object, or the model recognised nothing). Missing/invalid fields become sensible defaults
 * at confidence 0, so they are never shown as if the model were certain.
 */
export function coerceSpec(input: unknown): GarmentSpec | null {
  if (!input || typeof input !== 'object') return null
  // Some models wrap it: { spec: {...} } or { garment: {...} }.
  const o = input as Record<string, unknown>
  const src = (o.spec && typeof o.spec === 'object' ? o.spec : o) as Record<string, unknown>

  const garmentType = pick(src.garmentType, TYPES, 'unknown')
  const length = pick(src.length, LENGTHS, 'regular')
  const sleeves = pick(src.sleeves, SLEEVES, 'long')
  const collar = pick(src.collar, COLLARS, 'none')
  const closure = pick(src.closure, CLOSURES, 'none')
  const pockets = pick(src.pockets, POCKETS, 'none')
  const primaryColor = color(src.primaryColor)
  const secondaryColor = color(src.secondaryColor)
  const pat = pick(src.pattern, PATTERNS, 'solid')

  const anySignal =
    [garmentType, length, sleeves, collar, closure, pockets, pat].some((f) => f.provided) || !!primaryColor
  if (!anySignal) return null

  return {
    garmentType: garmentType.field,
    length: length.field,
    sleeves: sleeves.field,
    collar: collar.field,
    closure: closure.field,
    pockets: pockets.field,
    primaryColor,
    secondaryColor,
    pattern: pat.provided ? pat.field : undefined,
  }
}

const cap = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

/**
 * Notes for the review screen. Colour IS now painted onto the flat (per region, editable). Pattern
 * (stripes / graphics) is still only detected, not drawn — reported honestly, never faked.
 */
export function colorNotesFromSpec(spec?: GarmentSpec): string[] {
  if (!spec) return []
  const notes: string[] = []
  if (spec.primaryColor) {
    const second = spec.secondaryColor ? ` + ${cap(spec.secondaryColor.value)}` : ''
    notes.push(
      `Colour · ${cap(spec.primaryColor.value)}${second} — applied to the flat. Change any region's colour in the inspector.`,
    )
  }
  if (spec.pattern && spec.pattern.value !== 'solid') {
    notes.push(`Pattern · ${cap(spec.pattern.value)} detected — noted, but stripes/graphics aren't drawn yet.`)
  }
  return notes
}
