/**
 * React state layer over the shared garment history for ONE garment (by id). Manual edits and AI
 * edits both flow through commit → one append-only, undoable timeline that persists across reloads
 * and keeps the garment's collection card in sync. AI edits run through the provider abstraction
 * (OpenAI when configured, else the deterministic placeholder) — the editor stays the source of truth.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { EditableGarment } from '../../garment-model/editableGarment'
import {
  initHistory,
  commit,
  undo as undoHistory,
  redo as redoHistory,
  restore as restoreHistory,
  canUndo,
  canRedo,
  currentGarment,
  type GarmentHistory,
} from '../../garment-model/garmentRevision'
import { loadHistory, saveHistory, pullHistoryFromCloud } from '../../garment-model/garmentDocumentStore'
import { touchGarment } from '../../garment-model/garmentLibrary'
import { resolveProvider } from '../../garment-model/aiProvider'
import type { AiEditResult } from '../../garment-model/aiGarmentEditor'

export function useGarmentHistory(garmentId: string, makeFallback: () => EditableGarment, userId?: string) {
  const startedAsFallbackRef = useRef(false)
  const [history, setHistory] = useState<GarmentHistory>(() => {
    const local = loadHistory(garmentId)
    if (local) return local
    startedAsFallbackRef.current = true
    return initHistory(makeFallback())
  })
  // Whether the LAST autosave write actually landed — the header indicator must not
  // claim "Saved" when the quota retry gave up.
  const [saveOk, setSaveOk] = useState(true)
  // Until a pending cloud pull resolves, do NOT push — the fallback must never
  // overwrite a real history that only exists on another device.
  const cloudReadyRef = useRef(!startedAsFallbackRef.current)

  // Nothing local for this garment: it may live in the cloud (created on another device).
  useEffect(() => {
    if (!garmentId || !startedAsFallbackRef.current) return
    let live = true
    void pullHistoryFromCloud(garmentId).then((found) => {
      if (!live) return
      cloudReadyRef.current = true
      if (found) {
        const pulled = loadHistory(garmentId)
        if (pulled) setHistory(pulled)
      }
    })
    return () => {
      live = false
    }
  }, [garmentId])

  const historyRef = useRef(history)
  useEffect(() => {
    historyRef.current = history
    // Only persist for a real, id-bearing garment — never write a fallback under an empty/aliased key.
    if (!garmentId) return
    const res = saveHistory(history, { skipCloud: !cloudReadyRef.current })
    setSaveOk(res.ok)
    if (res.ok && userId) touchGarment(userId, garmentId, currentGarment(history))
  }, [history, userId, garmentId])

  const garment = currentGarment(history)

  const commitManual = useCallback((next: EditableGarment, label: string) => {
    setHistory((h) => commit(h, next, { kind: 'manual', label }))
  }, [])

  const replaceCurrent = useCallback((next: EditableGarment) => {
    setHistory((h) => ({ ...h, revisions: h.revisions.map((r, i) => (i === h.currentIndex ? { ...r, garment: next } : r)) }))
  }, [])

  const applyAi = useCallback(async (prompt: string): Promise<AiEditResult> => {
    const base = currentGarment(historyRef.current)
    const provider = resolveProvider()
    const result = await provider.editGarment(base, prompt)
    if (result.understood && result.garment !== base) {
      setHistory((h) =>
        commit(h, result.garment, {
          kind: 'ai',
          prompt,
          changedRegionIds: result.changedRegionIds,
          summary: result.summary,
          understood: result.understood,
          provider: provider.id,
        }),
      )
    }
    return result
  }, [])

  const undo = useCallback(() => setHistory((h) => undoHistory(h)), [])
  const redo = useCallback(() => setHistory((h) => redoHistory(h)), [])
  const restore = useCallback((index: number) => setHistory((h) => restoreHistory(h, index)), [])

  return {
    garment,
    history,
    saveOk,
    commitManual,
    replaceCurrent,
    applyAi,
    undo,
    redo,
    restore,
    canUndo: canUndo(history),
    canRedo: canRedo(history),
  }
}
