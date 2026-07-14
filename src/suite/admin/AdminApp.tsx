import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useT, LanguageToggle } from '@/i18n'
import { useAuth } from '../auth/auth'
import { useSuiteTheme } from '../theme'
import { useIsPhone } from '../lib/useMediaQuery'
import { DesktopOnly } from '../components/DesktopOnly'
import {
  IcoDashboard,
  IcoCommunity,
  IcoDesign,
  IcoFactory,
  IcoProduction,
  IcoSettings,
  IcoLogout,
  IcoArrowRight,
  IcoSun,
  IcoMoon,
  IcoShield,
  IcoGrid,
} from '../components/ui/Icons'
import '../suite.css'
import './admin.css'

// `label` holds the i18n key; it is translated at render.
const NAV = [
  { to: '/admin', label: 'adminShell.nav.overview', icon: IcoDashboard, end: true },
  { to: '/admin/garments', label: 'adminShell.nav.garments', icon: IcoGrid },
  { to: '/admin/accessories', label: 'adminShell.nav.accessories', icon: IcoDesign },
  { to: '/admin/users', label: 'adminShell.nav.users', icon: IcoCommunity },
  { to: '/admin/designs', label: 'adminShell.nav.designs', icon: IcoDesign },
  { to: '/admin/manufacturers', label: 'adminShell.nav.manufacturers', icon: IcoFactory },
  { to: '/admin/orders', label: 'adminShell.nav.orders', icon: IcoProduction },
  { to: '/admin/settings', label: 'adminShell.nav.platform', icon: IcoSettings },
]

export function AdminApp() {
  const { user, logout } = useAuth()
  const { theme, toggle } = useSuiteTheme()
  const navigate = useNavigate()
  const isPhone = useIsPhone()
  const t = useT()

  // The admin console is a dense, desktop-oriented internal tool — gate it on phones.
  if (isPhone) {
    return (
      <DesktopOnly
        title={t('adminShell.gate.title')}
        message={t('adminShell.gate.message')}
        backTo="/"
        backLabel={t('adminShell.backToApp')}
      />
    )
  }

  return (
    <div className="suite adm">
      <div className="adm__body">
        <aside className="adm__sidebar">
          <div className="adm__brand">
            <span className="adm__mark">
              <IcoShield width="18" height="18" />
            </span>
            <span className="adm__brand-text">
              <span className="adm__name">loom studios</span>
              <span className="adm__tag">{t('adminShell.tag')}</span>
            </span>
          </div>

          <nav className="adm__nav" aria-label={t('adminShell.nav.aria')}>
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => `adm__item${isActive ? ' is-active' : ''}`}
              >
                <Icon width="18" height="18" />
                <span>{t(label)}</span>
              </NavLink>
            ))}
          </nav>

          <div className="adm__foot">
            <button className="adm__back" type="button" onClick={() => navigate('/')}>
              <IcoArrowRight width="15" height="15" style={{ transform: 'scaleX(-1)' }} />
              {t('adminShell.backToApp')}
            </button>
            <div className="adm__user">
              <span className="adm__avatar">{(user?.name ?? 'A').slice(0, 2).toUpperCase()}</span>
              <span className="adm__user-text">
                <span className="adm__user-name">{user?.name}</span>
                <span className="adm__user-role">{t('adminShell.role')}</span>
              </span>
              <button className="adm__logout" type="button" onClick={logout} aria-label={t('adminShell.logout')}>
                <IcoLogout width="16" height="16" />
              </button>
            </div>
          </div>
        </aside>

        <div className="adm__main">
          <header className="adm__topbar">
            <div className="adm__crumb">
              <span>{t('adminShell.crumb')}</span>
            </div>
            <div className="adm__topbar-actions">
              <LanguageToggle />
              <button
                className="s-icon-btn"
                type="button"
                onClick={toggle}
                aria-label={t('adminShell.toggleTheme')}
              >
                {theme === 'dark' ? <IcoSun width="19" height="19" /> : <IcoMoon width="18" height="18" />}
              </button>
              <span className="adm__env">{t('adminShell.env')}</span>
            </div>
          </header>
          <div className="adm__content">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  )
}
