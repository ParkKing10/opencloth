import { ArrowRight, Bolt, Play, Shield, Users } from '../ui/Icons'
import { HeroVisual } from './HeroVisual'
import './hero.css'

const TRUST = [
  { icon: Shield, label: 'Keine Kreditkarte' },
  { icon: Bolt, label: 'Kostenloser Einstieg' },
  { icon: Users, label: 'Über 10.000+ Creator' },
]

export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-heading">
      <div className="shell hero__grid">
        <div className="hero__copy">
          <span className="hero__badge">
            <Bolt width="15" height="15" />
            Die All-in-One Fashion Plattform
          </span>

          <h1 id="hero-heading" className="hero__headline">
            <span className="hero__line hero__line--light">Entwirf.</span>
            <span className="hero__line hero__line--light">Produziere.</span>
            <span className="hero__line hero__line--accent">Skaliere.</span>
          </h1>

          <p className="hero__lead">
            Von der ersten Idee bis zur Produktion.
            <br />
            Design, Tech Packs, Hersteller &amp; mehr – alles an einem Ort.
          </p>

          <div className="hero__ctas">
            <a className="btn btn--accent btn--lg" href="/signup">
              Kostenlos starten
              <ArrowRight width="19" height="19" />
            </a>
            <a className="btn btn--dark btn--lg" href="/demo">
              Demo ansehen
              <span className="hero__play" aria-hidden="true">
                <Play width="13" height="13" />
              </span>
            </a>
          </div>

          <ul className="hero__trust">
            {TRUST.map(({ icon: Icon, label }) => (
              <li className="hero__trust-item" key={label}>
                <Icon className="hero__trust-icon" width="18" height="18" />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <HeroVisual />
      </div>
    </section>
  )
}
