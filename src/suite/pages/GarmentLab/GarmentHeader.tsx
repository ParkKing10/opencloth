/**
 * Premium garment header (Milestone 9). One connected bar for the open garment: identity
 * (name · category · regions · last-saved · AI badge) and the workflow actions
 * (Back · Rename · Favorite · Save · Open Design Studio · Export), plus undo/redo and view toggle.
 */
import { useEffect, useRef, useState, type SVGProps } from 'react'
import { useT } from '@/i18n'

const IcoStar = (p: SVGProps<SVGSVGElement>) => (
  <svg width="16" height="16" viewBox="0 0 24 24" strokeWidth={1.6} strokeLinejoin="round" {...p}>
    <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9L12 3.5Z" />
  </svg>
)
const IcoDown = (p: SVGProps<SVGSVGElement>) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M6 9l6 6 6-6" />
  </svg>
)

export type GarmentHeaderProps = {
  name: string
  category: string
  regionCount: number
  isAi: boolean
  isFavorite: boolean
  savedLabel: string
  canUndo: boolean
  canRedo: boolean
  rev: string
  views: { id: string; label: string }[]
  view: string
  onBack: () => void
  onRename: (name: string) => void
  onToggleFavorite: () => void
  onSave: () => void
  onUndo: () => void
  onRedo: () => void
  onSetView: (id: string) => void
  onOpenDesignStudio: () => void
  onExportPng: () => void
  onExportThreados: () => void
}

export function GarmentHeader(props: GarmentHeaderProps) {
  const t = useT()
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(props.name)
  const [exportOpen, setExportOpen] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!exportOpen) return
    const close = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false)
    }
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [exportOpen])

  const startRename = () => {
    setDraft(props.name)
    setRenaming(true)
  }
  const commitRename = () => {
    props.onRename(draft)
    setRenaming(false)
  }

  return (
    <header className="gh">
      <button type="button" className="gh__back" onClick={props.onBack} aria-label={t('labMain.headerBackAria')}>
        ← {t('labMain.headerBackGarments')}
      </button>

      <div className="gh__id">
        {renaming ? (
          <input
            className="gh__name-input"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') setRenaming(false)
            }}
            aria-label={t('labMain.headerNameInputAria')}
          />
        ) : (
          <button type="button" className="gh__name" onClick={startRename} title={t('labMain.headerRenameTitle')}>
            {props.name}
          </button>
        )}
        <div className="gh__meta">
          <span>{props.category}</span>
          <i aria-hidden="true">·</i>
          <span>{props.views.map((v) => v.label).join(' + ')}</span>
          <i aria-hidden="true">·</i>
          <span>{t('labMain.headerRegions', { n: props.regionCount })}</span>
          <i aria-hidden="true">·</i>
          <span className="gh__chip gh__chip--editable">{t('labMain.headerEditable')}</span>
          <span className="gh__saved">
            <span className="gh__saved-dot" aria-hidden="true" />
            {props.savedLabel}
          </span>
          {props.isAi && <span className="gh__chip gh__ai">{t('labMain.headerAiBadge')}</span>}
        </div>
      </div>

      <div className="gh__history">
        <button type="button" className="gh__icbtn" onClick={props.onUndo} disabled={!props.canUndo} title={t('labMain.headerUndoTitle')} aria-label={t('labMain.headerUndo')}>
          ↶
        </button>
        <span className="gh__rev">{props.rev}</span>
        <button type="button" className="gh__icbtn" onClick={props.onRedo} disabled={!props.canRedo} title={t('labMain.headerRedoTitle')} aria-label={t('labMain.headerRedo')}>
          ↷
        </button>
      </div>

      <div className="gh__views" role="tablist" aria-label={t('labMain.headerViewAria')}>
        {props.views.map((v) => (
          <button key={v.id} type="button" role="tab" aria-selected={props.view === v.id} className={`gh__view${props.view === v.id ? ' is-active' : ''}`} onClick={() => props.onSetView(v.id)}>
            {v.label}
          </button>
        ))}
      </div>

      <div className="gh__actions">
        <button
          type="button"
          className={`gh__icon-action${props.isFavorite ? ' is-on' : ''}`}
          onClick={props.onToggleFavorite}
          title={props.isFavorite ? t('labMain.headerUnfavorite') : t('labMain.headerFavorite')}
          aria-pressed={props.isFavorite}
        >
          <IcoStar fill={props.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" />
        </button>
        <button type="button" className="gh__btn" onClick={startRename}>
          {t('labMain.headerRename')}
        </button>
        <button type="button" className="gh__btn" onClick={props.onSave} title={t('labMain.headerSaveTitle')}>
          {t('labMain.headerSave')}
        </button>
        <button type="button" className="gh__btn gh__btn--studio" onClick={props.onOpenDesignStudio}>
          {t('labMain.headerOpenStudio')}
        </button>
        <div className="gh__export" ref={exportRef}>
          <button type="button" className="gh__btn gh__btn--accent" onClick={() => setExportOpen((v) => !v)} aria-haspopup="menu" aria-expanded={exportOpen}>
            {t('labMain.headerExport')} <IcoDown />
          </button>
          {exportOpen && (
            <div className="gh__menu" role="menu">
              <button type="button" role="menuitem" onClick={() => { setExportOpen(false); props.onExportPng() }}>
                {t('labMain.headerExportPng')}
              </button>
              <button type="button" role="menuitem" onClick={() => { setExportOpen(false); props.onExportThreados() }}>
                {t('labMain.headerExportThreados')}
              </button>
              <span className="gh__menu-note">{t('labMain.headerExportNote')}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
