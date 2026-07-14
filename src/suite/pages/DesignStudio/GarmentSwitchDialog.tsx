import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '@/i18n'
import './wizard.css'

/**
 * Asked when the user picks a different garment while a design with content is open. Nothing is ever
 * lost (each garment keeps its own saved design), but the choice is explicit: open the new garment as
 * its own design, or carry the current prints/graphics onto it.
 */
export function GarmentSwitchDialog({
  open,
  currentName,
  targetName,
  onOpenNew,
  onMoveHere,
  onCancel,
}: {
  open: boolean
  currentName: string
  targetName: string
  onOpenNew: () => void
  onMoveHere: () => void
  onCancel: () => void
}) {
  const t = useT()
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return createPortal(
    <div className="suite">
      <div className="wz-overlay ss-overlay" role="dialog" aria-modal="true" aria-labelledby="gsw-title" onClick={onCancel}>
        <div className="ss-shell" onClick={(e) => e.stopPropagation()}>
          <span className="wz-eyebrow">{t('dsDialogs.gsw.eyebrow')}</span>
          <h1 id="gsw-title" className="ss-title">{t('dsDialogs.gsw.openTarget', { name: targetName })}</h1>
          <p className="ss-sub">{t('dsDialogs.gsw.body', { current: currentName, target: targetName })}</p>

          <div className="ss-choices">
            <button type="button" className="ss-choice ss-choice--primary" onClick={onOpenNew} autoFocus>
              <span className="ss-choice__eyebrow">{t('dsDialogs.gsw.newDesign')}</span>
              <span className="ss-choice__title">{t('dsDialogs.gsw.openTitle', { name: targetName })}</span>
              <span className="ss-choice__hint">{t('dsDialogs.gsw.staysSaved', { current: currentName })}</span>
            </button>
            <button type="button" className="ss-choice" onClick={onMoveHere}>
              <span className="ss-choice__eyebrow">{t('dsDialogs.gsw.moveDesign')}</span>
              <span className="ss-choice__title">{t('dsDialogs.gsw.bringOnto', { name: targetName })}</span>
              <span className="ss-choice__hint">{t('dsDialogs.gsw.carryOver')}</span>
            </button>
          </div>

          <button type="button" className="ss-cancel" onClick={onCancel}>{t('dsDialogs.gsw.cancelStay', { current: currentName })}</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
