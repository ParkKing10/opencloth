import { useStore } from '../../data/store'

export function AdminOverview() {
  const { data } = useStore()

  const activeUsers = data.users.filter((u) => u.status === 'active').length
  const openOrders = data.orders.filter((o) => o.stage !== 'delivered').length
  const readyPacks = data.techPacks.filter((t) => t.status === 'ready').length

  const kpis = [
    { label: 'Total users', value: String(data.users.length), delta: `${activeUsers} active` },
    { label: 'Designs', value: String(data.designs.length), delta: 'across all creators' },
    { label: 'Open orders', value: String(openOrders), delta: `${data.orders.length} total` },
    { label: 'Tech packs ready', value: String(readyPacks), delta: 'production-ready' },
  ]

  const recent = [...data.users].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6)

  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>Platform overview</h1>
        <p style={{ marginTop: 8, fontSize: 14, color: 'var(--s-text-2)' }}>
          Everything happening across the loom studios platform.
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
          <h2>Recent signups</h2>
        </div>
        <table className="adm-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Plan</th>
              <th>Role</th>
              <th>Status</th>
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
                    {u.role}
                  </span>
                </td>
                <td>
                  <span className={`adm-badge adm-badge--${u.status}`}>{u.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
