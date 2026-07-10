/**
 * Garment Shop — THREADOS's premium editable-garment library, priced in coins. Buying deducts the
 * user's real coin balance and files a fully-editable copy in My Garments. Owned garments show
 * "Open" instead of a price, so nothing is ever bought twice.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SuitePage } from '../_shared/SuitePage'
import { useAuth } from '../../auth/auth'
import { useStore } from '../../data/store'
import { useToast } from '../../components/ui/Toast'
import { createGarment } from '../../garment-model/garmentLibrary'
import { garmentThumbnailDataUrl } from '../../garment-model/garmentThumbnail'
import { SHOP_ITEMS, SHOP_CATEGORIES, readOwned, markOwned, type ShopItem } from '../../garment-model/garmentShop'
import { IcoCoins } from '../../components/ui/Icons'
import './shop.css'

export function GarmentShop() {
  const { user } = useAuth()
  const { mutate } = useStore()
  const toast = useToast()
  const navigate = useNavigate()

  const [cat, setCat] = useState('All')
  const [query, setQuery] = useState('')
  const [owned, setOwned] = useState<Record<string, string>>(() => (user ? readOwned(user.id) : {}))

  // Thumbnails are derived from the same editable garment the buyer receives — never a stored raster.
  const thumbs = useMemo(() => new Map(SHOP_ITEMS.map((i) => [i.templateId, garmentThumbnailDataUrl(i.template.make())])), [])

  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    return SHOP_ITEMS.filter((i) => (cat === 'All' || i.category === cat) && (q === '' || i.name.toLowerCase().includes(q)))
  }, [cat, query])

  const coins = user?.coins ?? 0

  function buy(item: ShopItem) {
    if (!user) return
    const ownedId = owned[item.templateId]
    if (ownedId) {
      navigate(`/suite/garment-lab/${ownedId}`)
      return
    }
    if (coins < item.price) {
      toast(`Not enough coins — you have ${coins}, “${item.name}” costs ${item.price}. Top up in Settings → Billing.`, 'info')
      return
    }
    // Create the editable garment FIRST (the valuable thing), then charge the coins.
    const summary = createGarment(user.id, item.template.make(), { name: item.name, category: item.category, origin: 'shop' })
    mutate((d) => ({ ...d, users: d.users.map((u) => (u.id === user.id ? { ...u, coins: u.coins - item.price } : u)) }))
    markOwned(user.id, item.templateId, summary.id)
    setOwned(readOwned(user.id))
    toast(`Bought “${item.name}” for ${item.price} coins — added to My Garments.`, 'success')
  }

  return (
    <SuitePage
      eyebrow="Workspace"
      title="Garment Shop"
      subtitle="Premium editable garments. Buy one with coins and it lands, fully editable, in My Garments."
      actions={
        <span className="shop-balance" title="Your coin balance">
          <IcoCoins width="17" height="17" />
          <b>{coins.toLocaleString()}</b> coins
        </span>
      }
    >
      <div className="gm-tools">
        <input className="gm-search" type="search" placeholder="Search the shop…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search garments" />
      </div>

      <div className="shop-cats">
        {SHOP_CATEGORIES.map((c) => (
          <button key={c} type="button" className={`shop-cat${cat === c ? ' is-active' : ''}`} onClick={() => setCat(c)}>
            {c}
          </button>
        ))}
      </div>

      <div className="shop-grid">
        {items.map((item) => {
          const isOwned = !!owned[item.templateId]
          const affordable = coins >= item.price
          return (
            <article key={item.templateId} className="shop-card">
              <div className="shop-card__thumb">
                <img src={thumbs.get(item.templateId)} alt={item.name} loading="lazy" />
                {isOwned && <span className="shop-owned-badge">Owned</span>}
              </div>
              <div className="shop-card__body">
                <div className="shop-card__row">
                  <h3 className="shop-card__name" title={item.name}>{item.name}</h3>
                  <span className="shop-card__cat">{item.category}</span>
                </div>
                <button
                  type="button"
                  className={`shop-buy${isOwned ? ' is-owned' : ''}${!isOwned && !affordable ? ' is-locked' : ''}`}
                  onClick={() => buy(item)}
                  title={isOwned ? 'Open in the editor' : affordable ? `Buy for ${item.price} coins` : `Costs ${item.price} coins — you have ${coins}`}
                >
                  {isOwned ? (
                    'Open'
                  ) : (
                    <>
                      <IcoCoins width="14" height="14" />
                      {item.price}
                    </>
                  )}
                </button>
              </div>
            </article>
          )
        })}
        {items.length === 0 && <p className="shop-empty">No garments match your search.</p>}
      </div>
    </SuitePage>
  )
}
