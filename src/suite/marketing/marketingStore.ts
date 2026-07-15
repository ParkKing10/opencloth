/**
 * Marketing Studio data layer. Metadata (characters, campaigns, assets, brand kit, generated
 * content) lives in localStorage per user; every heavy blob (character reference photos, uploaded
 * assets, generated images) lives in its own IndexedDB store — inlining images into localStorage
 * is exactly what once made garments vanish (quota overflow), so only lightweight keys are kept
 * in the metadata records.
 */

const DB_NAME = 'loom-marketing'
const BLOB_STORE = 'blobs'

/* ── IndexedDB blob store ──────────────────────────────────────────────────────────────── */

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(BLOB_STORE)) db.createObjectStore(BLOB_STORE)
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

export async function putBlob(key: string, dataUrl: string): Promise<boolean> {
  try {
    const db = await openDb()
    await reqToPromise(db.transaction(BLOB_STORE, 'readwrite').objectStore(BLOB_STORE).put(dataUrl, key))
    return true
  } catch {
    return false
  }
}

export async function getBlob(key: string): Promise<string | null> {
  try {
    const db = await openDb()
    const v = await reqToPromise(db.transaction(BLOB_STORE, 'readonly').objectStore(BLOB_STORE).get(key))
    return typeof v === 'string' ? v : null
  } catch {
    return null
  }
}

export async function delBlobs(keys: string[]): Promise<void> {
  try {
    const db = await openDb()
    const store = db.transaction(BLOB_STORE, 'readwrite').objectStore(BLOB_STORE)
    await Promise.all(keys.map((k) => reqToPromise(store.delete(k))))
  } catch {
    /* non-fatal */
  }
}

/* ── Types ─────────────────────────────────────────────────────────────────────────────── */

export type MkGender = 'female' | 'male' | 'nonbinary'
export type MkVoice = 'warm' | 'energetic' | 'calm' | 'deep' | 'playful'
export type MkLang = 'en' | 'de' | 'fr' | 'es'
export type MkCharacterStatus = 'processing' | 'ready'

export type MkCharacter = {
  id: string
  name: string
  age: number
  gender: MkGender
  language: MkLang
  voice: MkVoice
  /** Persona style, e.g. "Streetwear model", "Founder", "UGC creator". */
  style: string
  description: string
  status: MkCharacterStatus
  /** Small inline avatar (cropped from the first reference photo). */
  avatar: string
  photoCount: number
  /** IndexedDB keys of the optimized reference photos. */
  photoKeys: string[]
  createdAt: number
}

export type MkCampaign = {
  id: string
  name: string
  goal: string
  productIds: string[]
  characterIds: string[]
  contentIds: string[]
  createdAt: number
}

export type MkAssetKind = 'image' | 'video' | 'audio' | 'other'

export type MkAsset = {
  id: string
  name: string
  kind: MkAssetKind
  mime: string
  size: number
  /** IndexedDB key of the payload (data URL). Images also keep a small inline thumb. */
  dataKey: string
  thumb?: string
  createdAt: number
}

export type MkBrandKit = {
  logo?: string
  fontHeading: string
  fontBody: string
  primary: string
  secondary: string
  accent: string
  /** Brand voice, e.g. "bold & streetwise", "quiet luxury". */
  tone: string
  website: string
  instagram: string
  tiktok: string
}

export type MkScene = {
  title: string
  camera: string
  action: string
  caption: string
  /** Prompt used (or usable) to render this scene's keyframe. */
  keyframePrompt: string
  /** IndexedDB key of the generated keyframe image, when one was rendered. */
  imageKey?: string
}

export type MkContent = {
  id: string
  templateId: string
  kind: 'photo' | 'storyboard' | 'plan'
  title: string
  campaignId?: string
  characterId?: string
  productIds: string[]
  prompt: string
  /** IndexedDB keys of generated images (photo shoots). */
  imageKeys: string[]
  /** Storyboard payload (video templates). */
  script?: {
    hook: string
    voiceover: string
    cta: string
    music: string
    scenes: MkScene[]
  }
  /** Content-plan payload (calendar). */
  plan?: { day: number; format: string; idea: string; hook: string }[]
  createdAt: number
}

/* ── Per-user metadata persistence ─────────────────────────────────────────────────────── */

const META_KEY = 'loom-marketing-v1'

type MetaShape = {
  characters: MkCharacter[]
  campaigns: MkCampaign[]
  assets: MkAsset[]
  content: MkContent[]
  brand: MkBrandKit
}

export const DEFAULT_BRAND: MkBrandKit = {
  fontHeading: 'Inter',
  fontBody: 'Inter',
  primary: '#d1f94f',
  secondary: '#17171d',
  accent: '#7ab8ff',
  tone: '',
  website: '',
  instagram: '',
  tiktok: '',
}

function emptyMeta(): MetaShape {
  return { characters: [], campaigns: [], assets: [], content: [], brand: { ...DEFAULT_BRAND } }
}

function readAll(): Record<string, MetaShape> {
  try {
    const raw = localStorage.getItem(META_KEY)
    return raw ? (JSON.parse(raw) as Record<string, MetaShape>) : {}
  } catch {
    return {}
  }
}

export function loadMeta(userId: string): MetaShape {
  const all = readAll()
  const meta = all[userId] ?? emptyMeta()
  return { ...emptyMeta(), ...meta, brand: { ...DEFAULT_BRAND, ...(meta.brand ?? {}) } }
}

export function saveMeta(userId: string, meta: MetaShape): void {
  try {
    const all = readAll()
    all[userId] = meta
    localStorage.setItem(META_KEY, JSON.stringify(all))
  } catch {
    /* metadata is tiny; a failure here means storage is fully broken — nothing sane to do */
  }
}

export function mkId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/* ── Image helpers ─────────────────────────────────────────────────────────────────────── */

/** Downscale an image data URL (longest edge `maxDim`) to a JPEG data URL. */
export async function optimizeImage(src: string, maxDim = 768, quality = 0.85): Promise<string> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image()
    i.onload = () => res(i)
    i.onerror = () => rej(new Error('decode failed'))
    i.src = src
  })
  const longest = Math.max(img.width, img.height) || 1
  const scale = Math.min(1, maxDim / longest)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.width * scale))
  canvas.height = Math.max(1, Math.round(img.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return src
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', quality)
}

/** Square center-crop thumbnail (avatars, asset thumbs). */
export async function squareThumb(src: string, size = 160): Promise<string> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image()
    i.onload = () => res(i)
    i.onerror = () => rej(new Error('decode failed'))
    i.src = src
  })
  const side = Math.min(img.width, img.height) || 1
  const sx = (img.width - side) / 2
  const sy = (img.height - side) / 2
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return src
  ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size)
  return canvas.toDataURL('image/jpeg', 0.85)
}
