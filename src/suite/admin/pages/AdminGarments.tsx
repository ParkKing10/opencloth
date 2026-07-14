import { useState } from 'react'
import { useT } from '../../../i18n'
import { useToast } from '../../components/ui/Toast'
import { useGarments } from '../../garments/useGarments'
import { GarmentCatalog } from '../../garments/ui/GarmentCatalog'
import { GarmentDetail } from '../../garments/ui/GarmentDetail'
import { ImportDialog } from '../../garments/ui/ImportDialog'
import { deleteGarment, deleteAllUploadedGarments, regenerateThumbnail } from '../../garments/garmentClient'
import type { Garment } from '../../garments/types'
import '../../garments/garments.css'

export function AdminGarments() {
  const { garments, loading, refresh } = useGarments()
  const t = useT()
  const toast = useToast()
  const [importing, setImporting] = useState(false)
  const [opened, setOpened] = useState<Garment | null>(null)
  // Regenerate all thumbnails (e.g. after the preview-priority rules changed).
  const [regen, setRegen] = useState<{ done: number; total: number } | null>(null)
  const [wiping, setWiping] = useState(false)

  // Delete EVERY uploaded garment — the "start fresh before re-uploading" action. Two-step confirm
  // (destructive + irreversible: it also removes the storage files), then a hard refresh.
  async function deleteAll() {
    const n = garments.length
    if (n === 0 || wiping) return
    if (!window.confirm(n === 1 ? t('adminPages.garments.confirmAllOne', { n }) : t('adminPages.garments.confirmAllMany', { n }))) return
    if (!window.confirm(t('adminPages.garments.confirmAllReally', { n }))) return
    setWiping(true)
    const r = await deleteAllUploadedGarments()
    setWiping(false)
    if (r.ok) {
      toast(r.value.deleted === 1 ? t('adminPages.garments.deletedAllOne', { n: r.value.deleted }) : t('adminPages.garments.deletedAllMany', { n: r.value.deleted }), 'success')
      void refresh()
    } else {
      toast(r.error, 'default')
    }
  }

  async function onDelete(g: Garment) {
    if (!window.confirm(t('adminPages.garments.confirmDelete', { name: g.name }))) return
    const r = await deleteGarment(g.id)
    if (r.ok) {
      toast(t('adminPages.garments.deletedOne', { name: g.name }), 'default')
      void refresh()
    } else {
      toast(r.error, 'default')
    }
  }

  async function regenerateAll() {
    if (garments.length === 0 || regen) return
    const total = garments.length
    setRegen({ done: 0, total })
    let ok = 0
    let firstError = ''
    for (let i = 0; i < garments.length; i++) {
      const r = await regenerateThumbnail(garments[i].id)
      if (r.ok) ok++
      else if (!firstError) firstError = r.error
      setRegen({ done: i + 1, total })
    }
    setRegen(null)
    await refresh()
    if (ok === total) toast(ok === 1 ? t('adminPages.garments.regeneratedOne', { n: ok }) : t('adminPages.garments.regeneratedMany', { n: ok }), 'success')
    else if (ok === 0) toast(firstError || t('adminPages.garments.regenerateFailed'), 'default')
    else toast(t('adminPages.garments.regeneratedPartial', { ok, total, error: firstError }), 'default')
  }

  return (
    <div>
      <header className="gl-page-head">
        <div>
          <h1>{t('adminPages.garments.title')}</h1>
          <p>
            {loading
              ? t('common.loading')
              : garments.length === 1
                ? t('adminPages.garments.countOne', { n: garments.length })
                : t('adminPages.garments.countMany', { n: garments.length })}
          </p>
        </div>
        <div className="gl-page-head__actions">
          <button
            className="s-btn s-btn--danger"
            type="button"
            onClick={deleteAll}
            disabled={wiping || loading || garments.length === 0}
            title={t('adminPages.garments.deleteAllTitle')}
          >
            {wiping ? t('adminPages.garments.deleting') : t('common.deleteAll')}
          </button>
          <button
            className="s-btn"
            type="button"
            onClick={regenerateAll}
            disabled={!!regen || loading || garments.length === 0}
            title={t('adminPages.garments.regenerateTitle')}
          >
            {regen ? t('adminPages.garments.regenerating', { done: regen.done, total: regen.total }) : t('adminPages.garments.regeneratePreviews')}
          </button>
          <button className="s-btn s-btn--accent" type="button" onClick={() => setImporting(true)}>
            {t('adminPages.garments.uploadPack')}
          </button>
        </div>
      </header>

      <GarmentCatalog garments={garments} loading={loading} admin onOpen={setOpened} onDelete={onDelete} />

      <ImportDialog open={importing} onClose={() => setImporting(false)} onPublished={refresh} />
      {opened && <GarmentDetail garment={opened} onClose={() => setOpened(null)} />}
    </div>
  )
}
