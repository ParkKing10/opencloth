import { useCallback, useEffect, useMemo, useState } from 'react'
import { useToast } from '../../components/ui/Toast'
import {
  ACCESSORY_CATEGORIES,
  accessoriesShared,
  accessoryCategoryLabel,
  deleteAccessory,
  deleteAllAccessories,
  listAccessories,
  type Accessory,
} from '../../accessories/accessoryClient'
import { AccessoryImportDialog } from '../../accessories/AccessoryImportDialog'
import '../../garments/garments.css'

export function AdminAccessories() {
  const toast = useToast()
  const [items, setItems] = useState<Accessory[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [wiping, setWiping] = useState(false)
  const [cat, setCat] = useState('all')
  const [shared, setShared] = useState<boolean | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const list = await listAccessories()
    setItems(list)
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
    void accessoriesShared().then(setShared)
  }, [refresh])

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of items) m.set(a.category, (m.get(a.category) ?? 0) + 1)
    return m
  }, [items])

  const shown = useMemo(() => (cat === 'all' ? items : items.filter((a) => a.category === cat)), [items, cat])

  async function onDelete(a: Accessory) {
    if (!window.confirm(`Delete "${a.name}"? This removes it from the library for everyone.`)) return
    const r = await deleteAccessory(a.id)
    if (r.ok) {
      toast(`Deleted ${a.name}.`, 'default')
      void refresh()
    } else {
      toast(r.error, 'default')
    }
  }

  async function deleteAll() {
    const n = items.length
    if (n === 0 || wiping) return
    if (!window.confirm(`Delete ALL ${n} accessor${n === 1 ? 'y' : 'ies'}? This cannot be undone.`)) return
    setWiping(true)
    const r = await deleteAllAccessories()
    setWiping(false)
    if (r.ok) {
      toast(`Deleted ${r.value.deleted} accessor${r.value.deleted === 1 ? 'y' : 'ies'}.`, 'success')
      void refresh()
    } else {
      toast(r.error, 'default')
    }
  }

  return (
    <div>
      <header className="gl-page-head">
        <div>
          <h1>Accessory Library</h1>
          <p>
            {loading
              ? 'Loading…'
              : `${items.length} accessor${items.length === 1 ? 'y' : 'ies'} — every user can place these on a garment for free.`}
          </p>
        </div>
        <div className="gl-page-head__actions">
          <button
            className="s-btn s-btn--danger"
            type="button"
            onClick={deleteAll}
            disabled={wiping || loading || items.length === 0}
          >
            {wiping ? 'Deleting…' : 'Delete all'}
          </button>
          <button className="s-btn s-btn--accent" type="button" onClick={() => setImporting(true)}>
            Upload accessory pack
          </button>
        </div>
      </header>

      {shared === false && (
        <div className="gl-imp__error" style={{ marginBottom: 16 }}>
          Stored locally on this browser only. Run the <code>accessories</code> table migration in
          {' '}supabase/schema.sql to share the library across all users.
        </div>
      )}

      <div className="gl">
        <div className="gl__toolbar">
          <div className="gl__chips">
            <button className={`gl__chip${cat === 'all' ? ' is-active' : ''}`} type="button" onClick={() => setCat('all')}>
              All <span className="gl__chip-n">{items.length}</span>
            </button>
            {ACCESSORY_CATEGORIES.map((c) => (
              <button
                key={c.id}
                className={`gl__chip${cat === c.id ? ' is-active' : ''}`}
                type="button"
                onClick={() => setCat(c.id)}
              >
                {c.label} <span className="gl__chip-n">{counts.get(c.id) ?? 0}</span>
              </button>
            ))}
          </div>

          {shown.length === 0 ? (
            <div className="gl__empty">
              <strong>{loading ? 'Loading…' : 'No accessories yet'}</strong>
              <span>Upload a pack of images — hats, jewelry, bags, patches — to build the library.</span>
            </div>
          ) : (
            <div className="gl__grid">
              {shown.map((a) => (
                <div key={a.id} className="gl-card">
                  <div className="gl-card__thumb" style={{ cursor: 'default' }}>
                    <span className="gl-card__cat">{accessoryCategoryLabel(a.category)}</span>
                    <img className="gl-card__img" src={a.image} alt={a.name} style={{ objectFit: 'contain', background: 'var(--s-panel-2)' }} />
                  </div>
                  <div className="gl-card__body">
                    <div className="gl-card__text">
                      <div className="gl-card__name">{a.name}</div>
                      <div className="gl-card__views">{accessoryCategoryLabel(a.category)}</div>
                    </div>
                    <button className="gl-card__del" type="button" onClick={() => onDelete(a)} title="Delete accessory">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AccessoryImportDialog
        open={importing}
        onClose={() => setImporting(false)}
        onPublished={() => {
          void refresh()
          void accessoriesShared().then(setShared)
        }}
      />
    </div>
  )
}
