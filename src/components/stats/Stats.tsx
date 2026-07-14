import { useT } from '@/i18n'
import { Cube, Doc, Factory, Users } from '../ui/Icons'
import './stats.css'

const STATS = [
  { icon: Users, id: 'creators' },
  { icon: Cube, id: 'designs' },
  { icon: Doc, id: 'techPacks' },
  { icon: Factory, id: 'manufacturers' },
]

export function Stats() {
  const t = useT()
  return (
    <section className="stats" aria-label={t('landing.stats.ariaLabel')}>
      <div className="shell stats__grid">
        {STATS.map(({ icon: Icon, id }) => (
          <article className="stat" key={id}>
            <span className="stat__icon" aria-hidden="true">
              <Icon width="24" height="24" />
            </span>
            <div className="stat__body">
              <p className="stat__value">{t(`landing.stats.${id}.value`)}</p>
              <p className="stat__label">{t(`landing.stats.${id}.label`)}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
