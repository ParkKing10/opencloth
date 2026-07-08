import { useMemo, useState } from 'react'
import { useStore } from '../../data/store'
import { IcoSearch } from '../../components/ui/Icons'

const STATUS_BADGE: Record<string, string> = {
  approved: 'adm-badge--active',
  in_review: 'adm-badge--role',
  draft: 'adm-badge--muted',
}

export function AdminDesigns() {
  const { data } = useStore()
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    const nameById = new Map(data.users.map((u) => [u.id, u.name]))
    const q = query.trim().toLowerCase()
    return data.designs
      .map((d) => ({ ...d, owner: nameById.get(d.ownerId) ?? 'Unknown' }))
      .filter((d) => !q || d.name.toLowerCase().includes(q) || d.owner.toLowerCase().includes(q))
  }, [data.designs, data.users, query])

  return (
    <div>
      <header style={{ marginBottom: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>Designs</h1>
          <p style={{ marginTop: 8, fontSize: 14, color: 'var(--s-text-2)' }}>{data.designs.length} designs across all creators.</p>
        </div>
        <label className="adm-search">
          <IcoSearch width="16" height="16" />
          <input placeholder="Search designs…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </header>

      <div className="adm-panel">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Design</th>
              <th>Creator</th>
              <th>Type</th>
              <th>Status</th>
              <th>Progress</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '32px 18px', color: 'var(--s-text-3)' }}>
                  No designs match your search.
                </td>
              </tr>
            )}
            {rows.map((d) => (
              <tr key={d.id}>
                <td style={{ color: 'var(--s-text)', fontWeight: 600 }}>{d.name}</td>
                <td>{d.owner}</td>
                <td style={{ textTransform: 'capitalize' }}>{d.kind}</td>
                <td>
                  <span className={`adm-badge ${STATUS_BADGE[d.status]}`}>{d.status.replace('_', ' ')}</span>
                </td>
                <td>{d.progress}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
