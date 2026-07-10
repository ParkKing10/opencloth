import { describe, it, expect, beforeEach } from 'vitest'
import { saveHistory, loadHistory } from './garmentDocumentStore'
import { initHistory, commit } from './garmentRevision'
import { makeReferenceBomber } from './referenceGarment'

// localStorage stub. `limitBytes` lets a test force QuotaExceededError above a size.
class MemoryStorage {
  private m = new Map<string, string>()
  limitBytes = Infinity
  getItem(k: string): string | null {
    return this.m.has(k) ? (this.m.get(k) as string) : null
  }
  setItem(k: string, v: string): void {
    if (v.length > this.limitBytes) {
      const err = new Error('QuotaExceededError')
      err.name = 'QuotaExceededError'
      throw err
    }
    this.m.set(k, String(v))
  }
  removeItem(k: string): void {
    this.m.delete(k)
  }
  clear(): void {
    this.m.clear()
  }
}

let store: MemoryStorage
beforeEach(() => {
  store = new MemoryStorage()
  ;(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = store
})

function buildHistory(n: number) {
  let h = initHistory(makeReferenceBomber())
  for (let i = 0; i < n; i += 1) h = commit(h, makeReferenceBomber(), { kind: 'manual', label: `edit ${i}` })
  return h
}

describe('garmentDocumentStore', () => {
  it('round-trips a history through storage', () => {
    const h = buildHistory(3)
    const res = saveHistory(h)
    expect(res.ok).toBe(true)
    const back = loadHistory(h.garmentId)
    expect(back?.revisions).toHaveLength(4)
    expect(back?.currentIndex).toBe(3)
  })

  it('recovers cleanly (returns null) when the stored revisions array contains null/garbage', () => {
    localStorage.setItem('threados-garment-doc-reference-bomber', JSON.stringify({ garmentId: 'reference-bomber', revisions: [null, { garment: {} }], currentIndex: 1 }))
    expect(loadHistory('reference-bomber')).toBeNull()
  })

  it('caps history to the max revisions, keeping the most recent + current', () => {
    const h = buildHistory(140) // 141 revisions
    saveHistory(h)
    const back = loadHistory(h.garmentId)
    expect(back!.revisions.length).toBeLessThanOrEqual(100)
    // the current revision is preserved and the pointer stays valid
    expect(back!.currentIndex).toBeGreaterThanOrEqual(0)
    expect(back!.currentIndex).toBeLessThan(back!.revisions.length)
  })

  it('prunes and retries instead of silently losing newest edits when quota is exceeded', () => {
    const h = buildHistory(60)
    store.limitBytes = 40000 // force quota failures until enough is pruned
    const res = saveHistory(h)
    expect(res.ok).toBe(true)
    expect(res.pruned).toBeGreaterThan(0)
    const back = loadHistory(h.garmentId)
    expect(back).not.toBeNull()
    // the most recent revision survived the prune-and-retry
    expect(back!.revisions[back!.revisions.length - 1].source).toEqual(h.revisions[h.revisions.length - 1].source)
  })
})
