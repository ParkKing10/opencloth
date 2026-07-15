import { NavLink, Outlet } from 'react-router-dom'
import { useT } from '@/i18n'
import './marketing.css'

/**
 * Marketing Studio shell — the product-within-the-product. A large premium header plus its own
 * sub-navigation; each section renders below via nested routes (/marketing/*).
 */

const NAV: { to: string; key: string; end?: boolean }[] = [
  { to: '/marketing', key: 'mk.nav.home', end: true },
  { to: '/marketing/templates', key: 'mk.nav.templates' },
  { to: '/marketing/characters', key: 'mk.nav.characters' },
  { to: '/marketing/products', key: 'mk.nav.products' },
  { to: '/marketing/campaigns', key: 'mk.nav.campaigns' },
  { to: '/marketing/assets', key: 'mk.nav.assets' },
  { to: '/marketing/library', key: 'mk.nav.library' },
  { to: '/marketing/brand', key: 'mk.nav.brand' },
]

export function MarketingShell() {
  const t = useT()
  return (
    <div className="mst">
      <header className="mst-head">
        <div className="mst-head__ident">
          <p className="mst-head__eyebrow">{t('mk.eyebrow')}</p>
          <h1 className="mst-head__title">{t('mk.title')}</h1>
          <p className="mst-head__sub">{t('mk.subtitle')}</p>
        </div>
      </header>

      <nav className="mst-nav" aria-label={t('mk.title')}>
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `mst-nav__item${isActive ? ' is-active' : ''}`}
          >
            {t(item.key)}
          </NavLink>
        ))}
      </nav>

      <div className="mst-body">
        <Outlet />
      </div>
    </div>
  )
}
