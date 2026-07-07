import { useStore } from '../../data/store'

const STAGE_LABEL: Record<string, string> = {
  sample: 'Sample',
  production: 'Production',
  qc: 'Quality Check',
  shipping: 'Shipping',
  delivered: 'Delivered',
}
const STAGE_BADGE: Record<string, string> = {
  sample: 'adm-badge--muted',
  production: 'adm-badge--role',
  qc: 'adm-badge--role',
  shipping: 'adm-badge--role',
  delivered: 'adm-badge--active',
}

export function AdminOrders() {
  const { data } = useStore()
  const units = data.orders.reduce((sum, o) => sum + o.qty, 0)

  return (
    <div>
      <header style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>Production orders</h1>
        <p style={{ marginTop: 8, fontSize: 14, color: 'var(--s-text-2)' }}>
          {data.orders.length} orders · {units.toLocaleString()} units in the pipeline.
        </p>
      </header>

      <div className="adm-panel">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Qty</th>
              <th>Manufacturer</th>
              <th>Stage</th>
              <th>Progress</th>
              <th>ETA</th>
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
                  <span className={`adm-badge ${STAGE_BADGE[o.stage]}`}>{STAGE_LABEL[o.stage]}</span>
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
