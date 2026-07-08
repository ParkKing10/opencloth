/**
 * Brand Kit + Brand Memory.
 * The kit is the account's brand defaults (one row per user); every new project
 * loads them. Memory counts the choices a designer actually makes and, once a
 * pattern repeats, recommends "your usual spec" — it can be disabled anytime.
 */
import { supabase, isSupabaseConfigured } from '../../lib/supabase'

export type BrandKit = {
  brandName: string
  primaryFont: string
  secondaryFont: string
  colors: string[]
  defaultFabric: string
  defaultFit: string
  defaultLabels: string
  packagingNotes: string
  brandNotes: string
  memoryEnabled: boolean
  /** Choice counters, e.g. { "fit:Oversized": 4, "weight:450 GSM": 3 } */
  memory: Record<string, number>
}

export const DEFAULT_KIT: BrandKit = {
  brandName: '',
  primaryFont: 'Inter',
  secondaryFont: 'Space Grotesk',
  colors: ['#D8FF3E', '#14141A', '#F4F4F6'],
  defaultFabric: 'French Terry 450 GSM',
  defaultFit: 'Oversized',
  defaultLabels: 'Woven neck label + heat-transfer care label',
  packagingNotes: '',
  brandNotes: '',
  memoryEnabled: true,
  memory: {},
}

const SUPA = isSupabaseConfigured ? supabase : null
const LOCAL_KEY = 'threados-brandkit-v1'

function fromLocal(): BrandKit {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (raw) return { ...DEFAULT_KIT, ...(JSON.parse(raw) as Partial<BrandKit>) }
  } catch {
    /* fall through */
  }
  return DEFAULT_KIT
}

function toLocal(kit: BrandKit): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(kit))
  } catch {
    /* ignore quota */
  }
}

type Row = Record<string, unknown>

function rowToKit(r: Row): BrandKit {
  return {
    brandName: String(r.brand_name ?? ''),
    primaryFont: String(r.primary_font ?? DEFAULT_KIT.primaryFont),
    secondaryFont: String(r.secondary_font ?? DEFAULT_KIT.secondaryFont),
    colors: Array.isArray(r.colors) ? (r.colors as string[]) : DEFAULT_KIT.colors,
    defaultFabric: String(r.default_fabric ?? DEFAULT_KIT.defaultFabric),
    defaultFit: String(r.default_fit ?? DEFAULT_KIT.defaultFit),
    defaultLabels: String(r.default_labels ?? DEFAULT_KIT.defaultLabels),
    packagingNotes: String(r.packaging_notes ?? ''),
    brandNotes: String(r.brand_notes ?? ''),
    memoryEnabled: r.memory_enabled !== false,
    memory: (r.memory as Record<string, number>) ?? {},
  }
}

function kitToRow(kit: BrandKit, ownerId: string): Row {
  return {
    owner_id: ownerId,
    brand_name: kit.brandName,
    primary_font: kit.primaryFont,
    secondary_font: kit.secondaryFont,
    colors: kit.colors,
    default_fabric: kit.defaultFabric,
    default_fit: kit.defaultFit,
    default_labels: kit.defaultLabels,
    packaging_notes: kit.packagingNotes,
    brand_notes: kit.brandNotes,
    memory_enabled: kit.memoryEnabled,
    memory: kit.memory,
    updated_at: new Date().toISOString(),
  }
}

/** Load the account's brand kit (defaults when none saved yet). */
export async function loadBrandKit(): Promise<BrandKit> {
  if (!SUPA) return fromLocal()
  const {
    data: { session },
  } = await SUPA.auth.getSession()
  if (!session) return DEFAULT_KIT
  const { data, error } = await SUPA.from('brand_kits').select('*').eq('owner_id', session.user.id).maybeSingle()
  if (error) {
    console.error('[brand-kit] load:', error.message)
    return DEFAULT_KIT
  }
  return data ? rowToKit(data) : DEFAULT_KIT
}

/** Save (upsert) the account's brand kit. */
export async function saveBrandKit(kit: BrandKit): Promise<{ ok: boolean; error?: string }> {
  if (!SUPA) {
    toLocal(kit)
    return { ok: true }
  }
  const {
    data: { session },
  } = await SUPA.auth.getSession()
  if (!session) return { ok: false, error: 'Sign in to save your Brand Kit.' }
  const { error } = await SUPA.from('brand_kits').upsert(kitToRow(kit, session.user.id))
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ---------- Brand Memory ----------

/** Record a real design choice, e.g. record(kit, 'fit', 'Oversized'). */
export function recordChoice(kit: BrandKit, dimension: string, value: string): BrandKit {
  if (!kit.memoryEnabled || !value.trim()) return kit
  const key = `${dimension}:${value.trim()}`
  return { ...kit, memory: { ...kit.memory, [key]: (kit.memory[key] ?? 0) + 1 } }
}

export type MemoryPreference = { dimension: string; value: string; count: number }

/** The designer's repeated preferences (count ≥ 2), strongest first. */
export function derivePreferences(kit: BrandKit): MemoryPreference[] {
  if (!kit.memoryEnabled) return []
  const best = new Map<string, MemoryPreference>()
  for (const [key, count] of Object.entries(kit.memory)) {
    if (count < 2) continue
    const idx = key.indexOf(':')
    if (idx < 1) continue
    const dimension = key.slice(0, idx)
    const value = key.slice(idx + 1)
    const cur = best.get(dimension)
    if (!cur || count > cur.count) best.set(dimension, { dimension, value, count })
  }
  return [...best.values()].sort((a, b) => b.count - a.count)
}

/** One-line summary like "Oversized · 450 GSM · Vintage Black". */
export function preferenceSummary(prefs: MemoryPreference[]): string {
  return prefs
    .slice(0, 3)
    .map((p) => p.value)
    .join(' · ')
}
