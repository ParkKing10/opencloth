import { useMemo, useState } from 'react'
import { useStore } from '../../data/store'
import { useToast } from '../../components/ui/Toast'
import { useAuth } from '../../auth/auth'
import type { Role, User } from '../../data/types'
import { IcoSearch } from '../../components/ui/Icons'

export function AdminUsers() {
  const { data, mutate } = useStore()
  const toast = useToast()
  const { user: me } = useAuth()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'admin' | 'suspended'>('all')

  const users = useMemo(() => {
    const q = query.trim().toLowerCase()
    return data.users.filter((u) => {
      if (filter === 'admin' && u.role !== 'admin') return false
      if (filter === 'suspended' && u.status !== 'suspended') return false
      if (!q) return true
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    })
  }, [data.users, query, filter])

  function setRole(u: User, role: Role) {
    mutate((d) => ({ ...d, users: d.users.map((x) => (x.id === u.id ? { ...x, role } : x)) }))
    toast(`${u.name} is now ${role === 'admin' ? 'an admin' : 'a creator'}.`, 'success')
  }

  function toggleStatus(u: User) {
    const next = u.status === 'active' ? 'suspended' : 'active'
    mutate((d) => ({ ...d, users: d.users.map((x) => (x.id === u.id ? { ...x, status: next } : x)) }))
    toast(`${u.name} ${next === 'suspended' ? 'suspended' : 'reactivated'}.`, next === 'suspended' ? 'default' : 'success')
  }

  return (
    <div>
      <header style={{ marginBottom: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>Users</h1>
          <p style={{ marginTop: 8, fontSize: 14, color: 'var(--s-text-2)' }}>
            {data.users.length} accounts · manage roles and access.
          </p>
        </div>
        <label className="adm-search">
          <IcoSearch width="16" height="16" />
          <input placeholder="Search users…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </header>

      <div className="s-tabs" style={{ marginBottom: 16 }}>
        {(['all', 'admin', 'suspended'] as const).map((f) => (
          <button key={f} type="button" className={`s-tab${filter === f ? ' is-active' : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f === 'admin' ? 'Admins' : 'Suspended'}
          </button>
        ))}
      </div>

      <div className="adm-panel">
        <table className="adm-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Plan</th>
              <th>Role</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf = u.id === me?.id
              return (
                <tr key={u.id}>
                  <td>
                    <span className="adm-cell-user">
                      <span className="adm-cell-user__av">{u.name.slice(0, 2).toUpperCase()}</span>
                      <span>
                        <span className="adm-cell-user__name">
                          {u.name} {isSelf && <span style={{ color: 'var(--s-text-3)', fontWeight: 400 }}>(you)</span>}
                        </span>
                        <br />
                        <span className="adm-cell-user__email">{u.email}</span>
                      </span>
                    </span>
                  </td>
                  <td>{u.plan}</td>
                  <td>
                    <span className={`adm-badge ${u.role === 'admin' ? 'adm-badge--role' : 'adm-badge--muted'}`}>{u.role}</span>
                  </td>
                  <td>
                    <span className={`adm-badge adm-badge--${u.status}`}>{u.status}</span>
                  </td>
                  <td>
                    <div className="adm-row-actions">
                      <button
                        className="adm-mini-btn"
                        type="button"
                        disabled={isSelf}
                        style={isSelf ? { opacity: 0.4, cursor: 'default' } : undefined}
                        onClick={() => setRole(u, u.role === 'admin' ? 'user' : 'admin')}
                      >
                        {u.role === 'admin' ? 'Make creator' : 'Make admin'}
                      </button>
                      <button
                        className="adm-mini-btn adm-mini-btn--danger"
                        type="button"
                        disabled={isSelf}
                        style={isSelf ? { opacity: 0.4, cursor: 'default' } : undefined}
                        onClick={() => toggleStatus(u)}
                      >
                        {u.status === 'active' ? 'Suspend' : 'Reactivate'}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
