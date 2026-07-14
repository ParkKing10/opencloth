import { useStore } from '../../data/store'
import { useT } from '../../../i18n'

const STAGE_BADGE: Record<string, string> = {
  sample: 'adm-badge--muted',
  production: 'adm-badge--role',
  qc: 'adm-badge--role',
  shipping: 'adm-badge--role',
  delivered: 'adm-badge--active',
}

export function AdminOrders() {
  const { data } = useStore()
  const t = useT()
  const units = data.orders.reduce((sum, o) => sum + o.qty, 0)

  return (
    <div>
      <header style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>{t('adminPages.orders.title')}</h1>
        <p style={{ marginTop: 8, fontSize: 14, color: 'var(--s-text-2)' }}>
          {t('adminPages.orders.subtitle', { orders: data.orders.length, units: units.toLocaleString() })}
        </p>
      </header>

      <div className="adm-panel">
        <table className="adm-table">
          <thead>
            <tr>
              <th>{t('adminPages.col.order')}</th>
              <th>{t('adminPages.col.qty')}</th>
              <th>{t('adminPages.col.manufacturer')}</th>
              <th>{t('adminPages.col.stage')}</th>
              <th>{t('adminPages.col.progress')}</th>
              <th>{t('adminPages.col.eta')}</th>
            </tr>
          </thead>
          <tbody>
            {data.orders.map((o) => (
              <tr key={o.id}>
                <td style={{ color: 'var(--s-text)', fontWeight: 600 }}>{o.designName}</td>
                <td>×{o.qty}</td>
                <td>
                  {o.manufacturer} · {o.country}
                </td>
                <td>
                  <span className={`adm-badge ${STAGE_BADGE[o.stage]}`}>{t(`adminPages.stage.${o.stage}`)}</span>
                </td>
                <td>{o.progress}%</td>
                <td>{o.eta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
