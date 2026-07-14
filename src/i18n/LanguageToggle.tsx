import { LANGS, useI18n } from './I18nProvider'
import './language-toggle.css'

/**
 * Compact EN / DE segmented switch. Drop it anywhere (marketing navbar, suite topbar, admin bar,
 * auth screen). `variant` only tweaks the visual weight for light vs. dark surroundings.
 */
export function LanguageToggle({ variant = 'default' }: { variant?: 'default' | 'ghost' }) {
  const { lang, setLang } = useI18n()
  return (
    <div className={`lang-toggle lang-toggle--${variant}`} role="group" aria-label="Language">
      {LANGS.map((l) => (
        <button
          key={l.id}
          type="button"
          className={`lang-toggle__opt${lang === l.id ? ' is-active' : ''}`}
          aria-pressed={lang === l.id}
          title={l.long}
          onClick={() => setLang(l.id)}
        >
          {l.label}
        </button>
      ))}
    </div>
  )
}
