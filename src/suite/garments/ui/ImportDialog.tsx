import { useCallback, useEffect, useRef, useState } from 'react'
import { useToast } from '../../components/ui/Toast'
import { CATEGORIES } from '../types'
import type { DetectedGarment, GarmentCategoryId, ImportProgress } from '../types'
import { archiveKind } from '../import/extract'
import { prettyName, viewsSummary } from '../import/detect'
import { runImport } from '../import/pipeline'
import { publishGarments } from '../garmentClient'
import { IcoCoins } from '../../components/ui/Icons'

type Phase = 'idle' | 'processing' | 'review' | 'publishing'

type Props = {
  open: boolean
  onClose: () => void
  onPublished: () => void
}

export function ImportDialog({ open, onClose, onPublished }: Props) {
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [detected, setDetected] = useState<DetectedGarment[]>([])
  const [error, setError] = useState<string | null>(null)
  const [sourceName, setSourceName] = useState('')
  const [dragging, setDragging] = useState(false)

  const revokeAll = useCallback((list: DetectedGarment[]) => {
    for (const d of list) URL.revokeObjectURL(d.previewUrl)
  }, [])

  // clean up object URLs on unmount
  useEffect(() => () => revokeAll(detected), [detected, revokeAll])

  if (!open) return null

  const reset = () => {
    revokeAll(detected)
    setPhase('idle')
    setProgress(null)
    setDetected([])
    setError(null)
    setSourceName('')
  }

  const close = () => {
    reset()
    onClose()
  }

  async function handleFile(file: File) {
    if (!archiveKind(file.name)) {
      setError('Unsupported file — upload a .zip or .rar garment pack.')
      return
    }
    revokeAll(detected)
    setDetected([])
    setError(null)
    setSourceName(file.name)
    setPhase('processing')
    try {
      const result = await runImport(file, setProgress)
      setDetected(result)
      setPhase('review')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Import failed.')
      setPhase('idle')
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) void handleFile(file)
  }

  const updateItem = (tempId: string, patch: Partial<DetectedGarment>) =>
    setDetected((list) => list.map((d) => (d.tempId === tempId ? { ...d, ...patch } : d)))

  const includedCount = detected.filter((d) => d.include).length

  async function publish() {
    setPhase('publishing')
    const outcome = await publishGarments(detected, {
      packName: prettyName(sourceName),
      sourceName,
    })
    if (outcome.published.length) {
      toast(
        `Published ${outcome.published.length} garment${outcome.published.length === 1 ? '' : 's'}.`,
        'success',
      )
    }
    if (outcome.failed.length) {
      toast(`${outcome.failed.length} garment${outcome.failed.length === 1 ? '' : 's'} failed to publish.`, 'default')
    }
    onPublished()
    close()
  }

  return (
    <div className="gl-modal" role="dialog" aria-modal="true" onClick={phase === 'processing' || phase === 'publishing' ? undefined : close}>
      <div className="gl-imp" onClick={(e) => e.stopPropagation()}>
        <header className="gl-imp__head">
          <div>
            <h2>Import garment pack</h2>
            <p>Upload one .zip or .rar — THREADOS extracts, groups and previews every garment automatically.</p>
          </div>
          <button className="gl-modal__close" type="button" onClick={close} aria-label="Close">
            ×
          </button>
        </header>

        {(phase === 'idle' || phase === 'processing') && (
          <div
            className={`gl-imp__drop${dragging ? ' is-drag' : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".zip,.rar"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void handleFile(f)
                e.target.value = ''
              }}
            />
            {phase === 'processing' ? (
              <div className="gl-imp__progress">
                <div className="gl-imp__bar">
                  <span style={{ width: `${Math.round((progress?.pct ?? 0) * 100)}%` }} />
                </div>
                <p>{progress?.message ?? 'Processing…'}</p>
              </div>
            ) : (
              <>
                <div className="gl-imp__drop-icon">⤓</div>
                <strong>Drop a garment pack here</strong>
                <span>or</span>
                <button className="s-btn s-btn--accent" type="button" onClick={() => inputRef.current?.click()}>
                  Choose archive
                </button>
                <small>.zip or .rar · AI, SVG, PNG, PDF, DXF, JPG, TTF supported</small>
                {error && <p className="gl-imp__error">{error}</p>}
              </>
            )}
          </div>
        )}

        {(phase === 'review' || phase === 'publishing') && (
          <>
            <div className="gl-imp__reviewbar">
              <span>
                Detected <strong>{detected.length}</strong> garment{detected.length === 1 ? '' : 's'} · {includedCount}{' '}
                selected
              </span>
              <span className="gl-imp__src">{sourceName}</span>
            </div>
            <div className="gl-imp__review">
              {detected.map((d) => (
                <div key={d.tempId} className={`gl-imp__item${d.include ? '' : ' is-off'}`}>
                  <label className="gl-imp__check">
                    <input
                      type="checkbox"
                      checked={d.include}
                      onChange={(e) => updateItem(d.tempId, { include: e.target.checked })}
                    />
                  </label>
                  <div className="gl-imp__thumb">
                    <img src={d.previewUrl} alt={d.name} />
                  </div>
                  <div className="gl-imp__fields">
                    <input
                      className="gl-imp__name"
                      value={d.name}
                      onChange={(e) => updateItem(d.tempId, { name: e.target.value })}
                      aria-label="Garment name"
                    />
                    <div className="gl-imp__row">
                      <select
                        className="gl-imp__cat"
                        value={d.category}
                        onChange={(e) => updateItem(d.tempId, { category: e.target.value as GarmentCategoryId })}
                        aria-label="Category"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                      <label className="gl-imp__price" title="Coin price in the Garment Shop (0 = free)">
                        <IcoCoins width="13" height="13" />
                        <input
                          type="number"
                          min={0}
                          step={5}
                          value={d.price}
                          onChange={(e) => updateItem(d.tempId, { price: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
                          aria-label="Coin price"
                        />
                      </label>
                      <span
                        className={`gl-imp__health gl-imp__health--${d.health.status}`}
                        title={d.health.issues.join(' · ') || 'Ready to publish'}
                      >
                        {d.health.status}
                      </span>
                    </div>
                    <div className="gl-imp__row gl-imp__meta">
                      <span>{d.files.length} files</span>
                      <span className="gl-imp__views">{viewsSummary(d.views)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <footer className="gl-imp__foot">
              <button className="s-btn" type="button" onClick={reset} disabled={phase === 'publishing'}>
                Start over
              </button>
              <button
                className="s-btn s-btn--accent"
                type="button"
                onClick={publish}
                disabled={includedCount === 0 || phase === 'publishing'}
              >
                {phase === 'publishing' ? 'Publishing…' : `Publish ${includedCount} garment${includedCount === 1 ? '' : 's'}`}
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  )
}
