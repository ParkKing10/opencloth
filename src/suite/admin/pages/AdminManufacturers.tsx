import { useStore } from '../../data/store'
import { useT } from '../../../i18n'
import { useToast } from '../../components/ui/Toast'
import { IcoStar } from '../../components/ui/Icons'

export function AdminManufacturers() {
  const { data, mutate } = useStore()
  const t = useT()
  const toast = useToast()

  function toggleVerified(id: string, name: string, verified: boolean) {
    mutate((d) => ({
      ...d,
      manufacturers: d.manufacturers.map((m) => (m.id === id ? { ...m, verified: !verified } : m)),
    }))
    toast(verified ? t('adminPages.manufacturers.toast.unverified', { name }) : t('adminPages.manufacturers.toast.verified', { name }), verified ? 'default' : 'success')
  }

  return (
    <div>
      <header style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>{t('adminPages.manufacturers.title')}</h1>
        <p style={{ marginTop: 8, fontSize: 14, color: 'var(--s-text-2)' }}>
          {t('adminPages.manufacturers.subtitle', { total: data.manufacturers.length, verified: data.manufacturers.filter((m) => m.verified).length })}
        </p>
      </header>

      <div className="adm-panel">
        <table className="adm-table">
          <thead>
            <tr>
              <th>{t('adminPages.col.factory')}</th>
              <th>{t('adminPages.col.location')}</th>
              <th>{t('adminPages.col.rating')}</th>
              <th>{t('adminPages.col.moq')}</th>
              <th>{t('adminPages.col.status')}</th>
              <th style={{ textAlign: 'right' }}>{t('adminPages.col.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {data.manufacturers.map((m) => (
              <tr key={m.id}>
                <td style={{ color: 'var(--s-text)', fontWeight: 600 }}>{m.name}</td>
                <td>
                  {m.city}, {m.country}
                </td>
                <td>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <IcoStar width="13" height="13" style={{ color: 'var(--s-warn)' }} /> {m.rating} · {m.reviews}
                  </span>
                </td>
                <td>{m.moq}</td>
                <td>
                  <span className={`adm-badge ${m.verified ? 'adm-badge--active' : 'adm-badge--muted'}`}>
                    {m.verified ? t('adminPages.manufacturers.verified') : t('adminPages.manufacturers.pending')}
                  </span>
                </td>
                <td>
                  <div className="adm-row-actions">
                    <button className="adm-mini-btn" type="button" onClick={() => toggleVerified(m.id, m.name, m.verified)}>
                      {m.verified ? t('adminPages.manufacturers.unverify') : t('adminPages.manufacturers.verify')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
