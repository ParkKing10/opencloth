import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/auth'
import { loadMeta, saveMeta } from './marketingStore'
import type { MkAsset, MkBrandKit, MkCampaign, MkCharacter, MkContent } from './marketingStore'

export type MkMeta = {
  characters: MkCharacter[]
  campaigns: MkCampaign[]
  assets: MkAsset[]
  content: MkContent[]
  brand: MkBrandKit
}

/** Marketing Studio state for the signed-in user — reads once, every update persists synchronously. */
export function useMarketing() {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [meta, setMeta] = useState<MkMeta>(() => loadMeta(userId ?? '__guest__'))

  useEffect(() => {
    setMeta(loadMeta(userId ?? '__guest__'))
  }, [userId])

  const update = useCallback(
    (fn: (m: MkMeta) => MkMeta) => {
      setMeta((prev) => {
        const next = fn(prev)
        if (userId) saveMeta(userId, next)
        return next
      })
    },
    [userId],
  )

  return { user, meta, update }
}
