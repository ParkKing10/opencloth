import { useState } from 'react'
import { useStore } from '../../data/store'
import { useToast } from '../../components/ui/Toast'
import { usePresentation } from '../../presentation/PresentationContext'

type Flag = { id: string; title: string; sub: string; on: boolean }

const INITIAL_FLAGS: Flag[] = [
  { id: 'ai', title: 'AI Designer', sub: 'Allow creators to generate designs with AI.', on: true },
  { id: 'market', title: 'Marketplace', sub: 'Enable buying and selling of templates.', on: true },
  { id: 'signups', title: 'Open signups', sub: 'Allow new accounts to be created.', on: true },
  { id: 'maintenance', title: 'Maintenance mode', sub: 'Show a maintenance banner to all users.', on: false },
]

export function AdminSettings() {
  const { reset } = useStore()
  const toast = useToast()
  const presentation = usePresentation()
  const [flags, setFlags] = useState<Flag[]>(INITIAL_FLAGS)

  function togglePresentation() {
    const next = !presentation.enabled
    presentation.setEnabled(next)
    toast(`Presentation Mode ${next ? 'enabled' : 'disabled'}.`, next ? 'success' : 'default')
  }

  function toggle(id: string) {
    setFlags((prev) => prev.map((f) => (f.id === id ? { ...f, on: !f.on } : f)))
    const f = flags.find((x) => x.id === id)
    if (f) toast(`${f.title} ${f.on ? 'disabled' : 'enabled'}.`, 'default')
  }

  function resetData() {
    reset()
    toast('Demo data reset to defaults.', 'success')
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>Platform settings</h1>
        <p style={{ marginTop: 8, fontSize: 14, color: 'var(--s-text-2)' }}>Control features and platform-wide configuration.</p>
      </header>

      <div className="adm-panel" style={{ marginBottom: 20 }}>
        <div className="adm-panel__head">
          <h2>Presentation Mode</h2>
        </div>
        <div style={{ padding: 6 }}>
          <div className="adm-flag">
            <div>
              <div className="adm-flag__title">Presentation Mode</div>
              <div className="adm-flag__sub">
                Cinematic demo experience for keynotes, investors &amp; recordings. Admin-only — never visible to normal
                users. Adds premium animations and a scripted ▶ Start Presentation walkthrough. Never changes production data.
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={presentation.enabled}
              aria-label="Presentation Mode"
              className={`adm-switch${presentation.enabled ? ' is-on' : ''}`}
              onClick={togglePresentation}
            />
          </div>
        </div>
      </div>

      <div className="adm-panel" style={{ marginBottom: 20 }}>
        <div className="adm-panel__head">
          <h2>Feature flags</h2>
        </div>
        <div style={{ padding: 6 }}>
          {flags.map((f) => (
            <div key={f.id} className="adm-flag">
              <div>
                <div className="adm-flag__title">{f.title}</div>
                <div className="adm-flag__sub">{f.sub}</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={f.on}
                aria-label={f.title}
                className={`adm-switch${f.on ? ' is-on' : ''}`}
                onClick={() => toggle(f.id)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="adm-panel adm-danger">
        <div className="adm-panel__head">
          <h2>Danger zone</h2>
        </div>
        <div className="adm-danger__row">
          <div>
            <div className="adm-flag__title">Reset demo data</div>
            <div className="adm-flag__sub">Restore all users, designs and orders to the seeded defaults.</div>
          </div>
          <button className="adm-mini-btn adm-mini-btn--danger" type="button" onClick={resetData}>
            Reset data
          </button>
        </div>
      </div>
    </div>
  )
}
