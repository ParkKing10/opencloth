import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useT } from '@/i18n'
import { useToast } from '../../components/ui/Toast'
import { IcoPlus, IcoSparkle } from '../../components/ui/Icons'
import { maxCharactersFor } from '../../economy/economy'
import { useMarketing } from '../../marketing/useMarketing'
import {
  delBlobs,
  mkId,
  optimizeImage,
  putBlob,
  squareThumb,
  type MkCharacter,
  type MkGender,
  type MkLang,
  type MkVoice,
} from '../../marketing/marketingStore'

/* Characters — reusable AI people. Upload a reference set once (20+ photos recommended), the
   studio optimizes and stores it, and every future generation can keep the same identity by
   conditioning on those references. */

const STYLE_PRESETS = ['Streetwear model', 'Luxury model', 'Founder', 'Influencer', 'UGC creator', 'Fitness creator', 'Fashion creator'] as const
const MIN_PHOTOS = 6
const RECOMMENDED_PHOTOS = 20

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const fr = new FileReader()
    fr.onload = () => res(String(fr.result))
    fr.onerror = () => rej(new Error('read failed'))
    fr.readAsDataURL(file)
  })
}

type WizardProps = {
  existing?: MkCharacter
  onClose: () => void
  onSaved: (c: MkCharacter) => void
}

