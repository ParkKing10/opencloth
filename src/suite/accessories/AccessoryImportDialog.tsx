import { useCallback, useRef, useState } from 'react'
import { useT } from '@/i18n'
import { useToast } from '../components/ui/Toast'
import { ACCESSORY_CATEGORIES, publishAccessories } from './accessoryClient'
import '../garments/garments.css'

// Upload a whole accessory pack at once: drop (or pick) several images, tweak names + category,
// publish them into the shared library. Images are downscaled to compact data URLs on the client.

type Draft = { id: string; name: string; category: string; image: string }

const ACCEPT = 'image/png,image/webp,image/jpeg,image/svg+xml,image/gif'
const MAX_DIM = 640

/** Read an image file into a compact data URL (downscaled raster; SVG kept vector). */
async function fileToAccessoryImage(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((res, rej) => {
    const fr = new FileReader()
    fr.onload = () => res(String(fr.result))
    fr.onerror = () => rej(new Error('Could not read file'))
    fr.readAsDataURL(file)
  })
  if (file.type === 'image/svg+xml') return dataUrl
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image()
    i.onload = () => res(i)
    i.onerror = () => rej(new Error('Could not decode image'))
    i.src = dataUrl
  })
  const longest = Math.max(img.width, img.height) || 1
  const scale = Math.min(1, MAX_DIM / longest)
  if (scale >= 1 && dataUrl.length < 320_000) return dataUrl
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  ctx.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL('image/png') // PNG preserves transparency
}

function prettyName(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function AccessoryImportDialog({
  open,
  onClose,
  onPublished,
}: {
  open: boolean
  onClose: () => void
  onPublished: () => void
}) {
  const toast = useToast()
  const t = useT()
  const [category, setCategory] = useState(ACCESSORY_CATEGORIES[0].id)
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [drag, setDrag] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const imgs = Array.from(files).filter((f) => f.type.startsWith('image/'))
      if (imgs.length === 0) {
        setError(t('accessories.import.errNotImages'))
        return
      }
      setError('')
      setBusy(true)
      const next: Draft[] = []
      for (const f of imgs) {
        try {
          const image = await fileToAccessoryImage(f)
          next.push({ id: `${f.name}-${next.length}-${f.size}`, name: prettyName(f.name), category, image })
        } catch {
          /* skip the file we could not read */
        }
      }
      setBusy(false)
      if (next.length === 0) {
        setError(t('accessories.import.errNoneRead'))
        return
      }
      setDrafts((d) => [...d, ...next])
    },
    [category, t],
  )

  if (!open) return null

  function reset() {
    setDrafts([])
    setError('')
    setBusy(false)
  }
  function close() {
    reset()
    onClose()
  }

  async function publish() {
    if (drafts.length === 0 || busy) return
    setBusy(true)
    const r = await publishAccessories(drafts.map((d) => ({ name: d.name, category: d.category, image: d.image })))
    setBusy(false)
    if (r.ok) {
      const n = r.value.published
      toast(n === 1 ? t('accessories.import.publishedOne', { n }) : t('accessories.import.publishedMany', { n }), 'success')
      reset()
      onPublished()
      onClose()
    } else {
      setError(r.error)
    }
  }

  return (
    <div className="gl-modal" onClick={close}>
      <div className="gl-imp" onClick={(e) => e.stopPropagation()}>
        <div className="gl-imp__head">
          <div>
            <h2>{t('accessories.import.title')}</h2>
            <p>{t('accessories.import.subtitle')}</p>
          </div>
          <button className="gl-modal__close" type="button" onClick={close} aria-label={t('accessories.import.close')}>
            ×
          </button>
        </div>

        {/* Batch category — the default for everything added; each item can be changed below. */}
        <div className="gl-imp__reviewbar">
          <span>
            {t('accessories.import.goInto')}{' '}
            <select className="gl-imp__cat" value={category} onChange={(e) => setCategory(e.target.value)}>
              {ACCESSORY_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {t(`accessories.cat.${c.id}`)}
                </option>
              ))}
            </select>
          </span>
          {drafts.length > 0 && (
            <strong>
              {drafts.length === 1
                ? t('accessories.import.readyOne', { n: drafts.length })
                : t('accessories.import.readyMany', { n: drafts.length })}
            </strong>
          )}
        </div>

        {drafts.length === 0 ? (
          <div
            className={`gl-imp__drop${drag ? ' is-drag' : ''}`}
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
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
          >
            <span className="gl-imp__drop-icon">⬆</span>
            <strong>{busy ? t('accessories.import.dropReading') : t('accessories.import.dropTitle')}</strong>
            <span>{t('accessories.import.dropHint')}</span>
            {error && <div className="gl-imp__error">{error}</div>}
          </div>
        ) : (
          <div className="gl-imp__review">
            {drafts.map((d, i) => (
              <div key={d.id} className="gl-imp__item">
                <div className="gl-imp__thumb" style={{ background: 'var(--s-panel-3, #1b1b22)' }}>
                  <img src={d.image} alt="" style={{ objectFit: 'contain' }} />
                </div>
                <div className="gl-imp__fields">
                  <input
                    className="gl-imp__name"
                    value={d.name}
                    onChange={(e) => setDrafts((list) => list.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                    placeholder={t('accessories.import.namePlaceholder')}
                  />
                  <div className="gl-imp__row">
                    <select
                      className="gl-imp__cat"
                      value={d.category}
                      onChange={(e) => setDrafts((list) => list.map((x, j) => (j === i ? { ...x, category: e.target.value } : x)))}
                    >
                      {ACCESSORY_CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {t(`accessories.cat.${c.id}`)}
                        </option>
                      ))}
                    </select>
                    <button
                      className="gl-card__del"
                      type="button"
                      onClick={() => setDrafts((list) => list.filter((_, j) => j !== i))}
                      title={t('accessories.import.removeTitle')}
                    >
                      {t('accessories.import.remove')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {error && <div className="gl-imp__error">{error}</div>}
          </div>
        )}

        <div className="gl-imp__foot">
          {drafts.length > 0 && (
            <button className="s-btn" type="button" onClick={() => inputRef.current?.click()} disabled={busy}>
              {t('accessories.import.addMore')}
            </button>
          )}
          <button className="s-btn" type="button" onClick={close} disabled={busy}>
            {t('accessories.import.cancel')}
          </button>
          <button className="s-btn s-btn--accent" type="button" onClick={publish} disabled={busy || drafts.length === 0}>
            {busy
              ? t('accessories.import.publishing')
              : drafts.length > 0
                ? t('accessories.import.publishN', { n: drafts.length })
                : t('accessories.import.publish')}
          </button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) void addFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}
