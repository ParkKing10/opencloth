import { useEffect, useState } from 'react'
import { useT } from '@/i18n'
import type { Collection } from '../../data/types'

/**
 * What the user chose in the Save dialog. Either an existing collection (or none),
 * or a brand-new collection to create — the parent creates it and saves the design
 * atomically so the design never references a collection that doesn't exist yet.
 */
export type SaveChoice = {
  name: string
  collectionId?: string
  newCollection?: string
}

type Props = {
  open: boolean
  initialName: string
  collections: Collection[]
  currentCollectionId?: string
  onClose: () => void
  onSave: (choice: SaveChoice) => void
}

/**
 * Save a design: name it and choose which collection it belongs to. If the user has
 * no collections yet (or wants a fresh one) they create one inline, then save into it.
 */
export function SaveDesignDialog({
  open,
  initialName,
  collections,
  currentCollectionId,
  onClose,
  onSave,
}: Props) {
  const t = useT()
  const [name, setName] = useState(initialName)
  const [collectionId, setCollectionId] = useState<string | undefined>(currentCollectionId)
  const [creating, setCreating] = useState(false)
  const [newCollection, setNewCollection] = useState('')

  // Reset to the current design's values every time the dialog opens.
  useEffect(() => {
    if (!open) return
    setName(initialName)
    setCollectionId(currentCollectionId)
    // With no collections yet, go straight to creating one.
    setCreating(collections.length === 0)
    setNewCollection('')
  }, [open, initialName, currentCollectionId, collections.length])

  if (!open) return null

  const canSave = name.trim().length > 0 && (!creating || newCollection.trim().length > 0)

  function confirm() {
    if (!canSave) return
    if (creating && newCollection.trim()) onSave({ name: name.trim(), newCollection: newCollection.trim() })
    else onSave({ name: name.trim(), collectionId })
  }

  return (
    <div className="ds-save" role="dialog" aria-modal="true" aria-label={t('dsDialogs.save.title')} onClick={onClose}>
      <div className="ds-save__panel" onClick={(e) => e.stopPropagation()}>
        <header className="ds-save__head">
          <h2>{t('dsDialogs.save.title')}</h2>
          <button className="ds-save__x" type="button" aria-label={t('dsDialogs.save.close')} onClick={onClose}>
            ×
          </button>
        </header>

        <label className="ds-save__field">
          <span className="ds-save__label">{t('dsDialogs.save.name')}</span>
          <input
            className="ds-save__input"
            autoFocus
            value={name}
            placeholder={t('dsDialogs.save.designNamePlaceholder')}
            aria-label={t('dsDialogs.save.designNamePlaceholder')}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && confirm()}
          />
        </label>

        <div className="ds-save__field">
          <span className="ds-save__label">{t('dsDialogs.save.collection')}</span>
          {creating ? (
            <div className="ds-save__row">
              <input
                className="ds-save__input"
                autoFocus
                value={newCollection}
                placeholder={t('dsDialogs.save.newCollectionName')}
                aria-label={t('dsDialogs.save.newCollectionName')}
                onChange={(e) => setNewCollection(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && confirm()}
              />
              {collections.length > 0 && (
                <button type="button" className="ds-save__linkbtn" onClick={() => setCreating(false)}>
                  {t('dsDialogs.save.pickExisting')}
                </button>
              )}
            </div>
          ) : (
            <div className="ds-save__row">
              <select
                className="ds-save__input"
                value={collectionId ?? ''}
                aria-label={t('dsDialogs.save.collection')}
                onChange={(e) => setCollectionId(e.target.value || undefined)}
              >
                <option value="">{t('dsDialogs.save.noCollection')}</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button type="button" className="ds-save__linkbtn" onClick={() => { setCreating(true); setNewCollection('') }}>
                {t('dsDialogs.save.newCollection')}
              </button>
            </div>
          )}
        </div>

        <footer className="ds-save__foot">
          <button type="button" className="s-btn" onClick={onClose}>
            {t('dsDialogs.save.cancel')}
          </button>
          <button type="button" className="s-btn s-btn--accent" disabled={!canSave} onClick={confirm}>
            {t('dsDialogs.save.save')}
          </button>
        </footer>
      </div>
    </div>
  )
}
