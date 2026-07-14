import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '@/i18n'
import './wizard.css'

/**
 * Shown the moment the Design Studio opens from the nav (not from a specific garment). Instead of
 * silently reopening whatever was last edited — which reads as "the app ignored me" — it asks the
 * one question that matters: keep going, or start fresh. If there is nothing to continue, the
 * Studio skips straight to the New Design wizard and this dialog never appears.
 */
export function SessionStartDialog({
  open,
  lastName,
  onContinue,
  onNew,
}: {
  open: boolean
  lastName: string
  onContinue: () => void
  onNew: () => void
}) {
  const t = useT()
  // Enter continues the open design (the safe default); N starts a new one.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') onContinue()
      else if (e.key.toLowerCase() === 'n') onNew()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onContinue, onNew])

  if (!open) return null

  return createPortal(
    <div className="suite">
      <div className="wz-overlay ss-overlay" role="dialog" aria-modal="true" aria-labelledby="ss-title">
        <div className="ss-shell">
          <span className="wz-eyebrow">{t('dsDialogs.ss.eyebrow')}</span>
          <h1 id="ss-title" className="ss-title">{t('dsDialogs.ss.welcomeBack')}</h1>
          <p className="ss-sub">{t('dsDialogs.ss.sub')}</p>

          <div className="ss-choices">
            <button type="button" className="ss-choice ss-choice--primary" onClick={onContinue} autoFocus>
              <span className="ss-choice__eyebrow">{t('dsDialogs.ss.continue')}</span>
              <span className="ss-choice__title">{lastName}</span>
              <span className="ss-choice__hint">{t('dsDialogs.ss.reopenHint')}</span>
            </button>
            <button type="button" className="ss-choice" onClick={onNew}>
              <span className="ss-choice__eyebrow">{t('dsDialogs.ss.newFile')}</span>
              <span className="ss-choice__title">{t('dsDialogs.ss.startNew')}</span>
              <span className="ss-choice__hint">{t('dsDialogs.ss.freshHint')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
