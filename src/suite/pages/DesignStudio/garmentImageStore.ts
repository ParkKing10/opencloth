/**
 * Garment-edit image store (IndexedDB). The AI garment-edit backdrop is a multi-MB base64 data URL —
 * far too big to keep inside the design doc's localStorage entry. Inlining it silently blew the ~5MB
 * origin quota (the doc save failed, was swallowed, and shown as "Saved"), so the AI garment vanished
 * on reload. It lives here instead, keyed by garment id; the doc keeps only a lightweight key.
 * Images ALSO sync to the cloud (user_documents, key img:<key>) so a design's backdrop follows
 * the user to other devices; reads fall back to the cloud and re-cache locally.
 */
import { pushDocument, pullDocument, cloudAvailable } from '../../lib/docSync'

const DB_NAME = 'threados-garment-images'
const STORE = 'images'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
  })
  return dbPromise
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'))
  })
}

/** Persist a garment-edit image (data URL) under its garment id. Non-fatal on failure. */
export async function putGarmentImage(key: string, dataUrl: string, opts?: { skipCloud?: boolean }): Promise<void> {
  try {
    const db = await openDb()
    await reqToPromise(db.transaction(STORE, 'readwrite').objectStore(STORE).put(dataUrl, key))
  } catch {
    /* non-fatal */
  }
  // Backdrop applies are rare — push promptly so the image follows the user.
  if (!opts?.skipCloud) pushDocument(`img:${key}`, dataUrl, 500)
}

/** Read a garment-edit image (data URL) by garment id — local first, then the cloud
 *  (another device generated it), re-caching locally on a hit. */
export async function getGarmentImage(key: string): Promise<string | null> {
  try {
    const db = await openDb()
    const v = await reqToPromise(db.transaction(STORE, 'readonly').objectStore(STORE).get(key))
    if (typeof v === 'string') return v
  } catch {
    /* fall through to cloud */
  }
  if (!cloudAvailable()) return null
  const remote = await pullDocument<string>(`img:${key}`)
  if (typeof remote !== 'string' || !remote.startsWith('data:')) return null
  void putGarmentImage(key, remote, { skipCloud: true })
  return remote
}

/** Remove a garment-edit image by garment id. Non-fatal on failure. */
export async function delGarmentImage(key: string): Promise<void> {
  try {
    const db = await openDb()
    await reqToPromise(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(key))
  } catch {
    /* non-fatal */
  }
}
