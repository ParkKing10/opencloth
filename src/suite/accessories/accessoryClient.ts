/**
 * Accessory Library data layer — the shared, admin-curated accessories every user can drop onto a
 * garment for free (hats, jewelry, bags, patches…). Dual-mode, mirroring garmentClient's contract:
 *
 *  - Supabase mode: rows in the `accessories` table (shared across ALL users). Images are stored
 *    inline as data URLs — accessories are small graphics, so this needs no storage bucket.
 *  - Fallback (no backend, or the table isn't migrated yet): localStorage, so it works offline and
 *    before the one-time migration. Every Supabase call degrades to local on error.
 *
 * Run supabase/schema.sql's `accessories` table + policies once to make the library cross-user.
 */
import { supabase, isSupabaseConfigured } from '../../lib/supabase'

const SUPA = isSupabaseConfigured ? supabase : null
const LOCAL_KEY = 'threados-accessories-v1'

export type AccessoryCategory = { id: string; label: string }

/** Fixed accessory categories — shown as filter chips in the admin panel and the studio rail. */
export const ACCESSORY_CATEGORIES: AccessoryCategory[] = [
  { id: 'hats-caps', label: 'Hats & Caps' },
  { id: 'jewelry', label: 'Jewelry' },
  { id: 'bags', label: 'Bags' },
  { id: 'eyewear', label: 'Eyewear' },
  { id: 'belts', label: 'Belts' },
  { id: 'patches', label: 'Patches & Pins' },
  { id: 'other', label: 'Other' },
]

export function accessoryCategoryLabel(id: string): string {
  return ACCESSORY_CATEGORIES.find((c) => c.id === id)?.label ?? 'Other'
}

export type Accessory = { id: string; name: string; category: string; image: string; createdAt: number }
export type AccessoryResult<T> = { ok: true; value: T } | { ok: false; error: string }

// ── localStorage fallback ───────────────────────────────────────────────────────────────────────
function readLocal(): Accessory[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    return raw ? (JSON.parse(raw) as Accessory[]) : []
  } catch {
    return []
  }
}
function writeLocal(list: Accessory[]): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list))
  } catch {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(list.slice(0, 60)))
    } catch {
      /* give up quietly */
    }
  }
}

function rid(): string {
  return `acc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

type Row = Record<string, unknown>
function rowToAccessory(r: Row): Accessory {
  return {
    id: String(r.id),
    name: String(r.name ?? 'Accessory'),
    category: String(r.category ?? 'other'),
    image: String(r.image ?? ''),
    createdAt: Date.parse(String(r.created_at)) || Date.now(),
  }
}

/** True when the shared Supabase table is reachable (i.e. the migration has been applied). */
export async function accessoriesShared(): Promise<boolean> {
  if (!SUPA) return false
  try {
    const { error } = await SUPA.from('accessories').select('id').limit(1)
    return !error
  } catch {
    return false
  }
}

export async function listAccessories(): Promise<Accessory[]> {
  if (SUPA) {
    try {
      const { data, error } = await SUPA.from('accessories').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return (data as Row[]).map(rowToAccessory)
    } catch {
      return readLocal()
    }
  }
  return readLocal()
}

export async function publishAccessories(
  items: { name: string; category: string; image: string }[],
): Promise<AccessoryResult<{ published: number }>> {
  const clean = items.filter((i) => i.image)
  if (clean.length === 0) return { ok: false, error: 'No accessories to publish.' }
  if (SUPA) {
    try {
      const {
        data: { session },
      } = await SUPA.auth.getSession()
      const uid = session?.user.id ?? null
      const rows = clean.map((i) => ({ name: i.name || 'Accessory', category: i.category || 'other', image: i.image, created_by: uid }))
      const { error } = await SUPA.from('accessories').insert(rows)
      if (error) throw error
      return { ok: true, value: { published: clean.length } }
    } catch {
      /* fall back to local */
    }
  }
  const existing = readLocal()
  const now = Date.now()
  clean.forEach((i, idx) => existing.unshift({ id: rid(), name: i.name || 'Accessory', category: i.category || 'other', image: i.image, createdAt: now - idx }))
  writeLocal(existing)
  return { ok: true, value: { published: clean.length } }
}

export async function deleteAccessory(id: string): Promise<AccessoryResult<null>> {
  if (SUPA) {
    try {
      const { error } = await SUPA.from('accessories').delete().eq('id', id)
      if (error) throw error
      return { ok: true, value: null }
    } catch {
      /* fall back to local */
    }
  }
  writeLocal(readLocal().filter((a) => a.id !== id))
  return { ok: true, value: null }
}

export async function deleteAllAccessories(): Promise<AccessoryResult<{ deleted: number }>> {
  if (SUPA) {
    try {
      const { data, error } = await SUPA.from('accessories').select('id')
      if (error) throw error
      const ids = ((data as Row[]) ?? []).map((r) => String(r.id))
      if (ids.length) {
        const { error: delErr } = await SUPA.from('accessories').delete().in('id', ids)
        if (delErr) throw delErr
      }
      return { ok: true, value: { deleted: ids.length } }
    } catch {
      /* fall back to local */
    }
  }
  const deleted = readLocal().length
  writeLocal([])
  return { ok: true, value: { deleted } }
}
