import { useRef, useState } from 'react'
import { useT } from '@/i18n'
import { useToast } from '../../components/ui/Toast'
import { useMarketing } from '../../marketing/useMarketing'
import { optimizeImage, type MkBrandKit } from '../../marketing/marketingStore'

/** Brand Kit — one setup, every generation follows it (tone feeds the engine's prompts). */
export function MkBrandKitPage() {
  const t = useT()
  const toast = useToast()
  const { meta, update } = useMarketing()
  const [kit, setKit] = useState<MkBrandKit>(meta.brand)
  const logoRef = useRef<HTMLInputElement>(null)

  const set = <K extends keyof MkBrandKit>(key: K, value: MkBrandKit[K]) => setKit((k) => ({ ...k, [key]: value }))

  async function pickLogo(file: File | undefined) {
    if (!file || !file.type.startsWith('image/')) return
    const dataUrl = await new Promise<string>((res, rej) => {
      const fr = new FileReader()
      fr.onload = () => res(String(fr.result))
      fr.onerror = () => rej(new Error('read failed'))
      fr.readAsDataURL(file)
    })
    // SVG logos stay vector; raster logos get downscaled so the kit stays lightweight.
    set('logo', file.type === 'image/svg+xml' ? dataUrl : await optimizeImage(dataUrl, 320, 0.9))
  }

  function save() {
    update((m) => ({ ...m, brand: kit }))
    toast(t('mk.brand.saved'), 'success')
  }

  return (
    <section className="mst-sec">
      <div className="mst-sec__head">
        <div>
          <h2>{t('mk.brand.head')}</h2>
          <p>{t('mk.brand.sub')}</p>
        </div>
        <button type="button" className="s-btn s-btn--accent" onClick={save}>
          {t('mk.brand.save')}
        </button>
      </div>

      <div className="mst-brand">
        <div className="mst-brand__form">
          <div className="mst-field">
            <span>{t('mk.brand.logo')}</span>
            <button type="button" className="s-btn s-btn--subtle" onClick={() => logoRef.current?.click()}>
              {kit.logo ? t('mk.brand.logoReplace') : t('mk.brand.logoUpload')}
            </button>
            <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={(e) => {
              void pickLogo(e.target.files?.[0])
              e.target.value = ''
            }} />
          </div>
          <label className="mst-field">
            <span>{t('mk.brand.tone')}</span>
            <input type="text" value={kit.tone} maxLength={120} placeholder={t('mk.brand.tonePh')} onChange={(e) => set('tone', e.target.value)} />
          </label>
          <label className="mst-field">
            <span>{t('mk.brand.fontHeading')}</span>
            <input type="text" value={kit.fontHeading} maxLength={60} placeholder="Inter, Neue Montreal…" onChange={(e) => set('fontHeading', e.target.value)} />
          </label>
          <label className="mst-field">
            <span>{t('mk.brand.fontBody')}</span>
            <input type="text" value={kit.fontBody} maxLength={60} placeholder="Inter" onChange={(e) => set('fontBody', e.target.value)} />
          </label>
          {(['primary', 'secondary', 'accent'] as const).map((key) => (
            <label className="mst-field" key={key}>
              <span>{t(`mk.brand.${key}`)}</span>
              <span className="mst-color">
                <input type="color" value={kit[key]} onChange={(e) => set(key, e.target.value)} aria-label={t(`mk.brand.${key}`)} />
                <input type="text" value={kit[key]} maxLength={9} onChange={(e) => set(key, e.target.value)} />
              </span>
            </label>
          ))}
          <label className="mst-field">
            <span>{t('mk.brand.website')}</span>
            <input type="url" value={kit.website} maxLength={120} placeholder="https://…" onChange={(e) => set('website', e.target.value)} />
          </label>
          <label className="mst-field">
            <span>Instagram</span>
            <input type="text" value={kit.instagram} maxLength={80} placeholder="@brand" onChange={(e) => set('instagram', e.target.value)} />
          </label>
          <label className="mst-field">
            <span>TikTok</span>
            <input type="text" value={kit.tiktok} maxLength={80} placeholder="@brand" onChange={(e) => set('tiktok', e.target.value)} />
          </label>
        </div>

        <aside className="mst-brand__preview" aria-label={t('mk.brand.preview')}>
          {kit.logo ? <img className="mst-brand__logo" src={kit.logo} alt="Logo" /> : <span className="mst-brand__logo" />}
          <b style={{ fontFamily: kit.fontHeading || 'inherit', fontSize: 19, color: 'var(--s-text)' }}>
            {t('mk.brand.previewTitle')}
          </b>
          <p style={{ fontFamily: kit.fontBody || 'inherit', margin: 0, fontSize: 13, lineHeight: 1.55, color: 'var(--s-text-3)' }}>
            {kit.tone || t('mk.brand.previewBody')}
          </p>
          <div className="mst-swatches" aria-hidden="true">
            <span className="mst-swatch" style={{ background: kit.primary }} />
            <span className="mst-swatch" style={{ background: kit.secondary }} />
            <span className="mst-swatch" style={{ background: kit.accent }} />
          </div>
          <p className="mst-note">{t('mk.brand.note')}</p>
        </aside>
      </div>
    </section>
  )
}
