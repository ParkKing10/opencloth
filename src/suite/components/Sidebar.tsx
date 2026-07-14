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
  IcoBolt,
  IcoSettings,
  IcoCoins,
  IcoChevron,
  IcoShield,
  IcoLogout,
} from './ui/Icons'
import { useAuth } from '../auth/auth'
import { McpModal } from './McpModal'
import { useT } from '@/i18n'
import loomLogo from '../../assets/loom-logo.png'
import './sidebar.css'

type NavItem = { to: string; label: string; icon: typeof IcoDashboard; end?: boolean; badge?: boolean }

// `label` holds the i18n key; it is translated at render.
const PRIMARY: NavItem[] = [
  { to: '/suite', label: 'nav.dashboard', icon: IcoDashboard, end: true },
  { to: '/suite/shop', label: 'nav.shop', icon: IcoMarketplace },
  { to: '/suite/garments', label: 'nav.garments', icon: IcoAI },
  { to: '/suite/design', label: 'nav.design', icon: IcoDesign },
  { to: '/suite/ai', label: 'nav.ai', icon: IcoAI, badge: true },
  { to: '/suite/collections', label: 'nav.collections', icon: IcoCollections },
  { to: '/suite/assets', label: 'nav.assets', icon: IcoGrid },
  { to: '/suite/manufacturers', label: 'nav.manufacturers', icon: IcoFactory },
  { to: '/suite/community', label: 'nav.community', icon: IcoCommunity },
  { to: '/suite/marketplace', label: 'nav.marketplace', icon: IcoMarketplace },
  { to: '/suite/rewards', label: 'nav.rewards', icon: IcoCoins, badge: true },
  { to: '/suite/analytics', label: 'nav.analytics', icon: IcoAnalytics },
  { to: '/suite/explainer', label: 'nav.explainer', icon: IcoBolt, badge: true },
  { to: '/suite/settings', label: 'nav.settings', icon: IcoSettings },
]

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'U'
}

export function Sidebar({ open = false, onClose }: { open?: boolean; onClose?: () => void } = {}) {
  const { user, isAdmin, logout } = useAuth()
  const navigate = useNavigate()
  const t = useT()
  const [menuOpen, setMenuOpen] = useState(false)
  const [mcpOpen, setMcpOpen] = useState(false)

  return (
    <>
      {/* Scrim behind the off-canvas drawer (compact viewports only; hidden on desktop via CSS). */}
      <div className={`sb__scrim${open ? ' is-open' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside className={`sb${open ? ' is-open' : ''}`}>
      <div className="sb__brand">
        <img className="sb__logo" src={loomLogo} alt="loom studios" />
        <span className="sb__tag">{t('shell.tag')}</span>
      </div>

      <nav className="sb__nav" aria-label="Suite Navigation">
        {PRIMARY.filter((i) => i.to !== '/suite/explainer' || isAdmin).map(({ to, label, icon: Icon, end, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onClose}
            data-tour={`nav-${to.split('/')[2] ?? 'dashboard'}`}
            className={({ isActive }) => `sb__item${isActive ? ' is-active' : ''}`}
          >
            <span className="sb__glow" aria-hidden="true" />
            <Icon className="sb__ico" width="19" height="19" />
            <span className="sb__label">{t(label)}</span>
            {badge && <span className="sb__badge">{t('common.new_badge')}</span>}
          </NavLink>
        ))}
        {isAdmin && (
          <NavLink to="/admin" onClick={onClose} className={({ isActive }) => `sb__item${isActive ? ' is-active' : ''}`}>
            <span className="sb__glow" aria-hidden="true" />
            <IcoShield className="sb__ico" width="19" height="19" />
            <span className="sb__label">{t('nav.admin')}</span>
          </NavLink>
        )}
      </nav>

      <div className="sb__foot">
        <div className="sb__meters">
          <div className="sb__coins" data-tour="sidebar-coins">
            <span className="sb__coins-left">
              <IcoCoins className="sb__coins-ico" width="17" height="17" />
              <span>
                <b>{(user?.coins ?? 0).toLocaleString()}</b>
                <small>{t('shell.coins')}</small>
              </span>
            </span>
            <button className="sb__buy" type="button" onClick={() => navigate('/suite/rewards')}>
              {t('shell.buy')}
            </button>
          </div>

          <button className="sb__mcp" type="button" onClick={() => setMcpOpen(true)}>
            <span className="sb__mcp-mark" aria-hidden="true">✳</span>
            <span className="sb__mcp-label">{t('mcp.button')}</span>
            <span className="sb__mcp-beta">{t('mcp.beta')}</span>
          </button>
        </div>

        <div className="sb__plan">
          <div className="sb__plan-info">
            <span className="sb__plan-label">{t('shell.currentPlan')}</span>
            <span className="sb__plan-name">{user?.plan ?? t('common.free')}</span>
          </div>
          <button className="sb__upgrade" type="button" onClick={() => navigate('/suite/pricing')}>
            {t('shell.upgrade')}
          </button>
        </div>

        <div className="sb__user-wrap">
          {menuOpen && (
            <>
              <div className="sb__menu-scrim" onClick={() => setMenuOpen(false)} />
              <div className="sb__menu">
                <button className="sb__menu-item" type="button" onClick={() => { setMenuOpen(false); navigate('/suite/settings') }}>
                  <IcoSettings width="16" height="16" /> {t('common.settings')}
                </button>
                {isAdmin && (
                  <button className="sb__menu-item" type="button" onClick={() => { setMenuOpen(false); navigate('/admin') }}>
                    <IcoShield width="16" height="16" /> {t('shell.adminConsole')}
                  </button>
                )}
                <button className="sb__menu-item sb__menu-item--danger" type="button" onClick={() => { logout(); navigate('/login') }}>
                  <IcoLogout width="16" height="16" /> {t('common.logout')}
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
      <McpModal open={mcpOpen} onClose={() => setMcpOpen(false)} />
    </>
  )
}
