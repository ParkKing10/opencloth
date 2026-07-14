import { useT, LanguageToggle } from '@/i18n'
import { Logo } from '../ui/Logo'
import { ArrowRight } from '../ui/Icons'
import './navbar.css'

export function Navbar() {
  const t = useT()
  return (
    <header className="navbar">
      <div className="shell navbar__inner">
        <Logo />

        <div className="navbar__actions">
          <LanguageToggle variant="ghost" />
          <a className="btn btn--ghost" href="/login">
            {t('landing.nav.login')}
          </a>
          <a className="btn btn--accent" href="/signup">
            {t('landing.cta.getStarted')}
            <ArrowRight width="18" height="18" />
          </a>
        </div>
      </div>
    </header>
  )
}
