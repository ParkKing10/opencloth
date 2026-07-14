import { useState } from 'react'
import { useStore } from '../../data/store'
import { useT } from '../../../i18n'
import { useToast } from '../../components/ui/Toast'
import { usePresentation } from '../../presentation/PresentationContext'

type Flag = { id: string; on: boolean }

const INITIAL_FLAGS: Flag[] = [
  { id: 'ai', on: true },
  { id: 'market', on: true },
  { id: 'signups', on: true },
  { id: 'maintenance', on: false },
]

export function AdminSettings() {
  const { reset } = useStore()
  const t = useT()
  const toast = useToast()
  const presentation = usePresentation()
  const [flags, setFlags] = useState<Flag[]>(INITIAL_FLAGS)

  function togglePresentation() {
    const next = !presentation.enabled
    presentation.setEnabled(next)
    toast(next ? t('adminPages.settings.toast.presentationEnabled') : t('adminPages.settings.toast.presentationDisabled'), next ? 'success' : 'default')
  }

  function toggle(id: string) {
    setFlags((prev) => prev.map((f) => (f.id === id ? { ...f, on: !f.on } : f)))
    const f = flags.find((x) => x.id === id)
    if (f) {
      const name = t(`adminPages.settings.flag.${f.id}.title`)
      toast(f.on ? t('adminPages.settings.toast.flagDisabled', { name }) : t('adminPages.settings.toast.flagEnabled', { name }), 'default')
    }
  }

  function resetData() {
    reset()
    toast(t('adminPages.settings.toast.dataReset'), 'success')
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>{t('adminPages.settings.title')}</h1>
        <p style={{ marginTop: 8, fontSize: 14, color: 'var(--s-text-2)' }}>{t('adminPages.settings.subtitle')}</p>
      </header>

      <div className="adm-panel" style={{ marginBottom: 20 }}>
        <div className="adm-panel__head">
          <h2>{t('adminPages.settings.presentationHeading')}</h2>
        </div>
        <div style={{ padding: 6 }}>
          <div className="adm-flag">
            <div>
              <div className="adm-flag__title">{t('adminPages.settings.presentationTitle')}</div>
              <div className="adm-flag__sub">{t('adminPages.settings.presentationSub')}</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={presentation.enabled}
              aria-label={t('adminPages.settings.presentationTitle')}
              className={`adm-switch${presentation.enabled ? ' is-on' : ''}`}
              onClick={togglePresentation}
            />
          </div>
        </div>
      </div>

      <div className="adm-panel" style={{ marginBottom: 20 }}>
        <div className="adm-panel__head">
          <h2>{t('adminPages.settings.featureFlags')}</h2>
        </div>
        <div style={{ padding: 6 }}>
          {flags.map((f) => (
            <div key={f.id} className="adm-flag">
              <div>
                <div className="adm-flag__title">{t(`adminPages.settings.flag.${f.id}.title`)}</div>
                <div className="adm-flag__sub">{t(`adminPages.settings.flag.${f.id}.sub`)}</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={f.on}
                aria-label={t(`adminPages.settings.flag.${f.id}.title`)}
                className={`adm-switch${f.on ? ' is-on' : ''}`}
                onClick={() => toggle(f.id)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="adm-panel adm-danger">
        <div className="adm-panel__head">
          <h2>{t('adminPages.settings.dangerZone')}</h2>
        </div>
        <div className="adm-danger__row">
          <div>
            <div className="adm-flag__title">{t('adminPages.settings.resetTitle')}</div>
            <div className="adm-flag__sub">{t('adminPages.settings.resetSub')}</div>
          </div>
          <button className="adm-mini-btn adm-mini-btn--danger" type="button" onClick={resetData}>
            {t('adminPages.settings.resetButton')}
          </button>
        </div>
      </div>
    </div>
  )
}
