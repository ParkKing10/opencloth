/**
 * Per-user graphics asset store, backed by IndexedDB.
 *
 * Assets live here, SEPARATE from designs. When an asset is placed on a garment the project
 * embeds its OWN copy of the pixels (see the studio's placeAsset), so: the same asset can be
 * used unlimited times as independent instances, editing one never touches another, and
 * deleting a library asset never affects existing projects. (Cross-device sync via Supabase
 * Storage is a future enhancement; today the library is per-user on this browser.)
 */
export type AssetKind = 'raster' | 'vector'

export type Asset = {
  id: string
  userId: string
  filename: string
  /** MIME type, e.g. image/png, image/svg+xml. */
  type: string
  kind: AssetKind
  /** Optional grouping, e.g. 'campaign' for AI campaign photos. Absent for user uploads. */
  category?: string
  width: number
  height: number
  /** Bytes. */
  size: number
  createdAt: number
  lastUsedAt: number
  favorite: boolean
  /** The full-resolution asset. */
  blob: Blob
  /** A small thumbnail for the grid (raster); for SVG this is the SVG blob itself (vector). */
  thumb: Blob
}

const DB_NAME = 'threados-assets'
const STORE = 'assets'
const VERSION = 1

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

export async function putAsset(asset: Asset): Promise<void> {
  const db = await openDb()
  await reqToPromise(tx(db, 'readwrite').put(asset))
}

/** All assets for a user, newest first. */
export async function listAssets(userId: string): Promise<Asset[]> {
  const db = await openDb()
  const idx = tx(db, 'readonly').index('userId')
  const all = await reqToPromise<Asset[]>(idx.getAll(userId))
  return all.sort((a, b) => b.createdAt - a.createdAt)
}

export async function getAsset(id: string): Promise<Asset | undefined> {
  const db = await openDb()
  return reqToPromise<Asset | undefined>(tx(db, 'readonly').get(id))
}

/** Merge a partial update into an existing asset. */
export async function patchAsset(id: string, patch: Partial<Asset>): Promise<Asset | undefined> {
  const db = await openDb()
  const store = tx(db, 'readwrite')
  const current = await reqToPromise<Asset | undefined>(store.get(id))
  if (!current) return undefined
  const next = { ...current, ...patch }
  await reqToPromise(store.put(next))
  return next
}

export async function deleteAsset(id: string): Promise<void> {
  const db = await openDb()
  await reqToPromise(tx(db, 'readwrite').delete(id))
}

/** Record that an asset was just used (drives the Recent list). Fire-and-forget safe. */
export async function touchAsset(id: string): Promise<void> {
  await patchAsset(id, { lastUsedAt: Date.now() }).catch(() => undefined)
}
