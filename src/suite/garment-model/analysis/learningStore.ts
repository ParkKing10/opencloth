/**
 * Learning store — the engine's reusable knowledge. Every successful analysis appends its signature
 * to localStorage; a new import looks up its nearest prior signatures to bias classification. No
 * hardcoded garment types: the "knowledge" is entirely the accumulated signatures. Degrades to pure
 * geometry when the store is empty.
 */
import type { GarmentSignature } from './signature'
import { signatureDistance } from './signature'

const KEY = 'threados-garment-signatures-v1'
const MAX = 200 // keep the store bounded (oldest pruned)

function read(): GarmentSignature[] {
  try {
    const raw = localStorage.getItem(KEY)
    const arr = raw ? (JSON.parse(raw) as GarmentSignature[]) : []
    return Array.isArray(arr) ? arr.filter((s) => Array.isArray(s?.vec)) : []
  } catch {
    return []
  }
}

function write(list: GarmentSignature[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)))
  } catch {
    /* storage full — learning is best-effort, never fatal */
  }
}

/** Remember a successful analysis. Stamp the time at the call site (analysis core stays pure). */
export function saveSignature(sig: GarmentSignature, at: number): void {
  write([...read(), { ...sig, at }])
}

export type Neighbour = { sig: GarmentSignature; distance: number }

/** The k nearest prior signatures to `sig`, closest first. Empty when nothing has been learned. */
export function nearestSignatures(sig: GarmentSignature, k = 3): Neighbour[] {
  return read()
    .map((s) => ({ sig: s, distance: signatureDistance(sig, s) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, k)
}

/** How many garments the engine has learned from. */
export function learnedCount(): number {
  return read().length
}
