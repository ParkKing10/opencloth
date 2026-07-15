/* ============================================================
   Cross-device document sync (Supabase `user_documents` table).
   Design docs, garment histories, backdrop images and the garment
   index are device-local first (localStorage / IndexedDB) — this
   module pushes them to the cloud in the background and pulls them
   on demand when another device asks for content it doesn't have.

   Requires the one-time migration supabase/user-documents.sql.
   Degrades gracefully: without Supabase (or before the migration)
   everything keeps working device-local; a missing table logs one
   console warning instead of spamming errors.
   ============================================================ */

import { supabase, isSupabaseConfigured } from '../../lib/supabase'

const SUPA = isSupabaseConfigured ? supabase : null
const TABLE = 'user_documents'
const DEBOUNCE_MS = 2500

let sessionUserId: string | null = null
let tableMissing = false
let warnedMissing = false

/** The signed-in Supabase user id — set by the store on hydrate/sign-out. */
export function setSyncSession(userId: string | null): void {
  sessionUserId = userId
}

export function cloudAvailable(): boolean {
  return !!SUPA && !!sessionUserId && !tableMissing
}

function noteError(e: unknown): void {
  const msg = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e)
  // Table not created yet → remember and stay quiet (single hint), everything stays local.
  if (/user_documents/.test(msg) || /relation .* does not exist/i.test(msg) || /42P01/.test(msg)) {
    tableMissing = true
    if (!warnedMissing) {
      warnedMissing = true
      console.warn('[docSync] user_documents table missing — run supabase/user-documents.sql to enable cross-device sync.')
    }
    return
  }
  console.error('[docSync] push/pull failed:', e)
  window.dispatchEvent(new CustomEvent('loom:sync-error', { detail: 'cloud' }))
}

// One trailing-debounce timer per key so drag-heavy editing doesn't spam the API.
const timers = new Map<string, number>()
const pendingPayload = new Map<string, string>()

async function upload(key: string): Promise<void> {
  const content = pendingPayload.get(key)
  pendingPayload.delete(key)
  if (!SUPA || !sessionUserId || tableMissing || content === undefined) return
  try {
    const { error } = await SUPA.from(TABLE).upsert(
      { owner_id: sessionUserId, key, content, updated_at: Date.now() },
      { onConflict: 'owner_id,key' },
    )
    if (error) noteError(error)
  } catch (e) {
    noteError(e)
  }
}

/** Queue a document for cloud upload (trailing debounce per key). `content` is JSON-stringified. */
export function pushDocument(key: string, content: unknown, debounceMs: number = DEBOUNCE_MS): void {
  if (!SUPA || !sessionUserId || tableMissing) return
  try {
    pendingPayload.set(key, JSON.stringify(content))
  } catch {
    return // unserializable — nothing sane to sync
  }
  const existing = timers.get(key)
  if (existing) window.clearTimeout(existing)
  timers.set(
    key,
    window.setTimeout(() => {
      timers.delete(key)
      void upload(key)
    }, debounceMs),
  )
}

/** Fetch one document; null when absent, unavailable or unparsable. */
export async function pullDocument<T = unknown>(key: string): Promise<T | null> {
  if (!SUPA || !sessionUserId || tableMissing) return null
  try {
    const { data, error } = await SUPA.from(TABLE)
      .select('content')
      .eq('owner_id', sessionUserId)
      .eq('key', key)
      .maybeSingle()
    if (error) {
      noteError(error)
      return null
    }
    if (!data?.content) return null
    return JSON.parse(data.content) as T
  } catch (e) {
    noteError(e)
    return null
  }
}

/** Remove a document from the cloud (fire-and-forget, e.g. on delete). */
export function deleteDocument(key: string): void {
  if (!SUPA || !sessionUserId || tableMissing) return
  void SUPA.from(TABLE)
    .delete()
    .eq('owner_id', sessionUserId)
    .eq('key', key)
    .then(({ error }) => {
      if (error) noteError(error)
    })
}
