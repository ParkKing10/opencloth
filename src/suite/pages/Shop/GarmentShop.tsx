/**
 * Garment Shop — sells the admin's UPLOADED garments, priced in coins per garment. Buying deducts the
 * user's real coin balance, turns the file-based garment into a fully-editable garment in My Garments,
 * and opens it in the Design Studio. Owned garments show "Open" so nothing is ever bought twice.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SuitePage } from '../_shared/SuitePage'
import { useAuth } from '../../auth/auth'
import { useStore } from '../../data/store'
import { useToast } from '../../components/ui/Toast'
import { useGarments } from '../../garments/useGarments'
import { categoryLabel, type Garment } from '../../garments/types'
import { createGarment } from '../../garment-model/garmentLibrary'
import { buildEditableFromCatalog, readOwned, markOwned } from '../../garment-model/garmentShop'
import { IcoCoins } from '../../components/ui/Icons'
import './shop.css'

export function GarmentShop() {
  const { user } = useAuth()
  const { mutate } = useStore()
  const toast = useToast()
  const navigate = useNavigate()
  const { garments, loading } = useGarments()

  const [cat, setCat] = useState('all')
  const [query, setQuery] = useState('')
  const [owned, setOwned] = useState<Record<string, string>>(() => (user ? readOwned(user.id) : {}))
  const [buyingId, setBuyingId] = useState<string | null>(null)

  // Category chips built from what's actually in the shop (id + label), plus an "All".
  const cats = useMemo(() => {
    const ids = Array.from(new Set(garments.map((g) => g.category)))
    return [{ id: 'all', label: 'All' }, ...ids.map((id) => ({ id, label: categoryLabel(id) }))]
  }, [garments])

  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    return garments.filter((g) => (cat === 'all' || g.category === cat) && (q === '' || g.name.toLowerCase().includes(q)))
  }, [garments, cat, query])

  const coins = user?.coins ?? 0

  async function buy(item: Garment) {
    if (!user || buyingId) return
    const ownedId = owned[item.id]
    if (ownedId) {
      navigate(`/suite/design?garment=${ownedId}`)
      return
    }
    if (item.price > 0 && coins < item.price) {
      toast(`Not enough coins — you have ${coins}, “${item.name}” costs ${item.price}. Top up in Settings → Billing.`, 'info')
      return
    }
    setBuyingId(item.id)
    try {
      // Build the editable garment FIRST (the valuable thing), then charge the coins.
      const editable = await buildEditableFromCatalog(item)
      const summary = createGarment(user.id, editable, { name: item.name, category: categoryLabel(item.category), origin: 'shop' })
      if (item.price > 0) {
        mutate((d) => ({ ...d, users: d.users.map((u) => (u.id === user.id ? { ...u, coins: u.coins - item.price } : u)) }))
      }
      markOwned(user.id, item.id, summary.id)
      setOwned(readOwned(user.id))
      toast(
        item.price > 0
          ? `Bought “${item.name}” for ${item.price} coins — opening the editor.`
          : `Added “${item.name}” — opening the editor.`,
        'success',
      )
      navigate(`/suite/design?garment=${summary.id}`)
    } catch {
      toast('Could not open that garment for editing. Please try again.', 'info')
    } finally {
      setBuyingId(null)
    }
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
        {cats.map((c) => (
          <button key={c.id} type="button" className={`shop-cat${cat === c.id ? ' is-active' : ''}`} onClick={() => setCat(c.id)}>
            {c.label}
          </button>
        ))}
      </div>

      <div className="shop-grid">
        {items.map((item) => {
          const isOwned = !!owned[item.id]
          const affordable = item.price === 0 || coins >= item.price
          const busy = buyingId === item.id
          return (
            <article key={item.id} className="shop-card">
              <div className="shop-card__thumb">
                {item.thumbUrl ? <img src={item.thumbUrl} alt={item.name} loading="lazy" /> : <div className="shop-card__noimg" aria-hidden="true">🧥</div>}
                {isOwned && <span className="shop-owned-badge">Owned</span>}
              </div>
              <div className="shop-card__body">
                <div className="shop-card__row">
                  <h3 className="shop-card__name" title={item.name}>{item.name}</h3>
                  <span className="shop-card__cat">{categoryLabel(item.category)}</span>
                </div>
                <button
                  type="button"
                  className={`shop-buy${isOwned ? ' is-owned' : ''}${!isOwned && !affordable ? ' is-locked' : ''}`}
                  onClick={() => buy(item)}
                  disabled={busy}
                  title={isOwned ? 'Open in the editor' : affordable ? (item.price > 0 ? `Buy for ${item.price} coins` : 'Free — open in the editor') : `Costs ${item.price} coins — you have ${coins}`}
                >
                  {busy ? (
                    'Opening…'
                  ) : isOwned ? (
                    'Open'
                  ) : item.price > 0 ? (
                    <>
                      <IcoCoins width="14" height="14" />
                      {item.price}
                    </>
                  ) : (
                    'Free'
                  )}
                </button>
              </div>
            </article>
          )
        })}
        {!loading && items.length === 0 && (
          <p className="shop-empty">
            {garments.length === 0 ? 'No garments in the shop yet — upload garments in Admin → Garments to stock it.' : 'No garments match your search.'}
          </p>
        )}
        {loading && <p className="shop-empty">Loading the shop…</p>}
      </div>
    </SuitePage>
  )
}
