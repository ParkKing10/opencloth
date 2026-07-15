/**
 * The per-user GARMENT COLLECTION — the workspace's source of truth. Garments are primary;
 * designs belong to garments, not the reverse. Each summary here points at a garment whose full
 * editable revision history lives in the document store (keyed by garment id). The editor opens a
 * garment by id; nothing opens automatically.
 */
import type { EditableGarment } from './editableGarment'
import { initHistory, currentGarment } from './garmentRevision'
import { loadHistory, saveHistory, deleteHistory } from './garmentDocumentStore'
import { garmentThumbnailDataUrl } from './garmentThumbnail'
import { cloudAvailable, pushDocument, pullDocument } from '../lib/docSync'

export type GarmentOrigin = 'ai' | 'upload' | 'blank' | 'photo' | 'shop'

export type GarmentSummary = {
  id: string
  name: string
  category: string
  origin: GarmentOrigin
  favorite: boolean
  createdAt: number
  updatedAt: number
  regionCount: number
  thumb: string
}

const KEY_PREFIX = 'threados-garments-'

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `g-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`
}

function readIndex(userId: string): GarmentSummary[] {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + userId)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as GarmentSummary[]).filter((g) => g && typeof g.id === 'string') : []
  } catch {
    return []
  }
}

function writeIndex(userId: string, list: GarmentSummary[], opts?: { skipCloud?: boolean }): void {
  try {
    localStorage.setItem(KEY_PREFIX + userId, JSON.stringify(list))
    // The My-Garments cards follow the user across devices (content pulls on demand).
    if (!opts?.skipCloud) pushDocument('garments-index', list)
  } catch {
    /* non-fatal */
  }
}

/** Merge the cloud garment index into the local one (id-keyed, newest updatedAt wins).
 *  Returns true when anything changed — callers re-read the list then. */
export async function pullGarmentIndexFromCloud(userId: string): Promise<boolean> {
  if (!cloudAvailable()) return false
  const remote = await pullDocument<GarmentSummary[]>('garments-index')
  if (!Array.isArray(remote) || remote.length === 0) return false
  const local = readIndex(userId)
  const byId = new Map(local.map((g) => [g.id, g]))
  let changed = false
  for (const r of remote) {
    if (!r || typeof r.id !== 'string') continue
    const mine = byId.get(r.id)
    if (!mine || (r.updatedAt ?? 0) > (mine.updatedAt ?? 0)) {
      byId.set(r.id, r)
      changed = true
    }
  }
  if (changed) writeIndex(userId, [...byId.values()], { skipCloud: true })
  return changed
}

export function listGarments(userId: string): GarmentSummary[] {
  return readIndex(userId).sort((a, b) => b.updatedAt - a.updatedAt)
}

export function getGarment(userId: string, id: string): GarmentSummary | undefined {
  return readIndex(userId).find((g) => g.id === id)
}

function upsert(userId: string, summary: GarmentSummary): void {
  const list = readIndex(userId)
  const idx = list.findIndex((g) => g.id === summary.id)
  const next = idx >= 0 ? list.map((g) => (g.id === summary.id ? summary : g)) : [summary, ...list]
  writeIndex(userId, next)
}

function summarize(garment: EditableGarment, over: Partial<GarmentSummary>): GarmentSummary {
  const now = Date.now()
  return {
    id: garment.id,
    name: garment.name,
    category: garment.category,
    origin: 'blank',
    favorite: false,
    createdAt: now,
    updatedAt: now,
    regionCount: Object.keys(garment.regions).length,
    thumb: garmentThumbnailDataUrl(garment),
    ...over,
  }
}

/** Create a new garment: assign an id, seed its history, and add it to the collection. */
export function createGarment(userId: string, base: EditableGarment, opts: { name: string; category: string; origin: GarmentOrigin }): GarmentSummary {
  const id = newId()
  const garment: EditableGarment = { ...base, id, name: opts.name.trim() || base.name, category: opts.category, createdAt: Date.now() }
  saveHistory(initHistory(garment))
  const summary = summarize(garment, { name: garment.name, category: opts.category, origin: opts.origin })
  upsert(userId, summary)
  return summary
}

/** Refresh a garment's card metadata from its current editable state (called by the editor on save). */
export function touchGarment(userId: string, id: string, garment: EditableGarment): void {
  const existing = getGarment(userId, id)
  if (!existing) return
  upsert(userId, { ...existing, name: garment.name, category: garment.category, regionCount: Object.keys(garment.regions).length, thumb: garmentThumbnailDataUrl(garment), updatedAt: Date.now() })
}

export function renameGarment(userId: string, id: string, name: string): void {
  const existing = getGarment(userId, id)
  const clean = name.trim()
  if (!existing || !clean) return
  upsert(userId, { ...existing, name: clean, updatedAt: Date.now() })
  // Keep the editable garment's own name in sync so the editor + thumbnail agree.
  const history = loadHistory(id)
  if (history) {
    const revisions = history.revisions.map((r) => ({ ...r, garment: { ...r.garment, name: clean } }))
    saveHistory({ ...history, revisions })
  }
}

/** Update a garment's creation origin (e.g. blank → ai after generating inside the editor). */
export function updateGarmentOrigin(userId: string, id: string, origin: GarmentOrigin): void {
  const existing = getGarment(userId, id)
  if (!existing) return
  upsert(userId, { ...existing, origin })
}

export function toggleFavorite(userId: string, id: string): void {
  const existing = getGarment(userId, id)
  if (!existing) return
  upsert(userId, { ...existing, favorite: !existing.favorite })
}

export function deleteGarment(userId: string, id: string): void {
  writeIndex(userId, readIndex(userId).filter((g) => g.id !== id))
  deleteHistory(id)
}

/** Duplicate a garment as a fresh copy (own id + history) starting from the source's current state. */
export function duplicateGarment(userId: string, id: string): GarmentSummary | null {
  const source = getGarment(userId, id)
  const history = loadHistory(id)
  if (!source || !history) return null
  const current = currentGarment(history)
  return createGarment(userId, current, { name: `${source.name} copy`, category: source.category, origin: source.origin })
}
