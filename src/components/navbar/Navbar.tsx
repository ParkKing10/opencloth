import { Logo } from '../ui/Logo'
import { ArrowRight, Chevron, Globe } from '../ui/Icons'
import './navbar.css'

const NAV_ITEMS: { label: string; hasMenu: boolean }[] = [
  { label: 'Produkt', hasMenu: true },
  { label: 'Funktionen', hasMenu: true },
  { label: 'Hersteller', hasMenu: false },
  { label: 'Preise', hasMenu: false },
  { label: 'Ressourcen', hasMenu: true },
  { label: 'Community', hasMenu: true },
]

export function Navbar() {
  return (
    <header className="navbar">
      <div className="shell navbar__inner">
        <Logo />

        <nav className="navbar__nav" aria-label="Hauptnavigation">
          {NAV_ITEMS.map((item) => (
            <button className="navbar__link" key={item.label} type="button">
              {item.label}
              {item.hasMenu && <Chevron className="navbar__caret" width="16" height="16" />}
            </button>
          ))}
        </nav>

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
