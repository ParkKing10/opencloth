/**
 * Brand Kit panel — lives in the studio's left aside.
 * Edits the account's brand defaults (loadBrandKit/saveBrandKit) and surfaces
 * Brand Memory: the repeated choices loom studios has learned for this designer.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ChangeEvent } from 'react'
import {
  DEFAULT_KIT,
  derivePreferences,
  loadBrandKit,
  preferenceSummary,
  saveBrandKit,
  type BrandKit,
} from '../brandKit'
import { useToast } from '../../components/ui/Toast'
import { IcoCheck, IcoPlus, IcoSparkle } from '../../components/ui/Icons'
import { useT } from '@/i18n'
import './brand-kit.css'

const NEW_COLOR = '#D8FF3E'
const HEX_COLOR = /^#[0-9a-f]{6}$/i
const SAVED_FLASH_MS = 2400

/** Native color inputs only accept #rrggbb — fall back safely for odd values. */
function pickerValue(color: string): string {
  return HEX_COLOR.test(color) ? color : '#000000'
}

type TextFieldProps = {
  id: string
  label: string
  value: string
  placeholder?: string
  multiline?: boolean
  onValue: (next: string) => void
}

function TextField({ id, label, value, placeholder, multiline = false, onValue }: TextFieldProps) {
  return (
    <div className="bk-field">
      <label className="bk-field__label" htmlFor={id}>
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          className="bk-input"
          rows={2}
          value={value}
          placeholder={placeholder}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onValue(e.target.value)}
        />
      ) : (
        <input
          id={id}
          className="bk-input"
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onValue(e.target.value)}
        />
      )}
    </div>
  )
}

function PanelSkeleton() {
  return (
    <div className="bk-skel" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <div className="bk-skel__group" key={i}>
          <span className="bk-skel__bar bk-skel__bar--label" />
          <span className="bk-skel__bar bk-skel__bar--field" />
        </div>
      ))}
    </div>
  )
}