function CharacterWizard({ existing, onClose, onSaved }: WizardProps) {
  const t = useT()
  const toast = useToast()
  const [step, setStep] = useState<'photos' | 'persona' | 'train'>('photos')
  const [photos, setPhotos] = useState<string[]>([]) // raw data URLs (new uploads this session)
  const [drag, setDrag] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState(existing?.name ?? '')
  const [age, setAge] = useState(existing?.age ?? 24)
  const [gender, setGender] = useState<MkGender>(existing?.gender ?? 'female')
  const [language, setLanguage] = useState<MkLang>(existing?.language ?? 'en')
  const [voice, setVoice] = useState<MkVoice>(existing?.voice ?? 'warm')
  const [style, setStyle] = useState<string>(existing?.style ?? STYLE_PRESETS[0])
  const [description, setDescription] = useState(existing?.description ?? '')

  // Real processing pipeline: each photo is decoded, downscaled and persisted — the progress bar
  // tracks actual work, and the ETA is measured from the running average per photo.
  const [done, setDone] = useState(0)
  const [phase, setPhase] = useState<'read' | 'optimize' | 'identity' | 'finished'>('read')
  const [eta, setEta] = useState<number | null>(null)
  const cancelled = useRef(false)

  useEffect(() => () => {
    cancelled.current = true
  }, [])

  async function addFiles(files: FileList | File[]) {
    const imgs = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (imgs.length === 0) return
    const urls = await Promise.all(imgs.map(readFileAsDataUrl))
    setPhotos((prev) => [...prev, ...urls])
  }

  const totalPhotos = (existing?.photoCount ?? 0) + photos.length
  // Soft minimum: one photo is enough to proceed (fewer refs = less consistent, and we say so).
  const canTrain = totalPhotos >= 1 && name.trim().length > 0

  async function train() {
    setStep('train')
    setPhase('read')
    setDone(0)
    const id = existing?.id ?? mkId('char')
    const keys: string[] = existing ? [...existing.photoKeys] : []
    const started = Date.now()
    setPhase('optimize')
    for (let i = 0; i < photos.length; i++) {
      if (cancelled.current) return
      try {
        const optimized = await optimizeImage(photos[i], 768, 0.85)
        const key = `${id}_p${Date.now().toString(36)}_${i}`
        if (await putBlob(key, optimized)) keys.push(key)
      } catch {
        /* skip unreadable photo */
      }
      const processed = i + 1
      setDone(processed)
      const perPhoto = (Date.now() - started) / processed
      setEta(Math.ceil(((photos.length - processed) * perPhoto) / 1000))
    }
    setPhase('identity')
    let avatar = existing?.avatar ?? ''
    try {
      if (photos[0]) avatar = await squareThumb(photos[0], 160)
    } catch {
      /* keep previous avatar */
    }
    const character: MkCharacter = {
      id,
      name: name.trim(),
      age: Math.max(16, Math.min(90, age)),
      gender,
      language,
      voice,
      style,
      description: description.trim(),
      status: 'ready',
      avatar,
      photoCount: keys.length,
      photoKeys: keys,
      createdAt: existing?.createdAt ?? Date.now(),
    }
    setPhase('finished')
    onSaved(character)
    toast(t('mk.char.toastReady', { name: character.name }), 'success')
    setTimeout(onClose, 650)
  }

  const pct = photos.length === 0 ? 100 : Math.round((done / photos.length) * 100)

  return (
    <div className="mst-scrim" role="presentation" onClick={step === 'train' ? undefined : onClose}>
      <div className="mst-modal" role="dialog" aria-modal="true" aria-label={t('mk.char.wizardTitle')} onClick={(e) => e.stopPropagation()}>
        <div className="mst-modal__head">
          <div>
            <h2>{existing ? t('mk.char.editTitle', { name: existing.name }) : t('mk.char.wizardTitle')}</h2>
            <p>{step === 'photos' ? t('mk.char.wizardSubPhotos') : step === 'persona' ? t('mk.char.wizardSubPersona') : t('mk.char.wizardSubTrain')}</p>
          </div>
          {step !== 'train' && (
            <button type="button" className="mst-modal__x" aria-label={t('mk.close')} onClick={onClose}>
              ×
            </button>
          )}
        </div>

        {step === 'photos' && (
          <>
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
              <b>{t('mk.char.dropTitle')}</b>
              <small>{t('mk.char.dropHint', { min: MIN_PHOTOS, rec: RECOMMENDED_PHOTOS })}</small>
              <small>
                <b>
                  {totalPhotos}/{RECOMMENDED_PHOTOS}+
                </b>{' '}
                {t('mk.char.photosCounted')}
              </small>
            </div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => {
              void addFiles(e.target.files ?? [])
              e.target.value = ''
            }} />

            {photos.length > 0 && (
              <div className="mst-thumbs">
                {photos.map((p, i) => (
                  <span className="mst-thumb" key={i}>
                    <img src={p} alt="" />
                    <button type="button" className="mst-thumb__x" aria-label={t('mk.remove')} onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}>
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="mst-examples">
              <div className="mst-ex mst-ex--good">
                <b>{t('mk.char.goodTitle')}</b>
                {t('mk.char.goodBody')}
              </div>
              <div className="mst-ex mst-ex--bad">
                <b>{t('mk.char.badTitle')}</b>
                {t('mk.char.badBody')}
              </div>
            </div>

            {/* Soft minimum: continuing is possible from the first photo — below MIN_PHOTOS we
                warn about consistency instead of silently dead-locking the Continue button. */}
            {totalPhotos > 0 && totalPhotos < MIN_PHOTOS && !existing && (
              <p className="mst-char-warn">{t('mk.char.fewPhotos', { n: totalPhotos, min: MIN_PHOTOS })}</p>
            )}
            <div className="mst-modal__foot">
              <button type="button" className="s-btn s-btn--subtle" onClick={onClose}>
                {t('mk.cancel')}
              </button>
              <button type="button" className="s-btn s-btn--accent" disabled={totalPhotos === 0 && !existing} onClick={() => setStep('persona')}>
                {t('mk.continue')}
              </button>
            </div>
          </>
        )}

        {step === 'persona' && (
          <>
            <div className="mst-form">
              <label className="mst-field">
                <span>{t('mk.char.name')}</span>
                <input type="text" value={name} maxLength={40} placeholder="Lena Voss" onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="mst-field">
                <span>{t('mk.char.age')}</span>
                <input type="number" min={16} max={90} value={age} onChange={(e) => setAge(Number(e.target.value) || 24)} />
              </label>
              <label className="mst-field">
                <span>{t('mk.char.gender')}</span>
                <select value={gender} onChange={(e) => setGender(e.target.value as MkGender)}>
                  <option value="female">{t('mk.gender.female')}</option>
                  <option value="male">{t('mk.gender.male')}</option>
                  <option value="nonbinary">{t('mk.gender.nonbinary')}</option>
                </select>
              </label>
              <label className="mst-field">
                <span>{t('mk.char.language')}</span>
                <select value={language} onChange={(e) => setLanguage(e.target.value as MkLang)}>
                  <option value="en">English</option>
                  <option value="de">Deutsch</option>
                  <option value="fr">Français</option>
                  <option value="es">Español</option>
                </select>
              </label>
              <label className="mst-field">
                <span>{t('mk.char.voice')}</span>
                <select value={voice} onChange={(e) => setVoice(e.target.value as MkVoice)}>
                  <option value="warm">{t('mk.voice.warm')}</option>
                  <option value="energetic">{t('mk.voice.energetic')}</option>
                  <option value="calm">{t('mk.voice.calm')}</option>
                  <option value="deep">{t('mk.voice.deep')}</option>
                  <option value="playful">{t('mk.voice.playful')}</option>
                </select>
              </label>
              <div className="mst-field">
                <span>{t('mk.char.style')}</span>
                <div className="mst-chiprow">
                  {STYLE_PRESETS.map((s) => (
                    <button key={s} type="button" className={`mst-chip${style === s ? ' is-on' : ''}`} aria-pressed={style === s} onClick={() => setStyle(s)}>
                      {t(`mk.style.${s.toLowerCase().replace(/\s+/g, '-')}`)}
                    </button>
                  ))}
                </div>
              </div>
              <label className="mst-field mst-field--wide">
                <span>{t('mk.char.description')}</span>
                <textarea rows={2} maxLength={280} value={description} placeholder={t('mk.char.descriptionPh')} onChange={(e) => setDescription(e.target.value)} />
              </label>
            </div>

            <div className="mst-modal__foot">
              <button type="button" className="s-btn s-btn--subtle" onClick={() => setStep('photos')}>
                {t('mk.back')}
              </button>
              <button type="button" className="s-btn s-btn--accent" disabled={!canTrain} onClick={() => void train()}>
                <IcoSparkle width="15" height="15" /> {t('mk.char.startTraining')}
              </button>
            </div>
          </>
        )}

        {step === 'train' && (
          <div className="mst-train" aria-live="polite">
            <div className="mst-train__row">
              <b>{t('mk.char.trainingTitle', { name: name.trim() || '—' })}</b>
              <span>
                {done}/{photos.length} · {eta !== null && phase === 'optimize' ? t('mk.char.eta', { s: eta }) : '…'}
              </span>
            </div>
            <div className="mst-train__bar">
              <span style={{ width: `${pct}%` }} />
            </div>
            <div className="mst-steps">
              {(['read', 'optimize', 'identity', 'finished'] as const).map((p) => {
                const order = ['read', 'optimize', 'identity', 'finished']
                const state = order.indexOf(phase) > order.indexOf(p) ? 'is-done' : phase === p ? 'is-active' : ''
                return (
                  <div key={p} className={`mst-step ${state}`}>
                    <span className="mst-step__dot">{state === 'is-done' ? '✓' : ''}</span>
                    {t(`mk.char.phase.${p}`)}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function MkCharacters() {
  const t = useT()
  const toast = useToast()
  const navigate = useNavigate()
  const { user, meta, update } = useMarketing()
  const [wizard, setWizard] = useState<null | { existing?: MkCharacter }>(null)

  // Character slots are the plan's strongest real differentiator — enforce them here.
  const maxChars = maxCharactersFor(user?.plan ?? 'Free')
  const atLimit = meta.characters.length >= maxChars
  const openCreate = () => {
    if (atLimit) {
      toast(t('mk.chars.limitReached'), 'info')
      navigate('/pricing')
      return
    }
    setWizard({})
  }

  function saveCharacter(c: MkCharacter) {
    update((m) => {
      const exists = m.characters.some((x) => x.id === c.id)
      return { ...m, characters: exists ? m.characters.map((x) => (x.id === c.id ? c : x)) : [c, ...m.characters] }
    })
  }

  function remove(c: MkCharacter) {
    if (!window.confirm(t('mk.char.confirmDelete', { name: c.name }))) return
    void delBlobs(c.photoKeys)
    update((m) => ({ ...m, characters: m.characters.filter((x) => x.id !== c.id) }))
    toast(t('mk.char.toastDeleted', { name: c.name }), 'default')
  }

  return (
    <section className="mst-sec">
      <div className="mst-sec__head">
        <div>
          <h2>{t('mk.chars.head')}</h2>
          <p>{t('mk.chars.sub')}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="mst-pill" title={t('mk.chars.slotsTitle')}>
            {t('mk.chars.slots', { n: meta.characters.length, max: Number.isFinite(maxChars) ? maxChars : '∞' })}
          </span>
          <button type="button" className="s-btn s-btn--accent" onClick={openCreate}>
            <IcoPlus width="15" height="15" /> {atLimit ? t('mk.chars.upgrade') : t('mk.chars.cta')}
          </button>
        </div>
      </div>

      {meta.characters.length === 0 ? (
        <div className="mst-empty">
          <b>{t('mk.chars.emptyTitle')}</b>
          <p>{t('mk.chars.emptyBody')}</p>
          <button type="button" className="s-btn s-btn--accent" onClick={openCreate}>
            <IcoPlus width="15" height="15" /> {t('mk.chars.cta')}
          </button>
        </div>
      ) : (
        <div className="mst-chars">
          {meta.characters.map((c) => (
            <article className="mst-char" key={c.id}>
              <div className="mst-char__top">
                {c.avatar ? <img className="mst-char__avatar" src={c.avatar} alt={c.name} /> : <span className="mst-char__avatar" />}
                <div className="mst-char__ident">
                  <b>{c.name}</b>
                  <small>{t(`mk.style.${c.style.toLowerCase().replace(/\s+/g, '-')}`)}</small>
                  <span className={`mst-status mst-status--${c.status}`}>
                    <span className="mst-status__dot" aria-hidden="true" />
                    {c.status === 'ready' ? t('mk.char.statusReady') : t('mk.char.statusProcessing')}
                  </span>
                </div>
              </div>
              {c.description && <p className="mst-char__desc">{c.description}</p>}
              <div className="mst-pills">
                <span className="mst-pill">{c.age}</span>
                <span className="mst-pill">{t(`mk.gender.${c.gender}`)}</span>
                <span className="mst-pill">{c.language.toUpperCase()}</span>
                <span className="mst-pill">{t(`mk.voice.${c.voice}`)}</span>
                <span className="mst-pill">{t('mk.char.photos', { n: c.photoCount })}</span>
              </div>
              <div className="mst-char__actions">
                <button type="button" className="s-btn s-btn--accent" onClick={() => navigate(`/marketing/generate?c=${c.id}`)}>
                  {t('mk.char.generate')}
                </button>
                <button type="button" className="s-btn s-btn--subtle" onClick={() => setWizard({ existing: c })}>
                  {t('mk.edit')}
                </button>
                <button type="button" className="mst-char__del" aria-label={t('mk.delete')} title={t('mk.delete')} onClick={() => remove(c)}>
                  ×
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {wizard && <CharacterWizard existing={wizard.existing} onClose={() => setWizard(null)} onSaved={saveCharacter} />}
    </section>
  )
}
