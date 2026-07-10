import { useCallback, useEffect, useState } from 'react'
import { listGarments } from './garmentClient'
import type { Garment } from './types'

/** Loads the garment catalog and exposes a refresh. */
export function useGarments() {
  const [garments, setGarments] = useState<Garment[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setGarments(await listGarments())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { garments, loading, refresh }
}
