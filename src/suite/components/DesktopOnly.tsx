import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import loomLogo from '../../assets/loom-logo.png'
import './desktop-only.css'

/**
 * A friendly full-screen "this works best on a bigger screen" gate. Shown on phones in place of the
 * heavy desktop-only surfaces (the Design Studio / Garment Lab editors, the Admin console). Optionally
 * shows a preview image of what the user was about to open, so the phone screen still feels useful.
 */
export function DesktopOnly({
  title,
  message,
  previewSrc,
  previewLabel,
  backTo = '/suite',
  backLabel = 'Back to dashboard',
  children,
}: {
  title: string
  message: string
  previewSrc?: string
  previewLabel?: string
  backTo?: string
  backLabel?: string
  children?: ReactNode
}) {
  const navigate = useNavigate()
  return (
    <div className="do-gate">
      <div className="do-gate__card">
        <img className="do-gate__logo" src={loomLogo} alt="loom studios" />

        {previewSrc && (
          <div className="do-gate__preview">
            <img src={previewSrc} alt={previewLabel ?? 'Preview'} />
            {previewLabel && <span className="do-gate__preview-label">{previewLabel}</span>}
          </div>
        )}

        <div className="do-gate__icon" aria-hidden="true">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2.5" y="4" width="19" height="13" rx="2" />
            <path d="M8.5 20.5h7M12 17v3.5" />
          </svg>
        </div>

        <h1 className="do-gate__title">{title}</h1>
        <p className="do-gate__msg">{message}</p>

        {children}

        <button className="s-btn s-btn--ghost do-gate__back" type="button" onClick={() => navigate(backTo)}>
          {backLabel}
        </button>
      </div>
    </div>
  )
}