export function BrandKitPanel({ onApplyDefaults }: { onApplyDefaults: (kit: BrandKit) => void }) {
  const toast = useToast()
  const t = useT()
  const uid = useId()
  const [kit, setKit] = useState<BrandKit | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const savedTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    loadBrandKit()
      .then((loaded) => {
        if (!cancelled) setKit(loaded)
      })
      .catch(() => {
        if (!cancelled) setKit({ ...DEFAULT_KIT })
      })
    return () => {
      cancelled = true
      window.clearTimeout(savedTimer.current)
    }
  }, [])

  /** Immutable edit + dirty tracking in one place. */
  const edit = useCallback((recipe: (prev: BrandKit) => BrandKit) => {
    setKit((prev) => (prev ? recipe(prev) : prev))
    setIsDirty(true)
    setJustSaved(false)
  }, [])

  const patch = useCallback(
    (partial: Partial<BrandKit>) => edit((prev) => ({ ...prev, ...partial })),
    [edit],
  )

  const prefs = useMemo(() => (kit ? derivePreferences(kit) : []), [kit])

  const handleSave = async (): Promise<void> => {
    if (!kit || isSaving) return
    setIsSaving(true)
    try {
      const result = await saveBrandKit(kit)
      if (result.ok) {
        setIsDirty(false)
        setJustSaved(true)
        toast(t('drive.bk.toast.saved'), 'success')
        window.clearTimeout(savedTimer.current)
        savedTimer.current = window.setTimeout(() => setJustSaved(false), SAVED_FLASH_MS)
      } else {
        toast(result.error ?? t('drive.bk.toast.saveError'), 'info')
      }
    } catch {
      toast(t('drive.bk.toast.saveError'), 'info')
    } finally {
      setIsSaving(false)
    }
  }

  const showSaved = justSaved && !isDirty && !isSaving
  const saveLabel = isSaving ? t('drive.bk.saving') : showSaved ? t('drive.bk.saved') : t('drive.bk.save')

  return (
    <section className="bk" aria-label={t('drive.bk.aria')}>
      <header className="bk__head">
        <h2>{t('drive.bk.title')}</h2>
        <p>{t('drive.bk.subtitle')}</p>
      </header>

      <div className="bk__scroll">
        {!kit ? (
          <PanelSkeleton />
        ) : (
          <>
            <div className="bk-section">
              <h3 className="bk-section__head">{t('drive.bk.section.brand')}</h3>
              <TextField
                id={`${uid}-name`}
                label={t('drive.bk.field.brandName')}
                value={kit.brandName}
                placeholder={t('drive.bk.ph.brandName')}
                onValue={(v) => patch({ brandName: v })}
              />
            </div>

            <div className="bk-section">
              <h3 className="bk-section__head">{t('drive.bk.section.typography')}</h3>
              <TextField
                id={`${uid}-font-1`}
                label={t('drive.bk.field.primaryFont')}
                value={kit.primaryFont}
                placeholder={t('drive.bk.ph.primaryFont')}
                onValue={(v) => patch({ primaryFont: v })}
              />
              <TextField
                id={`${uid}-font-2`}
                label={t('drive.bk.field.secondaryFont')}
                value={kit.secondaryFont}
                placeholder={t('drive.bk.ph.secondaryFont')}
                onValue={(v) => patch({ secondaryFont: v })}
              />
            </div>

            <div className="bk-section">
              <h3 className="bk-section__head">
                {t('drive.bk.section.colors')} <span className="bk-section__count">{kit.colors.length}</span>
              </h3>
              <div className="bk-colors">
                {kit.colors.map((color, i) => (
                  <span className="bk-swatch-wrap" key={`c-${i}`}>
                    <label className="bk-swatch" style={{ background: color }} title={color}>
                      <input
                        type="color"
                        value={pickerValue(color)}
                        aria-label={t('drive.bk.color.aria', { n: i + 1, color })}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => {
                          const next = e.target.value
                          edit((prev) => ({
                            ...prev,
                            colors: prev.colors.map((c, ci) => (ci === i ? next : c)),
                          }))
                        }}
                      />
                    </label>
                    {kit.colors.length > 1 && (
                      <button
                        type="button"
                        className="bk-swatch__x"
                        aria-label={t('drive.bk.color.remove', { color })}
                        onClick={() =>
                          edit((prev) => ({
                            ...prev,
                            colors: prev.colors.filter((_, ci) => ci !== i),
                          }))
                        }
                      >
                        <svg viewBox="0 0 8 8" width="7" height="7" aria-hidden="true">
                          <path
                            d="M1 1l6 6M7 1L1 7"
                            stroke="currentColor"
                            strokeWidth="1.4"
                            strokeLinecap="round"
                          />
                        </svg>
                      </button>
                    )}
                  </span>
                ))}
                <button
                  type="button"
                  className="bk-add-color"
                  aria-label={t('drive.bk.color.add')}
                  onClick={() => edit((prev) => ({ ...prev, colors: [...prev.colors, NEW_COLOR] }))}
                >
                  <IcoPlus width={13} height={13} />
                </button>
              </div>
            </div>

            <div className="bk-section">
              <h3 className="bk-section__head">{t('drive.bk.section.defaults')}</h3>
              <TextField
                id={`${uid}-fabric`}
                label={t('drive.bk.field.fabric')}
                value={kit.defaultFabric}
                placeholder={t('drive.bk.ph.fabric')}
                onValue={(v) => patch({ defaultFabric: v })}
              />
              <TextField
                id={`${uid}-fit`}
                label={t('drive.bk.field.fit')}
                value={kit.defaultFit}
                placeholder={t('drive.bk.ph.fit')}
                onValue={(v) => patch({ defaultFit: v })}
              />
              <TextField
                id={`${uid}-labels`}
                label={t('drive.bk.field.labels')}
                value={kit.defaultLabels}
                placeholder={t('drive.bk.ph.labels')}
                onValue={(v) => patch({ defaultLabels: v })}
              />
            </div>

            <div className="bk-section">
              <h3 className="bk-section__head">{t('drive.bk.section.notes')}</h3>
              <TextField
                id={`${uid}-packaging`}
                label={t('drive.bk.field.packaging')}
                value={kit.packagingNotes}
                placeholder={t('drive.bk.ph.packaging')}
                multiline
                onValue={(v) => patch({ packagingNotes: v })}
              />
              <TextField
                id={`${uid}-notes`}
                label={t('drive.bk.field.brandNotes')}
                value={kit.brandNotes}
                placeholder={t('drive.bk.ph.brandNotes')}
                multiline
                onValue={(v) => patch({ brandNotes: v })}
              />
            </div>

            <div className="bk-section">
              <div className="bk-toggle-row">
                <span className="bk-toggle-row__text">
                  <b id={`${uid}-memory`}>
                    <IcoSparkle width={12} height={12} />
                    {t('drive.bk.memory.title')}
                  </b>
                  <small>{t('drive.bk.memory.hint')}</small>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={kit.memoryEnabled}
                  aria-labelledby={`${uid}-memory`}
                  className="bk-switch"
                  onClick={() => patch({ memoryEnabled: !kit.memoryEnabled })}
                >
                  <span className="bk-switch__knob" />
                </button>
              </div>
              {kit.memoryEnabled &&
                (prefs.length > 0 ? (
                  <>
                    <div className="bk-chips">
                      {prefs.map((p) => (
                        <span className="bk-chip" key={p.dimension} title={`${p.dimension}: ${p.value}`}>
                          {p.value} <em>×{p.count}</em>
                        </span>
                      ))}
                    </div>
                    <p className="bk-usual">{t('drive.bk.memory.usual', { summary: preferenceSummary(prefs) })}</p>
                  </>
                ) : (
                  <p className="bk-memory-empty">{t('drive.bk.memory.empty')}</p>
                ))}
            </div>
          </>
        )}
      </div>

      <footer className="bk__foot">
        <button
          type="button"
          className={`bk-btn bk-btn--primary${showSaved ? ' is-saved' : ''}`}
          disabled={!kit || isSaving || !isDirty}
          onClick={() => void handleSave()}
        >
          {showSaved && <IcoCheck width={13} height={13} />}
          {saveLabel}
        </button>
        <button
          type="button"
          className="bk-btn bk-btn--ghost"
          disabled={!kit}
          onClick={() => {
            if (kit) onApplyDefaults(kit)
          }}
        >
          {t('drive.bk.apply')}
        </button>
      </footer>
    </section>
  )
}
