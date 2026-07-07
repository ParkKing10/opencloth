import { NavLink } from 'react-router-dom'
import {
  IcoDashboard,
  IcoDesign,
  IcoPattern,
  IcoAI,
  IcoTechPack,
  IcoFactory,
  IcoProduction,
  IcoCollections,
  IcoCommunity,
  IcoMarketplace,
  IcoAnalytics,
  IcoSettings,
  IcoCoins,
  IcoChevron,
} from './ui/Icons'
import './sidebar.css'

type NavItem = { to: string; label: string; icon: typeof IcoDashboard; end?: boolean; badge?: string }

const PRIMARY: NavItem[] = [
  { to: '/suite', label: 'Dashboard', icon: IcoDashboard, end: true },
  { to: '/suite/design', label: 'Design Studio', icon: IcoDesign },
  { to: '/suite/pattern', label: 'Pattern Studio', icon: IcoPattern },
  { to: '/suite/ai', label: 'AI Designer', icon: IcoAI, badge: 'NEW' },
  { to: '/suite/tech-packs', label: 'Tech Packs', icon: IcoTechPack },
  { to: '/suite/manufacturers', label: 'Manufacturers', icon: IcoFactory },
  { to: '/suite/production', label: 'Production', icon: IcoProduction },
  { to: '/suite/collections', label: 'Collections', icon: IcoCollections },
  { to: '/suite/community', label: 'Community', icon: IcoCommunity },
  { to: '/suite/marketplace', label: 'Marketplace', icon: IcoMarketplace },
  { to: '/suite/analytics', label: 'Analytics', icon: IcoAnalytics },
  { to: '/suite/settings', label: 'Settings', icon: IcoSettings },
]

export function Sidebar() {
  return (
    <aside className="sb">
      <div className="sb__brand">
        <span className="sb__mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" width="20" height="20">
            <path d="M5 6h22v5h-8v15h-6V11H5V6Z" fill="currentColor" />
          </svg>
        </span>
        <span className="sb__brand-text">
          <span className="sb__name">THREADOS</span>
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
      </nav>

      <div className="sb__foot">
        <div className="sb__meters">
          <div className="sb__coins">
            <span className="sb__coins-left">
              <IcoCoins className="sb__coins-ico" width="17" height="17" />
              <span>
                <b>12,540</b>
                <small>Coins</small>
              </span>
            </span>
            <button className="sb__buy" type="button">
              Buy
            </button>
          </div>

          <div className="sb__storage">
            <div className="sb__storage-top">
              <span>Storage</span>
              <span className="sb__storage-pct">72%</span>
            </div>
            <div className="sb__bar">
              <span style={{ width: '72%' }} />
            </div>
          </div>
        </div>

        <div className="sb__plan">
          <div className="sb__plan-info">
            <span className="sb__plan-label">Current plan</span>
            <span className="sb__plan-name">Studio</span>
          </div>
          <button className="sb__upgrade" type="button">
            Upgrade
          </button>
        </div>

        <button className="sb__user" type="button">
          <span className="sb__avatar">MC</span>
          <span className="sb__user-text">
            <span className="sb__user-name">Mike Carter</span>
            <span className="sb__user-mail">mike@threados.com</span>
          </span>
          <IcoChevron className="sb__user-chev" width="15" height="15" />
        </button>
      </div>
    </aside>
  )
}
