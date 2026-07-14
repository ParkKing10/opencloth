/* ============================================================
   Motion engine — asset store.
   Uploaded screenshots / logos live in IndexedDB (NOT localStorage
   — image payloads blew the quota there before) plus an in-memory
   HTMLImageElement cache so the render loop can draw synchronously.
   ============================================================ */

import { uid, type Project } from '../types'

const DB_NAME = 'loom-explainer-assets'
const STORE = 'assets'

export type AssetMeta = { id: string; name: string; addedAt: number }
type AssetRow = AssetMeta & { dataUrl: string }

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB unavailable'))
  })
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const req = run(t.objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'))
        t.oncomplete = () => db.close()
      }),
  )
}

/* in-memory image cache the renderer reads synchronously */
const imgCache = new Map<string, HTMLImageElement>()

function warmCache(id: string, dataUrl: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      imgCache.set(id, img)
      resolve()
    }
    img.onerror = () => resolve() // undrawable asset → renderer shows the placeholder
    img.src = dataUrl
  })
}

/** Read a file, downscaling anything huge so IndexedDB and the canvas stay fast. */
async function fileToDataUrl(file: File): Promise<string> {
  const raw = await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('Could not read the file.'))
    r.readAsDataURL(file)
  })
  if (file.size <= 1.2 * 1024 * 1024) return raw // small files (logos, PNGs with alpha) stay untouched
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = () => reject(new Error('Not a readable image.'))
    i.src = raw
  })
  const MAX = 1600
  const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.87)
}

export async function saveAsset(file: File): Promise<AssetMeta> {
  const dataUrl = await fileToDataUrl(file)
  const row: AssetRow = { id: uid(), name: file.name.slice(0, 60) || 'image', addedAt: Date.now(), dataUrl }
  await tx('readwrite', (s) => s.put(row))
  await warmCache(row.id, dataUrl)
  return { id: row.id, name: row.name, addedAt: row.addedAt }
}

export async function listAssets(): Promise<AssetMeta[]> {
  try {
    const rows = await tx<AssetRow[]>('readonly', (s) => s.getAll() as IDBRequest<AssetRow[]>)
    return rows.map(({ id, name, addedAt }) => ({ id, name, addedAt })).sort((a, b) => b.addedAt - a.addedAt)
  } catch {
    return []
  }
}

export async function deleteAsset(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id))
  imgCache.delete(id)
}

/** Synchronous read for the render loop; null until the asset is warmed. */
export function getAssetImage(id: string): HTMLImageElement | null {
  const img = imgCache.get(id)
  return img && img.complete && img.naturalWidth > 0 ? img : null
}

/** Warm the cache for the given asset ids (preview after load; export MUST await this). */
export async function ensureAssetsLoaded(ids: string[]): Promise<void> {
  const missing = [...new Set(ids)].filter((id) => id && !imgCache.has(id))
  if (missing.length === 0) return
  await Promise.all(
    missing.map(async (id) => {
      try {
        const row = await tx<AssetRow | undefined>('readonly', (s) => s.get(id) as IDBRequest<AssetRow | undefined>)
        if (row?.dataUrl) await warmCache(id, row.dataUrl)
      } catch {
        /* asset gone — placeholder renders instead */
      }
    }),
  )
}

/** Every asset id referenced by the project's image elements. */
export function collectAssetIds(project: Project): string[] {
  const ids: string[] = []
  for (const s of project.scenes) {
    if (s.type !== 'custom') continue
    for (const el of s.props.elements) if (el.kind === 'image') ids.push(el.assetId)
  }
  return [...new Set(ids)]
}
