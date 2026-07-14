import { useCallback, useEffect, useMemo, useState } from 'react'
import { useT } from '@/i18n'
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
  const t = useT()
  const catLabel = (id: string) => {
    const key = `accessories.cat.${id}`
    const s = t(key)
    return s === key ? accessoryCategoryLabel(id) : s
  }
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
    if (!window.confirm(t('accessories.admin.confirmDelete', { name: a.name }))) return
    const r = await deleteAccessory(a.id)
    if (r.ok) {
      toast(t('accessories.admin.deleted', { name: a.name }), 'default')
      void refresh()
    } else {
      toast(r.error, 'default')
    }
  }

  async function deleteAll() {
    const n = items.length
    if (n === 0 || wiping) return
    const confirmMsg = n === 1
      ? t('accessories.admin.confirmDeleteAllOne', { n })
      : t('accessories.admin.confirmDeleteAllMany', { n })
    if (!window.confirm(confirmMsg)) return
    setWiping(true)
    const r = await deleteAllAccessories()
    setWiping(false)
    if (r.ok) {
      const d = r.value.deleted
      toast(d === 1 ? t('accessories.admin.deletedCountOne', { n: d }) : t('accessories.admin.deletedCountMany', { n: d }), 'success')
      void refresh()
    } else {
      toast(r.error, 'default')
    }
  }

  return (
    <div>
      <header className="gl-page-head">
        <div>
          <h1>{t('accessories.admin.title')}</h1>
          <p>
            {loading
              ? t('accessories.admin.loading')
              : items.length === 1
                ? t('accessories.admin.subtitleOne', { n: items.length })
                : t('accessories.admin.subtitleMany', { n: items.length })}
          </p>
        </div>
        <div className="gl-page-head__actions">
          <button
            className="s-btn s-btn--danger"
            type="button"
            onClick={deleteAll}
            disabled={wiping || loading || items.length === 0}
          >
            {wiping ? t('accessories.admin.deleting') : t('accessories.admin.deleteAll')}
          </button>
          <button className="s-btn s-btn--accent" type="button" onClick={() => setImporting(true)}>
            {t('accessories.admin.upload')}
          </button>
        </div>
      </header>

      {shared === false && (
        <div className="gl-imp__error" style={{ marginBottom: 16 }}>
          {t('accessories.admin.localWarnPre')} <code>accessories</code>{' '}
          {t('accessories.admin.localWarnPost')}
        </div>
      )}

      <div className="gl">
        <div className="gl__toolbar">
          <div className="gl__chips">
            <button className={`gl__chip${cat === 'all' ? ' is-active' : ''}`} type="button" onClick={() => setCat('all')}>
              {t('accessories.admin.all')} <span className="gl__chip-n">{items.length}</span>
            </button>
            {ACCESSORY_CATEGORIES.map((c) => (
              <button
                key={c.id}
                className={`gl__chip${cat === c.id ? ' is-active' : ''}`}
                type="button"
                onClick={() => setCat(c.id)}
              >
                {t(`accessories.cat.${c.id}`)} <span className="gl__chip-n">{counts.get(c.id) ?? 0}</span>
              </button>
            ))}
          </div>

          {shown.length === 0 ? (
            <div className="gl__empty">
              <strong>{loading ? t('accessories.admin.loading') : t('accessories.admin.emptyTitle')}</strong>
              <span>{t('accessories.admin.emptyHint')}</span>
            </div>
          ) : (
            <div className="gl__grid">
              {shown.map((a) => (
                <div key={a.id} className="gl-card">
                  <div className="gl-card__thumb" style={{ cursor: 'default' }}>
                    <span className="gl-card__cat">{catLabel(a.category)}</span>
                    <img className="gl-card__img" src={a.image} alt={a.name} style={{ objectFit: 'contain', background: 'var(--s-panel-2)' }} />
                  </div>
                  <div className="gl-card__body">
                    <div className="gl-card__text">
                      <div className="gl-card__name">{a.name}</div>
                      <div className="gl-card__views">{catLabel(a.category)}</div>
                    </div>
                    <button className="gl-card__del" type="button" onClick={() => onDelete(a)} title={t('accessories.admin.deleteTitle')}>
                      {t('accessories.admin.delete')}
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
