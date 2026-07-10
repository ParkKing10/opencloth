import { useEffect, useState } from 'react'

export type StorageEstimate = {
  /** Real bytes used by this origin, browser-reported. */
  usedBytes: number
  /** Real quota the browser grants this origin, in bytes (0 if unknown). */
  quotaBytes: number
  /** 0–100, or null when the browser won't report a quota. */
  pct: number | null
  /** e.g. "4.2 MB". */
  usedLabel: string
  /** e.g. "4.2 MB / 2.1 GB" or "4.2 MB" when no quota is known. */
  label: string
  ready: boolean
}

const EMPTY: StorageEstimate = {
  usedBytes: 0,
  quotaBytes: 0,
  pct: null,
  usedLabel: '—',
  label: '—',
  ready: false,
}

/** Human-readable byte size, e.g. 4200000 → "4.0 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`
  const mb = kb / 1024
  if (mb < 1024) return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`
  const gb = mb / 1024
  return `${gb < 10 ? gb.toFixed(1) : Math.round(gb)} GB`
}

/** Sum of every localStorage entry's UTF-16 byte length — the fallback when the
 *  Storage API is unavailable. Approximate but real (never invented). */
function localStorageBytes(): number {
  let total = 0
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key) continue
      const value = localStorage.getItem(key) ?? ''
      total += (key.length + value.length) * 2
    }
  } catch {
    /* storage blocked — report 0 rather than a fake number */
  }
  return total
}

/**
 * Real per-origin storage usage. Prefers the Storage API (covers IndexedDB,
 * Cache and localStorage) and falls back to measuring localStorage directly.
 * Never fabricates a figure — an unknown quota surfaces as `pct: null`.
 */
export function useStorageEstimate(): StorageEstimate {
  const [est, setEst] = useState<StorageEstimate>(EMPTY)

  useEffect(() => {
    let cancelled = false

    const fromBytes = (usedBytes: number, quotaBytes: number): StorageEstimate => {
      const pct = quotaBytes > 0 ? Math.min(100, Math.round((usedBytes / quotaBytes) * 100)) : null
      const usedLabel = formatBytes(usedBytes)
      return {
        usedBytes,
        quotaBytes,
        pct,
        usedLabel,
        label: quotaBytes > 0 ? `${usedLabel} / ${formatBytes(quotaBytes)}` : usedLabel,
        ready: true,
      }
    }

    async function measure() {
      try {
        if (navigator.storage?.estimate) {
          const { usage, quota } = await navigator.storage.estimate()
          if (!cancelled && typeof usage === 'number') {
            setEst(fromBytes(usage, typeof quota === 'number' ? quota : 0))
            return
          }
        }
      } catch {
        /* fall through to the localStorage measurement */
      }
      if (!cancelled) setEst(fromBytes(localStorageBytes(), 0))
    }

    void measure()
    return () => {
      cancelled = true
    }
  }, [])

  return est
}
