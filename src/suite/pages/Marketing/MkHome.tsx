import { useNavigate } from 'react-router-dom'
import { useT } from '@/i18n'
import { IcoSparkle, IcoArrowRight } from '../../components/ui/Icons'
import { MK_TEMPLATES } from '../../marketing/templates'
import { useMarketing } from '../../marketing/useMarketing'
import { TemplateCard } from './TemplateCard'

/** Marketing Studio home — hero, featured campaign templates, and quick paths into the studio. */
export function MkHome() {
  const t = useT()
  const navigate = useNavigate()
  const { meta } = useMarketing()

  const featured = MK_TEMPLATES.filter((tpl) => tpl.featured)

  return (
    <>
      <section className="mst-hero">
        <p className="mst-hero__kicker">
          <IcoSparkle width="13" height="13" /> {t('mk.hero.kicker')}
        </p>
        <h2 className="mst-hero__title">{t('mk.hero.title')}</h2>
        <p className="mst-hero__sub">{t('mk.hero.sub')}</p>
        <div className="mst-hero__cta">
          <button type="button" className="s-btn s-btn--accent" onClick={() => navigate('/marketing/templates')}>
            {t('mk.hero.ctaBrowse')} <IcoArrowRight width="15" height="15" />
          </button>
          <button type="button" className="s-btn s-btn--subtle" onClick={() => navigate('/marketing/characters')}>
            {t('mk.hero.ctaCharacter')}
          </button>
        </div>
      </section>

      <section className="mst-sec">
        <div className="mst-sec__head">
          <div>
            <h2>{t('mk.home.featured')}</h2>
            <p>{t('mk.home.featuredSub')}</p>
          </div>
          <button type="button" className="s-btn s-btn--subtle" onClick={() => navigate('/marketing/templates')}>
            {t('mk.home.allTemplates', { n: MK_TEMPLATES.length })}
          </button>
        </div>
        <div className="mst-grid mst-grid--featured">
          {featured.map((tpl) => (
            <TemplateCard key={tpl.id} template={tpl} size="lg" />
          ))}
        </div>
      </section>

      <section className="mst-sec">
        <div className="mst-sec__head">
          <div>
            <h2>{t('mk.home.setup')}</h2>
            <p>{t('mk.home.setupSub')}</p>
          </div>
        </div>
        <div className="mst-quick">
          <button type="button" className="mst-quick__card" onClick={() => navigate('/marketing/characters')}>
            <b>{t('mk.quick.characters')}</b>
            <small>{meta.characters.length > 0 ? t('mk.quick.charactersSome', { n: meta.characters.length }) : t('mk.quick.charactersNone')}</small>
          </button>
          <button type="button" className="mst-quick__card" onClick={() => navigate('/marketing/products')}>
            <b>{t('mk.quick.products')}</b>
            <small>{t('mk.quick.productsSub')}</small>
          </button>
          <button type="button" className="mst-quick__card" onClick={() => navigate('/marketing/brand')}>
            <b>{t('mk.quick.brand')}</b>
            <small>{t('mk.quick.brandSub')}</small>
          </button>
          <button type="button" className="mst-quick__card" onClick={() => navigate('/marketing/generate?t=content-calendar')}>
            <b>{t('mk.quick.calendar')}</b>
            <small>{t('mk.quick.calendarSub')}</small>
          </button>
          <div className="mst-quick__card" role="note" style={{ cursor: 'default' }}>
            <b>
              {t('mk.quick.shopify')} <span className="mst-soon">{t('mk.soon')}</span>
            </b>
            <small>{t('mk.quick.shopifySub')}</small>
          </div>
        </div>
      </section>
    </>
  )
}
