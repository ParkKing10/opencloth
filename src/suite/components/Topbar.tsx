import { IcoSearch, IcoPlus, IcoBell, IcoHelp, IcoCoins, IcoSun, IcoMoon } from './ui/Icons'
import { useSuiteTheme } from '../theme'
import './topbar.css'

export function Topbar() {
  const { theme, toggle } = useSuiteTheme()

  return (
    <header className="tb">
      <label className="tb__search">
        <IcoSearch className="tb__search-ico" width="17" height="17" />
        <input
          type="text"
          placeholder="Search designs, tech packs, manufacturers…"
          aria-label="Search"
        />
        <kbd className="tb__kbd">⌘K</kbd>
      </label>

      <div className="tb__actions">
        <span className="tb__coins" title="Coins">
          <IcoCoins className="tb__coins-ico" width="16" height="16" />
          12,540
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

        <button className="s-icon-btn" type="button" aria-label="Help">
          <IcoHelp width="19" height="19" />
        </button>

        <button className="s-icon-btn tb__bell" type="button" aria-label="Notifications">
          <IcoBell width="19" height="19" />
          <span className="tb__badge">3</span>
        </button>

        <span className="tb__divider" aria-hidden="true" />

        <button className="s-btn s-btn--accent tb__new" type="button">
          <IcoPlus width="17" height="17" />
          New Design
        </button>
      </div>
    </header>
  )
}
