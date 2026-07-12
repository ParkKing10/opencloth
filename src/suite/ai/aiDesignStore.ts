/**
 * The AI Designer's own library, backed by IndexedDB (data URLs — full-res PNGs are far too big for
 * localStorage). Every AI-generated garment lands here automatically: front + back renders, plus any
 * on-model "real-life" photos the user asks for. Per-user, per-browser (Supabase sync is a future add).
 */
export type AIDesign = {
  id: string
  userId: string
  name: string
  prompt: string
  style: string
  type: string
  /** Front render (data URL). */
  frontUrl: string
  /** Back render (data URL) — the AI Designer always produces front AND back. */
  backUrl: string
  /** On-model "real-life" photos generated on demand (data URLs). */
  modelUrls: string[]
  favorite: boolean
  createdAt: number
}

const DB_NAME = 'threados-ai-designs'
const STORE = 'designs'
const VERSION = 1

/** Fired after the library changes so an open AI Designer view can refresh live. */
export const AI_DESIGNS_CHANGED_EVENT = 'threados:ai-designs-changed'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: 'id' })
        os.createIndex('userId', 'userId', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
  })
  return dbPromise
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE, mode).objectStore(STORE)
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'))
  })
}

function emitChange(): void {
  try {
    window.dispatchEvent(new Event(AI_DESIGNS_CHANGED_EVENT))
  } catch {
    /* non-DOM env — ignore */
  }
}

export async function saveDesign(design: AIDesign): Promise<void> {
  const db = await openDb()
  await reqToPromise(tx(db, 'readwrite').put(design))
  emitChange()
}

/** Every AI design for a user, newest first. */
export async function listDesigns(userId: string): Promise<AIDesign[]> {
  const db = await openDb()
  const idx = tx(db, 'readonly').index('userId')
  const all = await reqToPromise<AIDesign[]>(idx.getAll(userId))
  return all.sort((a, b) => b.createdAt - a.createdAt)
}

export async function patchDesign(id: string, patch: Partial<AIDesign>): Promise<AIDesign | undefined> {
  const db = await openDb()
  const store = tx(db, 'readwrite')
  const current = await reqToPromise<AIDesign | undefined>(store.get(id))
  if (!current) return undefined
  const next = { ...current, ...patch }
  await reqToPromise(store.put(next))
  emitChange()
  return next
}

export async function deleteDesign(id: string): Promise<void> {
  const db = await openDb()
  await reqToPromise(tx(db, 'readwrite').delete(id))
  emitChange()
}
