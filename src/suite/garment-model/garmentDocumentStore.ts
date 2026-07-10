/**
 * Persists the full garment history (all revisions + the current pointer) so manual and AI
 * edits, the timeline, and version switching all survive reloads. Keyed per garment id.
 *
 * Because every revision stores a full garment snapshot, the history could in principle outgrow
 * the localStorage quota. Rather than silently losing the newest edits, saveHistory prunes the
 * OLDEST revisions (keeping the current one) and retries — so recent work always persists, and
 * pruning is reported to the caller instead of hidden.
 */
import { isEditableGarment } from './editableGarment'
import type { GarmentHistory, GarmentRevision } from './garmentRevision'

const KEY_PREFIX = 'threados-garment-doc-'
/** Hard cap so history can never grow unbounded in storage. */
const MAX_REVISIONS = 100

export type SaveResult = { ok: boolean; pruned: number }

function isValidRevision(r: unknown): r is GarmentRevision {
  return !!r && typeof r === 'object' && isEditableGarment((r as GarmentRevision).garment)
}

/** Drop the oldest revisions to at most `limit`, keeping the current one and fixing the pointer. */
function pruneOldest(history: GarmentHistory, limit: number): GarmentHistory {
  if (history.revisions.length <= limit) return history
  const drop = history.revisions.length - limit
  // Never drop past the current pointer — keep the active revision and everything after it.
  const start = Math.min(drop, history.currentIndex)
  const revisions = history.revisions.slice(start)
  return { ...history, revisions, currentIndex: history.currentIndex - start }
}

export function saveHistory(history: GarmentHistory): SaveResult {
  let toStore = pruneOldest(history, MAX_REVISIONS)
  let pruned = history.revisions.length - toStore.revisions.length

  // Retry, shedding older revisions, if the browser rejects the write (quota exceeded).
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      localStorage.setItem(KEY_PREFIX + history.garmentId, JSON.stringify(toStore))
      return { ok: true, pruned }
    } catch {
      if (toStore.revisions.length <= 1) return { ok: false, pruned }
      const nextLimit = Math.max(1, Math.floor(toStore.revisions.length / 2))
      const next = pruneOldest(toStore, nextLimit)
      pruned += toStore.revisions.length - next.revisions.length
      toStore = next
    }
  }
  return { ok: false, pruned }
}

export function deleteHistory(garmentId: string): void {
  try {
    localStorage.removeItem(KEY_PREFIX + garmentId)
  } catch {
    /* non-fatal */
  }
}

export function loadHistory(garmentId: string): GarmentHistory | null {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + garmentId)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<GarmentHistory>
    if (
      !parsed ||
      !Array.isArray(parsed.revisions) ||
      parsed.revisions.length === 0 ||
      typeof parsed.currentIndex !== 'number' ||
      !parsed.revisions.every(isValidRevision) // null/undefined/malformed elements → treat as corrupt
    ) {
      return null
    }
    const currentIndex = Math.max(0, Math.min(parsed.revisions.length - 1, parsed.currentIndex))
    return { garmentId: parsed.garmentId ?? garmentId, revisions: parsed.revisions, currentIndex }
  } catch {
    return null
  }
}
