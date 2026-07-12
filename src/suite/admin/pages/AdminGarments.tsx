import { useState } from 'react'
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
    if (!window.confirm(`Delete ALL ${n} uploaded garment${n === 1 ? '' : 's'}? This permanently removes them and their files. This cannot be undone.`)) return
    if (!window.confirm(`Really delete all ${n}? Type-check: this wipes the whole uploaded catalog.`)) return
    setWiping(true)
    const r = await deleteAllUploadedGarments()
    setWiping(false)
    if (r.ok) {
      toast(`Deleted ${r.value.deleted} garment${r.value.deleted === 1 ? '' : 's'}. Upload your own to rebuild the catalog.`, 'success')
      void refresh()
    } else {
      toast(r.error, 'default')
    }
  }

  async function onDelete(g: Garment) {
    if (!window.confirm(`Delete "${g.name}"? This permanently removes its files.`)) return
    const r = await deleteGarment(g.id)
    if (r.ok) {
      toast(`Deleted ${g.name}.`, 'default')
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
    if (ok === total) toast(`Regenerated ${ok} preview${ok === 1 ? '' : 's'}.`, 'success')
    else if (ok === 0) toast(firstError || 'Could not regenerate previews.', 'default')
    else toast(`Regenerated ${ok} of ${total} — ${firstError}`, 'default')
  }

  return (
    <div>
      <header className="gl-page-head">
        <div>
          <h1>Garment Library</h1>
          <p>
            {loading ? 'Loading…' : `${garments.length} garment${garments.length === 1 ? '' : 's'} in the catalog.`}
          </p>
        </div>
        <div className="gl-page-head__actions">
          <button
            className="s-btn s-btn--danger"
            type="button"
            onClick={deleteAll}
            disabled={wiping || loading || garments.length === 0}
            title="Permanently delete every uploaded garment and its files"
          >
            {wiping ? 'Deleting…' : 'Delete all'}
          </button>
          <button
            className="s-btn"
            type="button"
            onClick={regenerateAll}
            disabled={!!regen || loading || garments.length === 0}
            title="Rebuild every thumbnail using the current preview rules"
          >
            {regen ? `Regenerating ${regen.done}/${regen.total}…` : 'Regenerate previews'}
          </button>
          <button className="s-btn s-btn--accent" type="button" onClick={() => setImporting(true)}>
            Upload garment pack
          </button>
        </div>
      </header>

      <GarmentCatalog garments={garments} loading={loading} admin onOpen={setOpened} onDelete={onDelete} />

      <ImportDialog open={importing} onClose={() => setImporting(false)} onPublished={refresh} />
      {opened && <GarmentDetail garment={opened} onClose={() => setOpened(null)} />}
    </div>
  )
}
