import { useMemo, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { IcoSearch, IcoPlus, IcoBell, IcoHelp, IcoCoins, IcoSun, IcoMoon } from './ui/Icons'
import { useSuiteTheme } from '../theme'
import { useAuth } from '../auth/auth'
import { useStore } from '../data/store'
import { useToast } from './ui/Toast'
import './topbar.css'

const SEARCH_ROUTES: { keywords: string[]; to: string; label: string }[] = [
  { keywords: ['design', 'studio', 'editor'], to: '/suite/design', label: 'Design Studio' },
  { keywords: ['shop', 'buy', 'garment', 'coins'], to: '/suite/shop', label: 'Garment Shop' },
  { keywords: ['ai', 'generate'], to: '/suite/ai', label: 'AI Designer' },
  { keywords: ['tech', 'pack', 'spec'], to: '/suite/tech-packs', label: 'Tech Packs' },
  { keywords: ['manufacturer', 'factory', 'supplier'], to: '/suite/manufacturers', label: 'Manufacturers' },
  { keywords: ['collection', 'drop', 'season'], to: '/suite/collections', label: 'Collections' },
  { keywords: ['asset', 'graphic', 'patch', 'sticker', 'print'], to: '/suite/assets', label: 'Assets' },
  { keywords: ['community', 'designer'], to: '/suite/community', label: 'Community' },
  { keywords: ['market', 'template', 'buy'], to: '/suite/marketplace', label: 'Marketplace' },
  { keywords: ['analytic', 'revenue', 'stat'], to: '/suite/analytics', label: 'Analytics' },
  { keywords: ['setting', 'account', 'billing'], to: '/suite/settings', label: 'Settings' },
]

export function Topbar({ onMenu }: { onMenu?: () => void }) {
  const { theme, toggle } = useSuiteTheme()
  const { user } = useAuth()
  const { data, mutate } = useStore()
  const toast = useToast()
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [notifOpen, setNotifOpen] = useState(false)

  const unread = useMemo(() => data.notifications.filter((n) => !n.read).length, [data.notifications])

  function runSearch(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    const q = query.trim().toLowerCase()
    if (!q) return
    const match = SEARCH_ROUTES.find((r) => r.keywords.some((k) => q.includes(k)))
    if (match) {
      navigate(match.to)
      toast(`Opened ${match.label}`, 'default')
    } else {
      toast(`No results for “${query}”`, 'info')
    }
    setQuery('')
  }

  function openNotifs() {
    setNotifOpen((o) => {
      const next = !o
      if (next && unread > 0) {
        mutate((d) => ({ ...d, notifications: d.notifications.map((n) => ({ ...n, read: true })) }))
      }
      return next
    })
  }

  return (
    <header className="tb">
      <button className="tb__menu" type="button" aria-label="Open navigation" onClick={onMenu}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
      </button>

      <label className="tb__search">
        <IcoSearch className="tb__search-ico" width="17" height="17" />
        <input
          type="text"
          placeholder="Search designs, tech packs, manufacturers…"
          aria-label="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={runSearch}
        />
        <kbd className="tb__kbd">↵</kbd>
      </label>

      <div className="tb__actions">
        <span className="tb__coins" title="Coins">
          <IcoCoins className="tb__coins-ico" width="16" height="16" />
          {(user?.coins ?? 0).toLocaleString()}
        </span>

        <button
          className="s-icon-btn"
          type="button"
          onClick={toggle}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
        >
          {theme === 'dark' ? <IcoSun width="19" height="19" /> : <IcoMoon width="18" height="18" />}
        </button>

        <button className="s-icon-btn" type="button" aria-label="Help" onClick={() => toast('Help centre is coming soon.', 'info')}>
          <IcoHelp width="19" height="19" />
        </button>

        <div className="tb__notif-wrap">
          <button className="s-icon-btn tb__bell" type="button" aria-label="Notifications" onClick={openNotifs}>
            <IcoBell width="19" height="19" />
            {unread > 0 && <span className="tb__badge">{unread}</span>}
          </button>
          {notifOpen && (
            <>
              <div className="tb__scrim" onClick={() => setNotifOpen(false)} />
              <div className="tb__notif">
                <div className="tb__notif-head">Notifications</div>
                <div className="tb__notif-list">
                  {data.notifications.map((n) => (
                    <div className="tb__notif-item" key={n.id}>
                      <span className={`tb__notif-dot tb__notif-dot--${n.tone}`} />
                      <span className="tb__notif-text">
                        <b>{n.title}</b>
                        <small>{n.body}</small>
                      </span>
                      <span className="tb__notif-time">{n.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <span className="tb__divider" aria-hidden="true" />

        <button className="s-btn s-btn--accent tb__new" type="button" onClick={() => navigate('/suite/design')} aria-label="New Design">
          <IcoPlus width="17" height="17" />
          <span className="tb__new-label">New Design</span>
        </button>
      </div>
    </header>
  )
}
