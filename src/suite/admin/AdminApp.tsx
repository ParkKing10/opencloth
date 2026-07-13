import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/auth'
import { useSuiteTheme } from '../theme'
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

const NAV = [
  { to: '/admin', label: 'Overview', icon: IcoDashboard, end: true },
  { to: '/admin/garments', label: 'Garments', icon: IcoGrid },
  { to: '/admin/users', label: 'Users', icon: IcoCommunity },
  { to: '/admin/designs', label: 'Designs', icon: IcoDesign },
  { to: '/admin/manufacturers', label: 'Manufacturers', icon: IcoFactory },
  { to: '/admin/orders', label: 'Orders', icon: IcoProduction },
  { to: '/admin/settings', label: 'Platform', icon: IcoSettings },
]

export function AdminApp() {
  const { user, logout } = useAuth()
  const { theme, toggle } = useSuiteTheme()
  const navigate = useNavigate()

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
              <span className="adm__tag">Admin Console</span>
            </span>
          </div>

          <nav className="adm__nav" aria-label="Admin navigation">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => `adm__item${isActive ? ' is-active' : ''}`}
              >
                <Icon width="18" height="18" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="adm__foot">
            <button className="adm__back" type="button" onClick={() => navigate('/suite')}>
              <IcoArrowRight width="15" height="15" style={{ transform: 'scaleX(-1)' }} />
              Back to app
            </button>
            <div className="adm__user">
              <span className="adm__avatar">{(user?.name ?? 'A').slice(0, 2).toUpperCase()}</span>
              <span className="adm__user-text">
                <span className="adm__user-name">{user?.name}</span>
                <span className="adm__user-role">Administrator</span>
              </span>
              <button className="adm__logout" type="button" onClick={logout} aria-label="Log out">
                <IcoLogout width="16" height="16" />
              </button>
            </div>
          </div>
        </aside>

        <div className="adm__main">
          <header className="adm__topbar">
            <div className="adm__crumb">
              <span>Admin</span>
            </div>
            <div className="adm__topbar-actions">
              <button
                className="s-icon-btn"
                type="button"
                onClick={toggle}
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <IcoSun width="19" height="19" /> : <IcoMoon width="18" height="18" />}
              </button>
              <span className="adm__env">Production</span>
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
