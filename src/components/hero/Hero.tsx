import { ArrowRight, Bolt, Play, Shield, Users } from '../ui/Icons'
import { HeroVisual } from './HeroVisual'
import './hero.css'

const TRUST = [
  { icon: Shield, label: 'Ohne Designkenntnisse' },
  { icon: Bolt, label: 'Von Idee bis Produktion' },
  { icon: Users, label: 'Alles an einem Ort' },
]

export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-heading">
      <div className="shell hero__grid">
        <div className="hero__copy">
          <span className="hero__badge">
            <Bolt width="15" height="15" />
            The Operating System for Fashion Brands
          </span>

          <h1 id="hero-heading" className="hero__headline">
            <span className="hero__line hero__line--light">Design.</span>
            <span className="hero__line hero__line--light">Produce.</span>
            <span className="hero__line hero__line--accent">Launch.</span>
          </h1>

          <p className="hero__lead">
            Die erste All-in-One Fashion Software, mit der jeder Kleidung
            entwerfen und produzieren kann – ganz ohne Designkenntnisse.
          </p>

          <div className="hero__ctas">
            <a className="btn btn--accent btn--lg" href="/suite">
              Kostenlos starten
              <ArrowRight width="19" height="19" />
            </a>
            <a className="btn btn--dark btn--lg" href="/suite">
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
