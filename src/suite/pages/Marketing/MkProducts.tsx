import { useNavigate } from 'react-router-dom'
import { useT } from '@/i18n'
import { GARMENT_GLYPHS } from '../../components/ui/Garments'
import { useMkProducts } from '../../marketing/useMkProducts'

/** Products — auto-connected to loom studios: every garment + AI design, zero uploads. */
export function MkProducts() {
  const t = useT()
  const navigate = useNavigate()
  const { products, loading } = useMkProducts()
  const Ghost = GARMENT_GLYPHS.hoodie

  return (
    <section className="mst-sec">
      <div className="mst-sec__head">
        <div>
          <h2>{t('mk.products.head')}</h2>
          <p>{t('mk.products.sub')}</p>
        </div>
      </div>

      {loading ? (
        <p className="mst-note">{t('mk.loading')}</p>
      ) : products.length === 0 ? (
        <div className="mst-empty">
          <b>{t('mk.products.emptyTitle')}</b>
          <p>{t('mk.products.emptyBody')}</p>
          <button type="button" className="s-btn s-btn--accent" onClick={() => navigate('/ai')}>
            {t('mk.products.emptyCta')}
          </button>
        </div>
      ) : (
        <div className="mst-products">
          {products.map((p) => (
            <article className="mst-prod" key={p.id}>
              <div className="mst-prod__img">
                {p.image ? <img src={p.image} alt={p.name} loading="lazy" /> : <Ghost width="64" height="64" />}
              </div>
              <div className="mst-prod__body">
                <span className="mst-prod__name" title={p.name}>{p.name}</span>
                <div className="mst-prod__row">
                  <span className="mst-pill">{p.source === 'ai' ? t('mk.products.srcAi') : t('mk.products.srcStudio')}</span>
                  <button type="button" className="s-btn s-btn--subtle" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => navigate(`/marketing/generate?p=${encodeURIComponent(p.id)}`)}>
                    {t('mk.products.use')}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
