import { useMemo, useState } from 'react'
import { useStore } from '../../data/store'
import { useT } from '../../../i18n'
import { IcoSearch } from '../../components/ui/Icons'

const STATUS_BADGE: Record<string, string> = {
  approved: 'adm-badge--active',
  in_review: 'adm-badge--role',
  draft: 'adm-badge--muted',
}

export function AdminDesigns() {
  const { data } = useStore()
  const t = useT()
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    const nameById = new Map(data.users.map((u) => [u.id, u.name]))
    const q = query.trim().toLowerCase()
    return data.designs
      .map((d) => ({ ...d, owner: nameById.get(d.ownerId) ?? t('adminPages.designs.unknownOwner') }))
      .filter((d) => !q || d.name.toLowerCase().includes(q) || d.owner.toLowerCase().includes(q))
  }, [data.designs, data.users, query, t])

  return (
    <div>
      <header style={{ marginBottom: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>{t('adminPages.designs.title')}</h1>
          <p style={{ marginTop: 8, fontSize: 14, color: 'var(--s-text-2)' }}>{t('adminPages.designs.subtitle', { n: data.designs.length })}</p>
        </div>
        <label className="adm-search">
          <IcoSearch width="16" height="16" />
          <input placeholder={t('adminPages.designs.searchPlaceholder')} value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </header>

      <div className="adm-panel">
        <table className="adm-table">
          <thead>
            <tr>
              <th>{t('adminPages.col.design')}</th>
              <th>{t('adminPages.col.creator')}</th>
              <th>{t('adminPages.col.type')}</th>
              <th>{t('adminPages.col.status')}</th>
              <th>{t('adminPages.col.progress')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '32px 18px', color: 'var(--s-text-3)' }}>
                  {t('adminPages.designs.empty')}
                </td>
              </tr>
            )}
            {rows.map((d) => (
              <tr key={d.id}>
                <td style={{ color: 'var(--s-text)', fontWeight: 600 }}>{d.name}</td>
                <td>{d.owner}</td>
                <td style={{ textTransform: 'capitalize' }}>{t(`adminPages.kind.${d.kind}`)}</td>
                <td>
                  <span className={`adm-badge ${STATUS_BADGE[d.status]}`}>{t(`adminPages.designStatus.${d.status}`)}</span>
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
