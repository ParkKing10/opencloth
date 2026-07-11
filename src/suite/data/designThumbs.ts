/**
 * Local, Supabase-safe store for design preview thumbnails.
 *
 * Thumbnails are deliberately kept OUT of the `designs` table and the main data blob: that avoids a
 * schema migration (a public-repo Supabase deploy would break saving if a `thumbnail` column were
 * referenced but missing) and keeps the primary payload small. Instead we store a compact JPEG data
 * URL per design id in its own localStorage entry, capped with simple LRU eviction so we never blow
 * the storage quota. Tradeoff: thumbnails are device-local (not synced across devices) — an honest
 * price for zero-risk previews. A missing thumbnail is always non-fatal (callers fall back to the
 * garment glyph).
 */
const PREFIX = 'threados-thumb-'
const INDEX_KEY = 'threados-thumb-index'
const CAP = 48

function readIndex(): string[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function writeIndex(ids: string[]): void {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(ids))
  } catch {
    /* ignore — index is a best-effort convenience */
  }
}

/** The thumbnail data URL for a design, or null if none has been captured. */
export function loadDesignThumb(id: string): string | null {
  try {
    return localStorage.getItem(PREFIX + id)
  } catch {
    return null
  }
}

/** Drop a design's thumbnail (e.g. when the design is deleted). */
export function removeDesignThumb(id: string): void {
  try {
    localStorage.removeItem(PREFIX + id)
  } catch {
    /* ignore */
  }
  writeIndex(readIndex().filter((x) => x !== id))
}

/** Store/refresh a design's thumbnail, evicting the oldest entries past the cap or on quota errors. */
export function saveDesignThumb(id: string, dataUrl: string): void {
  const put = () => {
    localStorage.setItem(PREFIX + id, dataUrl)
    const ids = [id, ...readIndex().filter((x) => x !== id)]
    while (ids.length > CAP) {
      const evicted = ids.pop()
      if (evicted) {
        try {
          localStorage.removeItem(PREFIX + evicted)
        } catch {
          /* ignore */
        }
      }
    }
    writeIndex(ids)
  }
  try {
    put()
  } catch {
    // Quota hit — drop the oldest half and retry once. If it still fails, give up silently.
    try {
      const ids = readIndex()
      const keep = ids.slice(0, Math.max(0, Math.floor(ids.length / 2)))
      ids.slice(keep.length).forEach((x) => {
        try {
          localStorage.removeItem(PREFIX + x)
        } catch {
          /* ignore */
        }
      })
      writeIndex(keep)
      put()
    } catch {
      /* a missing thumbnail is non-fatal */
    }
  }
}
