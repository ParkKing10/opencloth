/* ============================================================
   Generated-video asset store.

   Every completed generation is ingested HERE — an IndexedDB
   Blob (never localStorage: media killed the quota before, see
   the garment-image lesson) plus probed metadata and a poster
   thumbnail. Clip versions reference these ids, so generated
   takes survive reloads; object URLs are created on demand and
   cached per session.
   ============================================================ */

import { uid } from '../types'

export type VideoAssetMeta = {
  id: string
  name: string
  mime: string
  size: number
  duration: number
  width: number
  height: number
  /** Poster frame as a small JPEG data URL. */
  thumb: string
  addedAt: number
}

type Row = { meta: VideoAssetMeta; blob: Blob }

const DB_NAME = 'loom-director-media'
const STORE = 'videos'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'meta.id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const req = run(t.objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

/* ---------------- probing ---------------- */

/** Read duration/dimensions from a blob. Handles MediaRecorder webm's Infinity-duration quirk.
    Hard 8s timeout — a stalled <video> must fail the job, never hang it in 'processing'. */
export function probeVideo(blob: Blob): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const v = document.createElement('video')
    v.preload = 'metadata'
    v.muted = true
    const guard = window.setTimeout(() => fail(), 8000)
    const fail = () => {
      window.clearTimeout(guard)
      URL.revokeObjectURL(url)
      reject(new Error('unreadable video'))
    }
    const done = () => {
      window.clearTimeout(guard)
      const duration = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 0
      const out = { duration, width: v.videoWidth || 0, height: v.videoHeight || 0 }
      URL.revokeObjectURL(url)
      resolve(out)
    }
    v.onerror = fail
    v.onloadedmetadata = () => {
      if (Number.isFinite(v.duration) && v.duration > 0) done()
      else {
        // webm from MediaRecorder: seek far to force the real duration.
        v.currentTime = 1e6
        const timer = window.setTimeout(done, 1500)
        v.ontimeupdate = () => {
          window.clearTimeout(timer)
          v.ontimeupdate = null
          done()
        }
      }
    }
    v.src = url
  })
}

/** Poster frame near the start (15% in) as a compact JPEG data URL.
    Best-effort with a 6s guard — a missing thumb must never block ingestion. */
export function makeThumb(blob: Blob, duration: number): Promise<string> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const v = document.createElement('video')
    v.preload = 'auto'
    v.muted = true
    let settled = false
    const guard = window.setTimeout(() => finish(''), 6000)
    const finish = (thumb: string) => {
      if (settled) return
      settled = true
      window.clearTimeout(guard)
      URL.revokeObjectURL(url)
      resolve(thumb)
    }
    v.onerror = () => finish('')
    v.onloadeddata = () => {
      v.currentTime = Math.min(Math.max(0.1, duration * 0.15), Math.max(0.1, duration - 0.05))
    }
    v.onseeked = () => {
      try {
        const w = 320
        const h = Math.max(2, Math.round((v.videoHeight / Math.max(1, v.videoWidth)) * w))
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        c.getContext('2d')!.drawImage(v, 0, 0, w, h)
        finish(c.toDataURL('image/jpeg', 0.7))
      } catch {
        finish('')
      }
    }
    v.src = url
  })
}

/* ---------------- public API ---------------- */

export async function saveVideoAsset(blob: Blob, name: string): Promise<VideoAssetMeta> {
  const probed = await probeVideo(blob)
  const thumb = await makeThumb(blob, probed.duration)
  const meta: VideoAssetMeta = {
    id: uid(),
    name: name.slice(0, 120),
    mime: blob.type || 'video/webm',
    size: blob.size,
    duration: probed.duration,
    width: probed.width,
    height: probed.height,
    thumb,
    addedAt: Date.now(),
  }
  await tx('readwrite', (s) => s.put({ meta, blob } satisfies Row))
  return meta
}

export async function getVideoAssetMeta(id: string): Promise<VideoAssetMeta | null> {
  const row = (await tx('readonly', (s) => s.get(id))) as Row | undefined
  return row?.meta ?? null
}

export async function loadVideoAssetBlob(id: string): Promise<Blob | null> {
  const row = (await tx('readonly', (s) => s.get(id))) as Row | undefined
  return row?.blob ?? null
}

export async function deleteVideoAsset(id: string): Promise<void> {
  urlCache.get(id) && URL.revokeObjectURL(urlCache.get(id)!)
  urlCache.delete(id)
  await tx('readwrite', (s) => s.delete(id))
}

/* Session object-URL cache — one URL per asset, revoked centrally. */
const urlCache = new Map<string, string>()

export async function getVideoObjectURL(id: string): Promise<string | null> {
  const hit = urlCache.get(id)
  if (hit) return hit
  const blob = await loadVideoAssetBlob(id)
  if (!blob) return null
  const url = URL.createObjectURL(blob)
  urlCache.set(id, url)
  return url
}

export function releaseVideoObjectURLs(): void {
  for (const url of urlCache.values()) URL.revokeObjectURL(url)
  urlCache.clear()
}
