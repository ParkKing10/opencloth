import { useEffect, useState } from 'react'
import { useAuth } from '../auth/auth'
import { listGarments } from '../garment-model/garmentLibrary'
import { listDesigns } from '../ai/aiDesignStore'
import { loadDoc } from '../pages/DesignStudio/designDoc'
import { getGarmentImage } from '../pages/DesignStudio/garmentImageStore'

export type MkProduct = {
  id: string
  name: string
  category: string
  source: 'studio' | 'ai'
  image?: string
  updatedAt: number
}

/**
 * The Marketing Studio product catalog — auto-connected to loom studios, zero uploads:
 * every garment from the Garment Studio plus every AI Designer design shows up here.
 * Garment preview resolves thumb → design-doc backdrop (IndexedDB) in that order.
 */
export function useMkProducts(): { products: MkProduct[]; loading: boolean } {
  const { user } = useAuth()
  const [products, setProducts] = useState<MkProduct[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let live = true
    if (!user) {
      setProducts([])
      setLoading(false)
      return
    }
    setLoading(true)
    void (async () => {
      const garments = listGarments(user.id)
      const fromGarments: MkProduct[] = await Promise.all(
        garments.map(async (g) => {
          let image: string | undefined = g.thumb || undefined
          if (!image) {
            const doc = loadDoc(g.id)
            image = doc?.garmentEdit ?? undefined
            if (!image && doc?.garmentEditKey) image = (await getGarmentImage(doc.garmentEditKey)) ?? undefined
          }
          return { id: `g:${g.id}`, name: g.name, category: g.category, source: 'studio' as const, image, updatedAt: g.updatedAt }
        }),
      )
      const designs = await listDesigns(user.id)
      const fromDesigns: MkProduct[] = designs.map((d) => ({
        id: `d:${d.id}`,
        name: d.name,
        category: d.type,
        source: 'ai' as const,
        image: d.frontUrl,
        updatedAt: d.createdAt,
      }))
      if (!live) return
      setProducts([...fromGarments, ...fromDesigns].sort((a, b) => b.updatedAt - a.updatedAt))
      setLoading(false)
    })()
    return () => {
      live = false
    }
  }, [user])

  return { products, loading }
}
