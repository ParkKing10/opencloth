/**
 * Garment revision history — the single source of truth for BOTH manual and AI edits.
 *
 * The garment is never overwritten. Every edit (a manual region change or an AI prompt) appends
 * a new revision holding a full garment snapshot, so old revisions always stay available and any
 * version can be restored. History is append-only and branch-free: undo/redo walk the timeline,
 * restore jumps to a chosen revision, and a new edit appends at the end and points there. AI edits
 * therefore can never destroy manual edits — they use the exact same mechanism.
 */
import type { EditableGarment } from './editableGarment'

export type RevisionSource =
  | { kind: 'original' }
  | { kind: 'manual'; label: string }
  | { kind: 'ai'; prompt: string; changedRegionIds: string[]; summary: string[]; understood: boolean; provider?: 'placeholder' | 'openai' }

export type GarmentRevision = {
  id: string
  garment: EditableGarment
  source: RevisionSource
  createdAt: number
}

export type GarmentHistory = {
  garmentId: string
  revisions: GarmentRevision[]
  currentIndex: number
}

let seq = 0
function revisionId(): string {
  seq += 1
  return `rev-${Date.now().toString(36)}-${seq}`
}

export function initHistory(garment: EditableGarment): GarmentHistory {
  const revision: GarmentRevision = { id: revisionId(), garment, source: { kind: 'original' }, createdAt: Date.now() }
  return { garmentId: garment.id, revisions: [revision], currentIndex: 0 }
}

export function currentRevision(history: GarmentHistory): GarmentRevision {
  return history.revisions[history.currentIndex]
}

export function currentGarment(history: GarmentHistory): EditableGarment {
  return currentRevision(history).garment
}

/** Append a new revision from the current state and point at it. Append-only — nothing is dropped. */
export function commit(history: GarmentHistory, garment: EditableGarment, source: RevisionSource): GarmentHistory {
  const revision: GarmentRevision = { id: revisionId(), garment, source, createdAt: Date.now() }
  const revisions = [...history.revisions, revision]
  return { ...history, revisions, currentIndex: revisions.length - 1 }
}

export function canUndo(history: GarmentHistory): boolean {
  return history.currentIndex > 0
}

export function canRedo(history: GarmentHistory): boolean {
  return history.currentIndex < history.revisions.length - 1
}

export function undo(history: GarmentHistory): GarmentHistory {
  return canUndo(history) ? { ...history, currentIndex: history.currentIndex - 1 } : history
}

export function redo(history: GarmentHistory): GarmentHistory {
  return canRedo(history) ? { ...history, currentIndex: history.currentIndex + 1 } : history
}

/** Version switching — restore any revision by index (clamped). Does not delete anything. */
export function restore(history: GarmentHistory, index: number): GarmentHistory {
  const clamped = Math.max(0, Math.min(history.revisions.length - 1, index))
  return { ...history, currentIndex: clamped }
}

/** A short human label for a revision, for the timeline. */
export function revisionLabel(revision: GarmentRevision): string {
  switch (revision.source.kind) {
    case 'original':
      return 'Original'
    case 'manual':
      return revision.source.label
    case 'ai':
      return revision.source.prompt
  }
}
