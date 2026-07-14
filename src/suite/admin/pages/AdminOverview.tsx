import { useStore } from '../../data/store'
import { useT } from '../../../i18n'

export function AdminOverview() {
  const { data } = useStore()
  const t = useT()

  const activeUsers = data.users.filter((u) => u.status === 'active').length
  const openOrders = data.orders.filter((o) => o.stage !== 'delivered').length
  const readyPacks = data.techPacks.filter((t) => t.status === 'ready').length

  const kpis = [
    { label: t('adminPages.overview.kpi.totalUsers'), value: String(data.users.length), delta: t('adminPages.overview.kpi.active', { n: activeUsers }) },
    { label: t('adminPages.overview.kpi.designs'), value: String(data.designs.length), delta: t('adminPages.overview.kpi.acrossCreators') },
    { label: t('adminPages.overview.kpi.openOrders'), value: String(openOrders), delta: t('adminPages.overview.kpi.totalOrders', { n: data.orders.length }) },
    { label: t('adminPages.overview.kpi.packsReady'), value: String(readyPacks), delta: t('adminPages.overview.kpi.productionReady') },
  ]

  const recent = [...data.users].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6)

  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>{t('adminPages.overview.title')}</h1>
        <p style={{ marginTop: 8, fontSize: 14, color: 'var(--s-text-2)' }}>
          {t('adminPages.overview.subtitle')}
        </p>
      </header>

      <div className="adm-kpis">
        {kpis.map((k) => (
          <article className="adm-kpi" key={k.label}>
            <div className="adm-kpi__label">{k.label}</div>
            <div className="adm-kpi__value">{k.value}</div>
            <div className="adm-kpi__delta">{k.delta}</div>
          </article>
        ))}
      </div>

      <div className="adm-panel">
        <div className="adm-panel__head">
          <h2>{t('adminPages.overview.recentSignups')}</h2>
        </div>
        <table className="adm-table">
          <thead>
            <tr>
              <th>{t('adminPages.col.user')}</th>
              <th>{t('adminPages.col.plan')}</th>
              <th>{t('adminPages.col.role')}</th>
              <th>{t('adminPages.col.status')}</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((u) => (
              <tr key={u.id}>
                <td>
                  <span className="adm-cell-user">
                    <span className="adm-cell-user__av">{u.name.slice(0, 2).toUpperCase()}</span>
                    <span>
                      <span className="adm-cell-user__name">{u.name}</span>
                      <br />
                      <span className="adm-cell-user__email">{u.email}</span>
                    </span>
                  </span>
                </td>
                <td>{u.plan}</td>
                <td>
                  <span className={`adm-badge ${u.role === 'admin' ? 'adm-badge--role' : 'adm-badge--muted'}`}>
                    {t(`adminPages.role.${u.role}`)}
                  </span>
                </td>
                <td>
                  <span className={`adm-badge adm-badge--${u.status}`}>{t(`adminPages.status.${u.status}`)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
