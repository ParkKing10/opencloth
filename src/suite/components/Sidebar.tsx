import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  IcoDashboard,
  IcoDesign,
  IcoAI,
  IcoFactory,
  IcoGrid,
  IcoCollections,
  IcoCommunity,
  IcoMarketplace,
  IcoAnalytics,
  IcoSettings,
  IcoCoins,
  IcoChevron,
  IcoShield,
  IcoLogout,
} from './ui/Icons'
import { useAuth } from '../auth/auth'
import { useStorageEstimate } from '../lib/useStorageEstimate'
import './sidebar.css'

type NavItem = { to: string; label: string; icon: typeof IcoDashboard; end?: boolean; badge?: string }

const PRIMARY: NavItem[] = [
  { to: '/suite', label: 'Dashboard', icon: IcoDashboard, end: true },
  { to: '/suite/shop', label: 'Garment Shop', icon: IcoMarketplace },
  { to: '/suite/garments', label: 'Garments Studio', icon: IcoAI },
  { to: '/suite/design', label: 'Design Studio', icon: IcoDesign },
  { to: '/suite/ai', label: 'AI Designer', icon: IcoAI, badge: 'NEW' },
  { to: '/suite/collections', label: 'Collections', icon: IcoCollections },
  { to: '/suite/assets', label: 'Assets', icon: IcoGrid },
  { to: '/suite/manufacturers', label: 'Manufacturers', icon: IcoFactory },
  { to: '/suite/community', label: 'Community', icon: IcoCommunity },
  { to: '/suite/marketplace', label: 'Marketplace', icon: IcoMarketplace },
  { to: '/suite/analytics', label: 'Analytics', icon: IcoAnalytics },
  { to: '/suite/settings', label: 'Settings', icon: IcoSettings },
]

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'U'
}

export function Sidebar() {
  const { user, isAdmin, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  // Real browser-reported storage for this workspace — never a fabricated figure.
  const storage = useStorageEstimate()

  return (
    <aside className="sb">
      <div className="sb__brand">
        <span className="sb__mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" width="20" height="20">
            <path d="M16 4 L28 11 L16 18 L4 11 Z M4 15 L16 22 L28 15 L28 18 L16 25 L4 18 Z" fill="currentColor" />
          </svg>
        </span>
        <span className="sb__brand-text">
          <span className="sb__name">loom studios</span>
          <span className="sb__tag">Design. Build. Brand.</span>
        </span>
      </div>

      <nav className="sb__nav" aria-label="Suite Navigation">
        {PRIMARY.map(({ to, label, icon: Icon, end, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `sb__item${isActive ? ' is-active' : ''}`}
          >
            <span className="sb__glow" aria-hidden="true" />
            <Icon className="sb__ico" width="19" height="19" />
            <span className="sb__label">{label}</span>
            {badge && <span className="sb__badge">{badge}</span>}
          </NavLink>
        ))}
        {isAdmin && (
          <NavLink to="/admin" className={({ isActive }) => `sb__item${isActive ? ' is-active' : ''}`}>
            <span className="sb__glow" aria-hidden="true" />
            <IcoShield className="sb__ico" width="19" height="19" />
            <span className="sb__label">Admin Console</span>
          </NavLink>
        )}
      </nav>

      <div className="sb__foot">
        <div className="sb__meters">
          <div className="sb__coins">
            <span className="sb__coins-left">
              <IcoCoins className="sb__coins-ico" width="17" height="17" />
              <span>
                <b>{(user?.coins ?? 0).toLocaleString()}</b>
                <small>Coins</small>
              </span>
            </span>
            <button className="sb__buy" type="button" onClick={() => navigate('/suite/settings?section=billing')}>
              Buy
            </button>
          </div>

          <div className="sb__storage">
            <div className="sb__storage-top">
              <span>Storage</span>
              <span className="sb__storage-pct" title={storage.ready ? storage.label : 'Measuring…'}>
                {!storage.ready ? '…' : storage.pct && storage.pct > 0 ? `${storage.pct}%` : storage.usedLabel}
              </span>
            </div>
            {storage.pct !== null && (
              <div className="sb__bar">
                <span style={{ width: `${Math.max(2, storage.pct)}%` }} />
              </div>
            )}
          </div>
        </div>

        <div className="sb__plan">
          <div className="sb__plan-info">
            <span className="sb__plan-label">Current plan</span>
            <span className="sb__plan-name">{user?.plan ?? 'Free'}</span>
          </div>
          <button className="sb__upgrade" type="button" onClick={() => navigate('/suite/settings?section=billing')}>
            Upgrade
          </button>
        </div>

        <div className="sb__user-wrap">
          {menuOpen && (
            <>
              <div className="sb__menu-scrim" onClick={() => setMenuOpen(false)} />
              <div className="sb__menu">
                <button className="sb__menu-item" type="button" onClick={() => { setMenuOpen(false); navigate('/suite/settings') }}>
                  <IcoSettings width="16" height="16" /> Settings
                </button>
                {isAdmin && (
                  <button className="sb__menu-item" type="button" onClick={() => { setMenuOpen(false); navigate('/admin') }}>
                    <IcoShield width="16" height="16" /> Admin console
                  </button>
                )}
                <button className="sb__menu-item sb__menu-item--danger" type="button" onClick={() => { logout(); navigate('/login') }}>
                  <IcoLogout width="16" height="16" /> Log out
                </button>
              </div>
            </>
          )}
          <button className="sb__user" type="button" onClick={() => setMenuOpen((o) => !o)}>
            <span className="sb__avatar">{initials(user?.name ?? 'User')}</span>
            <span className="sb__user-text">
              <span className="sb__user-name">{user?.name ?? 'User'}</span>
              <span className="sb__user-mail">{user?.email ?? ''}</span>
            </span>
            <IcoChevron className="sb__user-chev" width="15" height="15" />
          </button>
        </div>
      </div>
    </aside>
  )
}
