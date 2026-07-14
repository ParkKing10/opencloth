import { useT } from '@/i18n'
import { ArrowRight, Bolt, Play, Shield, Users } from '../ui/Icons'
import { HeroVisual } from './HeroVisual'
import './hero.css'

const TRUST = [
  { icon: Shield, key: 'landing.hero.trust.noSkills' },
  { icon: Bolt, key: 'landing.hero.trust.ideaToProduction' },
  { icon: Users, key: 'landing.hero.trust.allInOne' },
]

export function Hero() {
  const t = useT()
  return (
    <section className="hero" aria-labelledby="hero-heading">
      <div className="shell hero__grid">
        <div className="hero__copy">
          <span className="hero__badge">
            <Bolt width="15" height="15" />
            {t('landing.hero.badge')}
          </span>

          <h1 id="hero-heading" className="hero__headline">
            <span className="hero__line hero__line--light">{t('landing.hero.headline.design')}</span>
            <span className="hero__line hero__line--light">{t('landing.hero.headline.produce')}</span>
            <span className="hero__line hero__line--accent">{t('landing.hero.headline.launch')}</span>
          </h1>

          <p className="hero__lead">{t('landing.hero.lead')}</p>

          <div className="hero__ctas">
            <a className="btn btn--accent btn--lg" href="/signup">
              {t('landing.cta.getStarted')}
              <ArrowRight width="19" height="19" />
            </a>
            <a className="btn btn--dark btn--lg" href="/login">
              {t('landing.hero.cta.demo')}
              <span className="hero__play" aria-hidden="true">
                <Play width="13" height="13" />
              </span>
            </a>
          </div>

          <ul className="hero__trust">
            {TRUST.map(({ icon: Icon, key }) => (
              <li className="hero__trust-item" key={key}>
                <Icon className="hero__trust-icon" width="18" height="18" />
                {t(key)}
              </li>
            ))}
          </ul>
        </div>

        <HeroVisual />
      </div>
    </section>
  )
}
