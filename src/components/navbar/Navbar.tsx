import { Logo } from '../ui/Logo'
import { ArrowRight, Chevron, Globe } from '../ui/Icons'
import './navbar.css'

export function Navbar() {
  return (
    <header className="navbar">
      <div className="shell navbar__inner">
        <Logo />

        <div className="navbar__actions">
          <button className="navbar__lang" type="button">
            <Globe width="18" height="18" />
            <span>DE</span>
            <Chevron width="14" height="14" />
          </button>
          <a className="btn btn--ghost" href="/login">
            Anmelden
          </a>
          <a className="btn btn--accent" href="/signup">
            Kostenlos starten
            <ArrowRight width="18" height="18" />
          </a>
        </div>
      </div>
    </header>
  )
}
