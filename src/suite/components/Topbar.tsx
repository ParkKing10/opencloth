import { useState } from 'react'
import { IcoHelp, IcoSun, IcoMoon } from './ui/Icons'
import { TrialModal } from './TrialModal'
import { useSuiteTheme } from '../theme'
import { useT, LanguageMenu } from '@/i18n'
import { requestTour } from '../onboarding/tourBus'
import './topbar.css'

export function Topbar({ onMenu }: { onMenu?: () => void }) {
  const { theme, toggle } = useSuiteTheme()
  const t = useT()

  const [trialOpen, setTrialOpen] = useState(false)

  return (
    <header className="tb">
      <button className="tb__menu" type="button" aria-label={t('tb.openNav')} onClick={onMenu}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
      </button>

      <div className="tb__actions">
        {/* Language — globe + dropdown */}
        <LanguageMenu />

        <button
          className="s-icon-btn"
          type="button"
          onClick={toggle}
          aria-label={theme === 'dark' ? t('tb.switchToLight') : t('tb.switchToDark')}
          title={theme === 'dark' ? t('tb.lightMode') : t('tb.darkMode')}
        >
          {theme === 'dark' ? <IcoSun width="19" height="19" /> : <IcoMoon width="18" height="18" />}
        </button>

        {/* "?" starts the tour that belongs to the current page (app tour elsewhere). */}
        <button className="s-icon-btn" type="button" aria-label={t('tb.help')} title={t('tb.help')} onClick={() => requestTour()}>
          <IcoHelp width="19" height="19" />
        </button>

        <span className="tb__divider" aria-hidden="true" />

        {/* Premium trial CTA — glossy pill, opens the plan-picker modal with our prices. */}
        <button className="tb__trial" type="button" onClick={() => setTrialOpen(true)}>
          <span className="tb__trial-long">{t('trial.topCta')}</span>
          <span className="tb__trial-short">{t('trial.topCtaShort')}</span>
        </button>
      </div>

      <TrialModal open={trialOpen} onClose={() => setTrialOpen(false)} />
    </header>
  )
}
