/**
 * React state layer over the IndexedDB asset store. Owns the per-user asset list and all
 * mutations (upload, rename, duplicate, delete, favorite, mark-used) so the UI stays declarative.
 */
import { useCallback, useEffect, useState } from 'react'
import { ASSETS_CHANGED_EVENT, deleteAsset, getAsset, listAssets, patchAsset, putAsset, type Asset } from './assetStore'
import { analyzeFile, isAcceptedFile } from './assetThumb'

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `a-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`
}

export type UploadResult = { added: number; rejected: string[] }

export function useAssets(userId: string | undefined) {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    if (!userId) {
      setAssets([])
      setLoading(false)
      return
    }
    const list = await listAssets(userId)
    setAssets(list)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    let alive = true
    setLoading(true)
    refresh().catch(() => {
      if (alive) setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [refresh])

  // Refresh when a generation auto-saves into the library from elsewhere (AI/campaign modals).
  useEffect(() => {
    const onChange = () => void refresh()
    window.addEventListener(ASSETS_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(ASSETS_CHANGED_EVENT, onChange)
  }, [refresh])

  const upload = useCallback(
    async (files: File[] | FileList): Promise<UploadResult> => {
      if (!userId) return { added: 0, rejected: [] }
      const list = Array.from(files)
      const rejected: string[] = []
      let added = 0
      setBusy(true)
      try {
        for (const file of list) {
          if (!isAcceptedFile(file)) {
            rejected.push(file.name)
            continue
          }
          try {
            const meta = await analyzeFile(file)
            const now = Date.now()
            const asset: Asset = {
              id: newId(),
              userId,
              filename: file.name,
              type: meta.type,
              kind: meta.kind,
              width: meta.width,
              height: meta.height,
              size: file.size,
              createdAt: now,
              lastUsedAt: 0,
              favorite: false,
              blob: file,
              thumb: meta.thumb,
            }
            await putAsset(asset)
            added += 1
          } catch {
            rejected.push(file.name)
          }
        }
        await refresh()
      } finally {
        setBusy(false)
      }
      return { added, rejected }
    },
    [userId, refresh],
  )

  const rename = useCallback(
    async (id: string, filename: string) => {
      const clean = filename.trim()
      if (!clean) return
      await patchAsset(id, { filename: clean })
      await refresh()
    },
    [refresh],
  )

  const duplicate = useCallback(
    async (id: string) => {
      const src = await getAsset(id)
      if (!src || !userId) return
      const dot = src.filename.lastIndexOf('.')
      const base = dot > 0 ? src.filename.slice(0, dot) : src.filename
      const ext = dot > 0 ? src.filename.slice(dot) : ''
      const now = Date.now()
      const copy: Asset = { ...src, id: newId(), filename: `${base} copy${ext}`, createdAt: now, lastUsedAt: 0, favorite: false }
      await putAsset(copy)
      await refresh()
    },
    [userId, refresh],
  )

  const remove = useCallback(
    async (id: string) => {
      await deleteAsset(id)
      await refresh()
    },
    [refresh],
  )

  const toggleFavorite = useCallback(
    async (id: string) => {
      const a = await getAsset(id)
      if (!a) return
      await patchAsset(id, { favorite: !a.favorite })
      await refresh()
    },
    [refresh],
  )

  return { assets, loading, busy, upload, rename, duplicate, remove, toggleFavorite, refresh }
}
