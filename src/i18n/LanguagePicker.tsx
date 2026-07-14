import { useState } from 'react'
import { useI18n, type Lang } from './I18nProvider'
import './language-picker.css'

const STORAGE_KEY = 'loom-lang'

function alreadyChosen(): boolean {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'en' || v === 'de'
  } catch {
    return false
  }
}

/**
 * First-visit language gate. The very first time someone opens the app with no saved language, this
 * asks EN or DE before anything else. The choice is persisted (setLang writes localStorage), so the
 * gate never shows again. Copy is bilingual — the user hasn't picked a language yet.
 */
export function LanguagePicker() {
  const { setLang } = useI18n()
  const [open, setOpen] = useState(() => !alreadyChosen())
  if (!open) return null

  const pick = (l: Lang) => {
    setLang(l) // persists to localStorage under `loom-lang`
    setOpen(false)
  }

  return (
    <div className="lgp" role="dialog" aria-modal="true" aria-labelledby="lgp-title">
      <div className="lgp__card">
        <span className="lgp__mark" aria-hidden="true" />
        <h2 id="lgp-title" className="lgp__title">
          Choose your language
          <span>Wähle deine Sprache</span>
        </h2>
        <div className="lgp__opts">
          <button type="button" className="lgp__opt" onClick={() => pick('en')}>
            <span className="lgp__badge">EN</span>
            <span className="lgp__opt-txt">
              <b>English</b>
              <small>Continue in English</small>
            </span>
          </button>
          <button type="button" className="lgp__opt" onClick={() => pick('de')}>
            <span className="lgp__badge">DE</span>
            <span className="lgp__opt-txt">
              <b>Deutsch</b>
              <small>Auf Deutsch fortfahren</small>
            </span>
          </button>
        </div>
        <p className="lgp__hint">You can change this anytime · Jederzeit änderbar</p>
      </div>
    </div>
  )
}
