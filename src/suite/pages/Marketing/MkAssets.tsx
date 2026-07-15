import { useRef, useState } from 'react'
import { useT } from '@/i18n'
import { useToast } from '../../components/ui/Toast'
import { useMarketing } from '../../marketing/useMarketing'
import { delBlobs, mkId, putBlob, squareThumb, type MkAsset, type MkAssetKind } from '../../marketing/marketingStore'

/* Assets — optional uploads (logos, music, screen recordings, references). Payloads live in
   IndexedDB; the grid keeps only tiny thumbs inline. Image assets can be picked as brand
   references in the generator. */

const ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml,image/gif,video/mp4,video/quicktime,video/webm,audio/*'
const MAX_MB = 40

function kindOf(mime: string): MkAssetKind {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  return 'other'
}

function fmtSize(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export function MkAssets() {
  const t = useT()
  const toast = useToast()
  const { meta, update } = useMarketing()
  const [drag, setDrag] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function addFiles(files: FileList | File[]) {
    const list = Array.from(files)
    if (list.length === 0 || busy) return
    setBusy(true)
    let added = 0
    for (const file of list) {
      if (file.size > MAX_MB * 1_048_576) {
        toast(t('mk.assets.tooBig', { name: file.name, mb: MAX_MB }), 'info')
        continue
      }
      try {
        const dataUrl = await new Promise<string>((res, rej) => {
          const fr = new FileReader()
          fr.onload = () => res(String(fr.result))
          fr.onerror = () => rej(new Error('read failed'))
          fr.readAsDataURL(file)
        })
        const id = mkId('asset')
        const dataKey = `${id}_data`
        if (!(await putBlob(dataKey, dataUrl))) throw new Error('store failed')
        const kind = kindOf(file.type)
        let thumb: string | undefined
        if (kind === 'image') {
          try {
            thumb = await squareThumb(dataUrl, 220)
          } catch {
            /* svg or huge — no thumb */
          }
        }
        const asset: MkAsset = { id, name: file.name, kind, mime: file.type, size: file.size, dataKey, thumb, createdAt: Date.now() }
        update((m) => ({ ...m, assets: [asset, ...m.assets] }))
        added++
      } catch {
        toast(t('mk.assets.failed', { name: file.name }), 'info')
      }
    }
    setBusy(false)
    if (added > 0) toast(t('mk.assets.added', { n: added }), 'success')
  }

  function remove(asset: MkAsset) {
    void delBlobs([asset.dataKey])
    update((m) => ({ ...m, assets: m.assets.filter((a) => a.id !== asset.id) }))
  }

  return (
    <section className="mst-sec">
      <div className="mst-sec__head">
        <div>
          <h2>{t('mk.assets.head')}</h2>
          <p>{t('mk.assets.sub')}</p>
        </div>
      </div>

      <div
        className={`mst-drop${drag ? ' is-drag' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDrag(false)
          void addFiles(e.dataTransfer.files)
        }}
      >
        <b>{busy ? t('mk.assets.reading') : t('mk.assets.dropTitle')}</b>
        <small>{t('mk.assets.dropHint')}</small>
      </div>
      <input ref={fileRef} type="file" accept={ACCEPT} multiple hidden onChange={(e) => {
        void addFiles(e.target.files ?? [])
        e.target.value = ''
      }} />

      {meta.assets.length > 0 && (
        <div className="mst-assets">
          {meta.assets.map((a) => (
            <article className="mst-asset" key={a.id}>
              <div className="mst-asset__thumb">
                {a.thumb ? <img src={a.thumb} alt={a.name} /> : a.kind.toUpperCase()}
              </div>
              <div className="mst-asset__body">
                <span className="mst-asset__name" title={a.name}>{a.name}</span>
                <span className="mst-asset__size">{fmtSize(a.size)}</span>
                <button type="button" className="mst-char__del" aria-label={t('mk.delete')} onClick={() => remove(a)}>×</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
