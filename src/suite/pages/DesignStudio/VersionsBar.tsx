import { useEffect, useRef, useState } from 'react'
import { useT } from '@/i18n'
import './versions.css'

export type VersionTab = { id: string; name: string }

type Props = {
  versions: VersionTab[]
  activeId: string
  onSwitch: (id: string) => void
  onAdd: () => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
}

/**
 * Versions bar — Canva-style boards for one design. Each tab is an independent variation of the same
 * garment; click to switch, double-click (or the pencil) to rename, × to delete, + to add a copy.
 * Only shows once there's more than one version OR on hover of the + (kept quiet for single designs).
 */
export function VersionsBar({ versions, activeId, onSwitch, onAdd, onRename, onDelete }: Props) {
  const t = useT()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId) inputRef.current?.select()
  }, [editingId])

  const startRename = (v: VersionTab) => {
    setEditingId(v.id)
    setDraft(v.name)
  }
  const commitRename = () => {
    if (editingId) onRename(editingId, draft)
    setEditingId(null)
  }

  const multiple = versions.length > 1

  return (
    <div className="vbar" role="tablist" aria-label={t('dsPanels.vb.aria')}>
      {multiple && <span className="vbar__label">{t('dsPanels.vb.versions')}</span>}
      <div className="vbar__tabs">
        {versions.map((v) => {
          const active = v.id === activeId
          if (editingId === v.id) {
            return (
              <input
                key={v.id}
                ref={inputRef}
                className="vbar__edit"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename()
                  else if (e.key === 'Escape') setEditingId(null)
                }}
                aria-label={t('dsPanels.vb.nameAria')}
              />
            )
          }
          return (
            <div key={v.id} className={`vbar__tab${active ? ' is-active' : ''}`}>
              <button
                type="button"
                role="tab"
                aria-selected={active}
                className="vbar__name"
                onClick={() => onSwitch(v.id)}
                onDoubleClick={() => startRename(v)}
                title={active ? t('dsPanels.vb.dblRename') : t('dsPanels.vb.switchTo', { name: v.name })}
              >
                {v.name}
              </button>
              {active && (
                <>
                  <button type="button" className="vbar__mini" title={t('dsPanels.vb.rename')} aria-label={t('dsPanels.vb.rename')} onClick={() => startRename(v)}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z" /></svg>
                  </button>
                  {multiple && (
                    <button type="button" className="vbar__mini vbar__mini--del" title={t('dsPanels.vb.delete')} aria-label={t('dsPanels.vb.delete')} onClick={() => onDelete(v.id)}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
      <button type="button" className="vbar__add" onClick={onAdd} title={t('dsPanels.vb.addTitle')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        {!multiple && <span>{t('dsPanels.vb.newVersion')}</span>}
      </button>
    </div>
  )
}
