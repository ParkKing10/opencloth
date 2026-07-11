import { useEffect } from 'react'
import { createPortal } from 'react-dom'
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
          <span className="wz-eyebrow">Switch garment</span>
          <h1 id="gsw-title" className="ss-title">Open {targetName}?</h1>
          <p className="ss-sub">Your work on “{currentName}” is saved. Start a fresh design on {targetName}, or bring your current design onto it.</p>

          <div className="ss-choices">
            <button type="button" className="ss-choice ss-choice--primary" onClick={onOpenNew} autoFocus>
              <span className="ss-choice__eyebrow">New design</span>
              <span className="ss-choice__title">Open {targetName}</span>
              <span className="ss-choice__hint">“{currentName}” stays saved separately</span>
            </button>
            <button type="button" className="ss-choice" onClick={onMoveHere}>
              <span className="ss-choice__eyebrow">Move design</span>
              <span className="ss-choice__title">Bring this design onto {targetName}</span>
              <span className="ss-choice__hint">Carry your prints &amp; graphics over</span>
            </button>
          </div>

          <button type="button" className="ss-cancel" onClick={onCancel}>Cancel — stay on “{currentName}”</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
