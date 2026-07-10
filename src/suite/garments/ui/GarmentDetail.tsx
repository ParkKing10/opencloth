import { useEffect, useState } from 'react'
import type { Garment } from '../types'
import { categoryLabel } from '../types'
import { getGarment } from '../garmentClient'

const fmtBytes = (n: number): string =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : n >= 1e3 ? `${(n / 1e3).toFixed(0)} KB` : `${n} B`

type Props = { garment: Garment; onClose: () => void }

export function GarmentDetail({ garment, onClose }: Props) {
  const [full, setFull] = useState<Garment | null>(null)

  useEffect(() => {
    let alive = true
    void getGarment(garment.id).then((g) => alive && setFull(g))
    return () => {
      alive = false
    }
  }, [garment.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const files = (full?.representations ?? []).filter((r) => r.kind !== 'thumbnail')

  return (
    <div className="gl-modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="gl-modal__panel gl-modal__panel--wide" onClick={(e) => e.stopPropagation()}>
        <button className="gl-modal__close" type="button" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="gl-detail">
          <div className="gl-detail__preview">
            {garment.thumbUrl ? (
              <img src={garment.thumbUrl} alt={garment.name} />
            ) : (
              <span className="gl-detail__ph">{garment.name.slice(0, 2).toUpperCase()}</span>
            )}
          </div>
          <div className="gl-detail__info">
            <span className="gl-detail__cat">{categoryLabel(garment.category)}</span>
            <h2 className="gl-detail__name">{garment.name}</h2>
            <p className="gl-detail__meta">Added {new Date(garment.createdAt).toLocaleDateString()}</p>

            <div className="gl-detail__files">
              <h3>
                Files {full ? `(${files.length})` : '…'}
              </h3>
              {!full ? (
                <p className="gl-detail__loading">Loading files…</p>
              ) : files.length === 0 ? (
                <p className="gl-detail__loading">No source files stored (offline mode).</p>
              ) : (
                <ul className="gl-detail__list">
                  {files.map((r) => (
                    <li key={r.id}>
                      <a
                        className="gl-detail__file"
                        href={r.url || undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <span className="gl-detail__fmt">{(r.format || 'file').toUpperCase()}</span>
                        <span className="gl-detail__fkind">{r.kind}</span>
                        <span className="gl-detail__fsize">{fmtBytes(r.bytes)}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
