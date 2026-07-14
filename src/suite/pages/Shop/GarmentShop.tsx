/**
 * Garment Shop — sells the admin's UPLOADED garments, priced in coins per garment. Buying deducts the
 * user's real coin balance, turns the file-based garment into a fully-editable garment in My Garments,
 * and opens it in the Design Studio. Owned garments show "Open" so nothing is ever bought twice.
 */
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { SuitePage } from '../_shared/SuitePage'
import { useAuth } from '../../auth/auth'
import { useStore } from '../../data/store'
import { useToast } from '../../components/ui/Toast'
import { useGarments } from '../../garments/useGarments'
import { categoryLabel, type Garment } from '../../garments/types'
import { createGarment } from '../../garment-model/garmentLibrary'
import { buildEditable, readOwned, markOwned } from '../../garment-model/garmentShop'
import { IcoCoins } from '../../components/ui/Icons'
import { useT } from '@/i18n'
import './shop.css'

export function GarmentShop() {
  const { user } = useAuth()
  const { mutate } = useStore()
  const toast = useToast()
  const navigate = useNavigate()
  const { garments, loading } = useGarments()
  const t = useT()

  const [cat, setCat] = useState('all')
  const [query, setQuery] = useState('')
  const [owned, setOwned] = useState<Record<string, string>>(() => (user ? readOwned(user.id) : {}))
  const [buyingId, setBuyingId] = useState<string | null>(null)
  // Zoom preview — click a card to see the garment large before buying.
  const [preview, setPreview] = useState<Garment | null>(null)

  useEffect(() => {
    if (!preview) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPreview(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [preview])

  // Category chips built from what's actually in the shop (id + label), plus an "All".
  const cats = useMemo(() => {
    const ids = Array.from(new Set(garments.map((g) => g.category)))
    return [{ id: 'all', label: t('shop.cat.all') }, ...ids.map((id) => ({ id, label: categoryLabel(id) }))]
  }, [garments, t])

  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    return garments.filter((g) => (cat === 'all' || g.category === cat) && (q === '' || g.name.toLowerCase().includes(q)))
  }, [garments, cat, query])

  const coins = user?.coins ?? 0

  async function buy(item: Garment) {
    if (!user || buyingId) return
    const ownedId = owned[item.id]
    if (ownedId) {
      navigate(`/suite/garment-lab/${ownedId}`)
      return
    }
    if (item.price > 0 && coins < item.price) {
      toast(t('shop.toast.notEnough', { coins, name: item.name, price: item.price }), 'info')
      return
    }
    setBuyingId(item.id)
    try {
      // Analyse FIRST — a garment must resolve to editable layers or the purchase doesn't happen
      // (no empty garment, no coins spent). buildEditable throws when there are no layers.
      const editable = await buildEditable(item)
      const summary = createGarment(user.id, editable, { name: item.name, category: categoryLabel(item.category), origin: 'shop' })
      if (item.price > 0) {
        mutate((d) => ({ ...d, users: d.users.map((u) => (u.id === user.id ? { ...u, coins: u.coins - item.price } : u)) }))
      }
      markOwned(user.id, item.id, summary.id)
      setOwned(readOwned(user.id))
      toast(
        item.price > 0
          ? t('shop.toast.bought', { name: item.name, price: item.price })
          : t('shop.toast.added', { name: item.name }),
        'success',
      )
      navigate(`/suite/garment-lab/${summary.id}`)
    } catch (err) {
      // No layers (or the source couldn't be read) → don't charge, don't file an empty garment.
      toast(err instanceof Error ? err.message : t('shop.toast.prepFail'), 'info')
    } finally {
      setBuyingId(null)
    }
  }

  return (
    <SuitePage
      eyebrow={t('shop.eyebrow')}
      title={t('shop.title')}
      subtitle={t('shop.subtitle')}
      actions={
        <span className="shop-balance" title={t('shop.balanceTitle')}>
          <IcoCoins width="17" height="17" />
          <b>{coins.toLocaleString()}</b> {t('shop.coins')}
        </span>
      }
    >
      <div className="gm-tools">
        <input className="gm-search" type="search" placeholder={t('shop.searchPlaceholder')} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={t('shop.searchAria')} />
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
              <button type="button" className="shop-card__thumb" onClick={() => setPreview(item)} title={t('shop.previewTitle', { name: item.name })} aria-label={t('shop.previewAria', { name: item.name })}>
                {item.thumbUrl ? <img src={item.thumbUrl} alt={item.name} loading="lazy" /> : <div className="shop-card__noimg" aria-hidden="true">🧥</div>}
                {isOwned && <span className="shop-owned-badge">{t('shop.owned')}</span>}
              </button>
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
                  title={isOwned ? t('shop.buyTitle.open') : affordable ? (item.price > 0 ? t('shop.buyTitle.buy', { price: item.price }) : t('shop.buyTitle.free')) : t('shop.buyTitle.locked', { price: item.price, coins })}
                >
                  {busy ? (
                    t('shop.opening')
                  ) : isOwned ? (
                    t('shop.open')
                  ) : item.price > 0 ? (
                    <>
                      <IcoCoins width="14" height="14" />
                      {item.price}
                    </>
                  ) : (
                    t('shop.free')
                  )}
                </button>
              </div>
            </article>
          )
        })}
        {!loading && items.length === 0 && (
          <p className="shop-empty">
            {garments.length === 0 ? t('shop.emptyNoStock') : t('shop.emptyNoMatch')}
          </p>
        )}
        {loading && <p className="shop-empty">{t('shop.loading')}</p>}
      </div>

      {preview &&
        createPortal(
          <div className="suite">
            <div className="shop-lb" role="dialog" aria-modal="true" onClick={() => setPreview(null)}>
              <div className="shop-lb__panel" onClick={(e) => e.stopPropagation()}>
                <button type="button" className="shop-lb__x" aria-label={t('shop.close')} onClick={() => setPreview(null)}>×</button>
                <div className="shop-lb__stage">
                  {preview.thumbUrl ? <img src={preview.thumbUrl} alt={preview.name} /> : <div className="shop-lb__noimg" aria-hidden="true">🧥</div>}
                </div>
                <div className="shop-lb__bar">
                  <div className="shop-lb__info">
                    <span className="shop-lb__name" title={preview.name}>{preview.name}</span>
                    <span className="shop-lb__cat">{categoryLabel(preview.category)}</span>
                  </div>
                  <button
                    type="button"
                    className="s-btn s-btn--accent shop-lb__buy"
                    disabled={buyingId === preview.id || (!owned[preview.id] && preview.price > 0 && coins < preview.price)}
                    onClick={() => { const it = preview; setPreview(null); void buy(it) }}
                  >
                    {owned[preview.id] ? t('shop.lb.open') : preview.price > 0 ? <><IcoCoins width="14" height="14" /> {t('shop.lb.buy', { n: preview.price })}</> : t('shop.lb.free')}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </SuitePage>
  )
}
