import { useCallback, useEffect, useRef, useState } from 'react'
import { useT } from '@/i18n'
import { useToast } from '../../components/ui/Toast'
import { categoryLabel } from '../types'
import type { DetectedGarment, GarmentCategory, GarmentCategoryId, ImportProgress } from '../types'
import { archiveKind } from '../import/extract'
import { prettyName, viewsSummary } from '../import/detect'
import { runImport } from '../import/pipeline'
import { publishGarments, listCategories, createCategory } from '../garmentClient'
import { IcoCoins } from '../../components/ui/Icons'

// The upload flow starts by choosing the category the whole pack lands in ('category'), then the
// drop/detect/review/publish steps run with every detected garment pre-set to that category.
type Phase = 'category' | 'idle' | 'processing' | 'review' | 'publishing'

type Props = {
  open: boolean
  onClose: () => void
  onPublished: () => void
}

export function ImportDialog({ open, onClose, onPublished }: Props) {
  const t = useT()
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<Phase>('category')
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [detected, setDetected] = useState<DetectedGarment[]>([])
  const [error, setError] = useState<string | null>(null)
  const [sourceName, setSourceName] = useState('')
  const [dragging, setDragging] = useState(false)
  // Category-first: pick (or create) the category the whole pack lands in before dropping files.
  const [categories, setCategories] = useState<GarmentCategory[]>([])
  const [chosenCategory, setChosenCategory] = useState<GarmentCategoryId | null>(null)
  const [newCat, setNewCat] = useState('')
  const [creatingCat, setCreatingCat] = useState(false)

  const revokeAll = useCallback((list: DetectedGarment[]) => {
    for (const d of list) URL.revokeObjectURL(d.previewUrl)
  }, [])

  // clean up object URLs on unmount
  useEffect(() => () => revokeAll(detected), [detected, revokeAll])

  // On open: start at the category step and load the pickable categories (defaults + custom).
  useEffect(() => {
    if (!open) return
    setPhase('category')
    setChosenCategory(null)
    void listCategories().then(setCategories)
  }, [open])

  if (!open) return null

  const reset = () => {
    revokeAll(detected)
    setPhase('category')
    setProgress(null)
    setDetected([])
    setError(null)
    setSourceName('')
    setChosenCategory(null)
    setNewCat('')
  }

  const close = () => {
    reset()
    onClose()
  }

  async function handleFile(file: File) {
    if (!archiveKind(file.name)) {
      setError(t('garmentUi.import.errUnsupported'))
      return
    }
    revokeAll(detected)
    setDetected([])
    setError(null)
    setSourceName(file.name)
    setPhase('processing')
    try {
      const result = await runImport(file, setProgress)
      // Category-first: the whole pack lands in the category the admin chose up front.
      setDetected(chosenCategory ? result.map((d) => ({ ...d, category: chosenCategory })) : result)
      setPhase('review')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('garmentUi.import.errFailed'))
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

  // Pick an existing category and advance to the drop step.
  const pickCategory = (id: GarmentCategoryId) => {
    setChosenCategory(id)
    setError(null)
    setPhase('idle')
  }

  // Create a custom category (persists it), then select it.
  async function createAndPick() {
    const name = newCat.trim()
    if (!name || creatingCat) return
    setCreatingCat(true)
    const r = await createCategory(name)
    setCreatingCat(false)
    if (!r.ok) {
      toast(r.error, 'default')
      return
    }
    setCategories((list) => (list.some((c) => c.id === r.value.id) ? list : [...list, r.value]))
    setNewCat('')
    pickCategory(r.value.id)
  }

  const includedCount = detected.filter((d) => d.include).length
  const noLayersCount = detected.filter((d) => d.regionCount === 0).length

  async function publish() {
    setPhase('publishing')
    const outcome = await publishGarments(detected, {
      packName: prettyName(sourceName),
      sourceName,
    })
    if (outcome.published.length) {
      toast(
        outcome.published.length === 1
          ? t('garmentUi.import.publishedOne')
          : t('garmentUi.import.publishedMany', { n: outcome.published.length }),
        'success',
      )
    }
    if (outcome.failed.length) {
      toast(
        outcome.failed.length === 1
          ? t('garmentUi.import.failedOne')
          : t('garmentUi.import.failedMany', { n: outcome.failed.length }),
        'default',
      )
    }
    onPublished()
    close()
  }

  return (
    <div className="gl-modal" role="dialog" aria-modal="true" onClick={phase === 'processing' || phase === 'publishing' ? undefined : close}>
      <div className="gl-imp" onClick={(e) => e.stopPropagation()}>
        <header className="gl-imp__head">
          <div>
            <h2>{t('garmentUi.import.title')}</h2>
            <p>
              {phase === 'category'
                ? t('garmentUi.import.introCategory')
                : t('garmentUi.import.introDrop')}
            </p>
          </div>
          <button className="gl-modal__close" type="button" onClick={close} aria-label={t('garmentUi.close')}>
            ×
          </button>
        </header>

        {phase === 'category' && (
          <div className="gl-imp__cats">
            <div className="gl-imp__cats-grid">
              {categories.map((c) => (
                <button key={c.id} type="button" className="gl-imp__cat-chip" onClick={() => pickCategory(c.id)}>
                  {c.label}
                </button>
              ))}
            </div>
            <div className="gl-imp__cat-new">
              <input
                className="gl-imp__cat-input"
                type="text"
                placeholder={t('garmentUi.import.newCatPlaceholder')}
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void createAndPick() }}
                aria-label={t('garmentUi.import.newCatAria')}
              />
              <button className="s-btn s-btn--accent" type="button" onClick={() => void createAndPick()} disabled={!newCat.trim() || creatingCat}>
                {creatingCat ? t('garmentUi.import.creating') : t('garmentUi.import.createUse')}
              </button>
            </div>
          </div>
        )}

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
                <p>{progress?.message ?? t('garmentUi.import.processing')}</p>
              </div>
            ) : (
              <>
                <div className="gl-imp__chosen">
                  <span>{t('garmentUi.import.categoryLabel')} <strong>{chosenCategory ? categoryLabel(chosenCategory) : '—'}</strong></span>
                  <button type="button" className="gl-imp__change" onClick={() => setPhase('category')}>{t('garmentUi.import.change')}</button>
                </div>
                <div className="gl-imp__drop-icon">⤓</div>
                <strong>{t('garmentUi.import.dropTitle')}</strong>
                <span>{t('garmentUi.import.dropSub', { cat: chosenCategory ? categoryLabel(chosenCategory) : '—' })}</span>
                <button className="s-btn s-btn--accent" type="button" onClick={() => inputRef.current?.click()}>
                  {t('garmentUi.import.chooseArchive')}
                </button>
                <small>{t('garmentUi.import.formats')}</small>
                {error && <p className="gl-imp__error">{error}</p>}
              </>
            )}
          </div>
        )}

        {(phase === 'review' || phase === 'publishing') && (
          <>
            <div className="gl-imp__reviewbar">
              <span>
                {t('garmentUi.import.detectedPre')} <strong>{detected.length}</strong>{' '}
                {detected.length === 1 ? t('garmentUi.import.garmentOne') : t('garmentUi.import.garmentMany')} · {t('garmentUi.import.selected', { n: includedCount })}
                {noLayersCount > 0 && (
                  <span className="gl-imp__blocked"> · {t('garmentUi.import.blocked', { n: noLayersCount })}</span>
                )}
              </span>
              <span className="gl-imp__src">{sourceName}</span>
            </div>
            <div className="gl-imp__review">
              {detected.map((d) => (
                <div key={d.tempId} className={`gl-imp__item${d.include ? '' : ' is-off'}${d.regionCount === 0 ? ' gl-imp__item--nolayers' : ''}`}>
                  <label className="gl-imp__check" title={d.regionCount === 0 ? t('garmentUi.import.noLayersTitle') : t('garmentUi.import.includeTitle')}>
                    <input
                      type="checkbox"
                      checked={d.include}
                      disabled={d.regionCount === 0}
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
                      aria-label={t('garmentUi.import.nameAria')}
                    />
                    <div className="gl-imp__row">
                      <select
                        className="gl-imp__cat"
                        value={d.category}
                        onChange={(e) => updateItem(d.tempId, { category: e.target.value as GarmentCategoryId })}
                        aria-label={t('garmentUi.import.categoryAria')}
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                      <label className="gl-imp__price" title={t('garmentUi.import.priceTitle')}>
                        <IcoCoins width="13" height="13" />
                        <input
                          type="number"
                          min={0}
                          step={5}
                          value={d.price}
                          onChange={(e) => updateItem(d.tempId, { price: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
                          aria-label={t('garmentUi.import.priceAria')}
                        />
                      </label>
                      <span
                        className={`gl-imp__health gl-imp__health--${d.health.status}`}
                        title={d.health.issues.join(' · ') || t('garmentUi.import.readyToPublish')}
                      >
                        {d.health.status}
                      </span>
                    </div>
                    <div className="gl-imp__row gl-imp__meta">
                      <span>{t('garmentUi.import.filesCount', { n: d.files.length })}</span>
                      <span className="gl-imp__views">{viewsSummary(d.views)}</span>
                      <span className={`gl-imp__layers${d.regionCount === 0 ? ' gl-imp__layers--none' : ''}`}>
                        {d.regionCount > 0 ? t('garmentUi.import.layersCount', { n: d.regionCount }) : t('garmentUi.import.noLayersReupload')}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <footer className="gl-imp__foot">
              <button className="s-btn" type="button" onClick={reset} disabled={phase === 'publishing'}>
                {t('garmentUi.import.startOver')}
              </button>
              <button
                className="s-btn s-btn--accent"
                type="button"
                onClick={publish}
                disabled={includedCount === 0 || phase === 'publishing'}
              >
                {phase === 'publishing'
                  ? t('garmentUi.import.publishing')
                  : includedCount === 1
                    ? t('garmentUi.import.publishOne')
                    : t('garmentUi.import.publishMany', { n: includedCount })}
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  )
}
