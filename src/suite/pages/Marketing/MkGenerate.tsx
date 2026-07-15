import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useT } from '@/i18n'
import { useToast } from '../../components/ui/Toast'
import { IcoSparkle, IcoCoins } from '../../components/ui/Icons'
import { hasImageAi, generateImages, type ImageSize } from '../../ai/imageProvider'
import { COSTS } from '../../economy/economy'
import { usePaywall } from '../../economy/PaywallProvider'
import { MK_TEMPLATES, MK_PHOTO_STYLES, mkTemplate } from '../../marketing/templates'
import { buildPhotoPrompt, buildPlan, buildStoryboard, type EngineCtx } from '../../marketing/engine'
import { getBlob, mkId, putBlob, type MkContent } from '../../marketing/marketingStore'
import { useMarketing } from '../../marketing/useMarketing'
import { useMkProducts } from '../../marketing/useMkProducts'
import { TemplateCard } from './TemplateCard'

/* The generator — the whole workflow in one calm page:
   template → campaign → products → character → prompt → generate.
   Plans and storyboard scripts are written on-device (instant, free); every rendered image goes
   through the shared image provider and the coin paywall. */

const GEN_TIMEOUT_MS = 120_000
const PHOTO_COUNT = 3
const KEYFRAME_COUNT = 3

function sizeFor(format: string): ImageSize {
  if (format === '16:9') return '1536x1024'
  if (format === '1:1') return '1024x1024'
  return '1024x1536'
}

export function MkGenerate() {
  const t = useT()
  const toast = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { user, meta, update } = useMarketing()
  const { products } = useMkProducts()
  const { requireGeneration } = usePaywall()
  const [live] = useState(() => hasImageAi())

  const [templateId, setTemplateId] = useState(() => (mkTemplate(params.get('t') ?? '') ? (params.get('t') as string) : 'tiktok-hook'))
  const [campaignId, setCampaignId] = useState<string | undefined>(() => params.get('camp') ?? undefined)
  const [productIds, setProductIds] = useState<string[]>(() => (params.get('p') ? [params.get('p') as string] : []))
  const [characterId, setCharacterId] = useState<string | undefined>(() => params.get('c') ?? undefined)
  const [style, setStyle] = useState<string>('studio')
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [resultId, setResultId] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const template = mkTemplate(templateId) ?? MK_TEMPLATES[0]
  const character = meta.characters.find((c) => c.id === characterId)
  const selectedProducts = products.filter((p) => productIds.includes(p.id))
  const result = meta.content.find((c) => c.id === resultId) ?? null

  const needsProducts = template.output !== 'plan'
  const missingCharacter = template.wantsCharacter === 'required' && !character
  const canGenerate =
    !busy && !!user && (!needsProducts || selectedProducts.length > 0) && !missingCharacter

  const costLabel = useMemo(() => {
    if (template.output === 'plan') return t('mk.gen.free')
    if (template.output === 'storyboard') return live ? t('mk.gen.costKeyframes', { n: COSTS.mockup }) : t('mk.gen.freeScript')
    return live ? t('mk.gen.costPhotos', { n: COSTS.mockup }) : t('mk.gen.needsKey')
  }, [template.output, live, t])

  function toggleProduct(id: string) {
    setProductIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]).slice(-4))
  }

  async function referenceImages(): Promise<string[]> {
    const refs: string[] = []
    for (const p of selectedProducts.slice(0, 2)) if (p.image) refs.push(p.image)
    if (character) {
      for (const key of character.photoKeys.slice(0, 2)) {
        const img = await getBlob(key)
        if (img) refs.push(img)
      }
    }
    return refs
  }

  function saveContent(content: MkContent) {
    update((m) => ({
      ...m,
      content: [content, ...m.content],
      campaigns: content.campaignId
        ? m.campaigns.map((c) => (c.id === content.campaignId ? { ...c, contentIds: [content.id, ...c.contentIds] } : c))
        : m.campaigns,
    }))
    setResultId(content.id)
  }

  async function generate() {
    if (!canGenerate || !user) return
    const ctx: EngineCtx = {
      template,
      products: selectedProducts.map((p) => ({ id: p.id, name: p.name, image: p.image })),
      character,
      prompt,
      brand: meta.brand,
    }
    const title = `${t(`mk.tpl.${template.id}.title`)}${selectedProducts[0] ? ` — ${selectedProducts[0].name}` : ''}`
    const base: MkContent = {
      id: mkId('content'),
      templateId: template.id,
      kind: template.output,
      title,
      campaignId,
      characterId: character?.id,
      productIds,
      prompt: prompt.trim(),
      imageKeys: [],
      createdAt: Date.now(),
    }

    // Content plan — on-device, instant, free.
    if (template.output === 'plan') {
      saveContent({ ...base, plan: buildPlan(ctx, 30) })
      toast(t('mk.gen.donePlan'), 'success')
      return
    }

    setBusy(true)
    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      if (template.output === 'photo') {
        if (!live) {
          toast(t('mk.gen.needsKey'), 'info')
          return
        }
        const gate = requireGeneration('mockup')
        if (!gate.allow) return
        const refs = await referenceImages()
        const imageKeys: string[] = []
        for (let i = 0; i < PHOTO_COUNT; i++) {
          setProgress(t('mk.gen.progressPhoto', { i: i + 1, n: PHOTO_COUNT }))
          try {
            const signal = AbortSignal.any([ctrl.signal, AbortSignal.timeout(GEN_TIMEOUT_MS)])
            const url = (await generateImages(buildPhotoPrompt(ctx, style), { n: 1, references: refs, size: sizeFor(template.format), quality: 'high', signal }))[0]
            if (url) {
              const key = `${base.id}_img${i}`
              if (await putBlob(key, url)) imageKeys.push(key)
            }
          } catch {
            /* keep going — one failed frame must not kill the shoot */
          }
        }
        if (imageKeys.length === 0) {
          toast(t('mk.gen.failed'), 'info')
          return
        }
        gate.commit()
        saveContent({ ...base, imageKeys })
        toast(t('mk.gen.donePhotos', { n: imageKeys.length }), 'success')
        return
      }

      // Storyboard: the script is always written (free); keyframes render when a model is live.
      const script = buildStoryboard(ctx)
      if (live) {
        const gate = requireGeneration('mockup')
        if (gate.allow) {
          const refs = await referenceImages()
          let rendered = 0
          for (let i = 0; i < Math.min(KEYFRAME_COUNT, script.scenes.length); i++) {
            setProgress(t('mk.gen.progressScene', { i: i + 1, n: Math.min(KEYFRAME_COUNT, script.scenes.length) }))
            try {
              const signal = AbortSignal.any([ctrl.signal, AbortSignal.timeout(GEN_TIMEOUT_MS)])
              const url = (await generateImages(script.scenes[i].keyframePrompt, { n: 1, references: refs, size: sizeFor(template.format), quality: 'medium', signal }))[0]
              if (url) {
                const key = `${base.id}_kf${i}`
                if (await putBlob(key, url)) {
                  script.scenes[i].imageKey = key
                  rendered++
                }
              }
            } catch {
              /* scene keyframe failed — the script still stands */
            }
          }
          if (rendered > 0) gate.commit()
        }
      }
      saveContent({ ...base, script })
      toast(t('mk.gen.doneStoryboard'), 'success')
    } finally {
      setBusy(false)
      setProgress('')
      abortRef.current = null
    }
  }

  return (
    <div className="mst-gen">
      {/* 1 — Template */}
      <section className="mst-gstep">
        <div className="mst-gstep__head">
          <span className="mst-gstep__num">1</span>
          <h3>{t('mk.gen.step1')}</h3>
        </div>
        <div className="mst-strip">
          {MK_TEMPLATES.filter((tpl) => tpl.output !== 'plan' || tpl.id === templateId).map((tpl) => (
            <TemplateCard key={tpl.id} template={tpl} selected={templateId === tpl.id} onSelect={() => setTemplateId(tpl.id)} />
          ))}
        </div>
      </section>

      {/* 2 — Campaign */}
      <section className="mst-gstep">
        <div className="mst-gstep__head">
          <span className="mst-gstep__num">2</span>
          <h3>{t('mk.gen.step2')}</h3>
          <small>{t('mk.optional')}</small>
        </div>
        {meta.campaigns.length === 0 ? (
          <p className="mst-note">{t('mk.gen.noCampaigns')}</p>
        ) : (
          <div className="mst-chiprow">
            {meta.campaigns.map((c) => (
              <button key={c.id} type="button" className={`mst-chip${campaignId === c.id ? ' is-on' : ''}`} aria-pressed={campaignId === c.id} onClick={() => setCampaignId(campaignId === c.id ? undefined : c.id)}>
                {c.name}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* 3 — Products */}
      {needsProducts && (
        <section className="mst-gstep">
          <div className="mst-gstep__head">
            <span className="mst-gstep__num">3</span>
            <h3>{t('mk.gen.step3')}</h3>
            <small>{t('mk.gen.step3Hint')}</small>
          </div>
          {products.length === 0 ? (
            <p className="mst-note">{t('mk.products.emptyBody')}</p>
          ) : (
            <div className="mst-minis">
              {products.slice(0, 24).map((p) => (
                <button key={p.id} type="button" className={`mst-mini${productIds.includes(p.id) ? ' is-on' : ''}`} aria-pressed={productIds.includes(p.id)} onClick={() => toggleProduct(p.id)}>
                  {p.image && <img src={p.image} alt="" />}
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 4 — Character */}
      {template.wantsCharacter !== 'none' && (
        <section className="mst-gstep">
          <div className="mst-gstep__head">
            <span className="mst-gstep__num">4</span>
            <h3>{t('mk.gen.step4')}</h3>
            <small>{template.wantsCharacter === 'required' ? t('mk.required') : t('mk.optional')}</small>
          </div>
          {meta.characters.length === 0 ? (
            <p className="mst-note">{t('mk.gen.noCharacters')}</p>
          ) : (
            <div className="mst-minis">
              {meta.characters.map((c) => (
                <button key={c.id} type="button" className={`mst-mini${characterId === c.id ? ' is-on' : ''}`} aria-pressed={characterId === c.id} onClick={() => setCharacterId(characterId === c.id ? undefined : c.id)}>
                  {c.avatar && <img src={c.avatar} alt="" />}
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 5 — Style (photo only) */}
      {template.output === 'photo' && (
        <section className="mst-gstep">
          <div className="mst-gstep__head">
            <span className="mst-gstep__num">5</span>
            <h3>{t('mk.gen.step5')}</h3>
          </div>
          <div className="mst-chiprow">
            {MK_PHOTO_STYLES.map((s) => (
              <button key={s} type="button" className={`mst-chip${style === s ? ' is-on' : ''}`} aria-pressed={style === s} onClick={() => setStyle(s)}>
                {t(`mk.photoStyle.${s}`)}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 6 — Prompt */}
      <section className="mst-gstep">
        <div className="mst-gstep__head">
          <span className="mst-gstep__num">{template.output === 'photo' ? 6 : 5}</span>
          <h3>{t('mk.gen.step6')}</h3>
        </div>
        <div className="mst-prompt">
          <textarea
            value={prompt}
            maxLength={480}
            placeholder={t('mk.gen.promptPh')}
            aria-label={t('mk.gen.step6')}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>
      </section>

      {/* Generate bar */}
      <div className="mst-genbar">
        <div className="mst-genbar__info">
          <b>{t(`mk.tpl.${template.id}.title`)}{selectedProducts[0] ? ` · ${selectedProducts[0].name}` : ''}{character ? ` · ${character.name}` : ''}</b>
          <small>
            <IcoCoins width="11" height="11" /> {costLabel}
            {missingCharacter && ` — ${t('mk.gen.needCharacter')}`}
          </small>
        </div>
        <button type="button" className="s-btn s-btn--accent" disabled={!canGenerate} onClick={() => void generate()}>
          <IcoSparkle width="16" height="16" /> {busy ? progress || t('mk.gen.generating') : t('mk.gen.cta')}
        </button>
      </div>

      {/* Result */}
      {result && (
        <section className="mst-gstep" aria-live="polite">
          <div className="mst-gstep__head">
            <span className="mst-gstep__num">✓</span>
            <h3>{t('mk.gen.resultHead')}</h3>
            <small>{t('mk.gen.resultSaved')}</small>
          </div>
          <ResultPreview content={result} />
          <div>
            <button type="button" className="s-btn s-btn--subtle" onClick={() => navigate('/marketing/library')}>
              {t('mk.gen.openLibrary')}
            </button>
          </div>
        </section>
      )}
    </div>
  )
}

function ResultPreview({ content }: { content: MkContent }) {
  const t = useT()
  const [images, setImages] = useState<string[]>([])
  const keys = useMemo(
    () => [...content.imageKeys, ...(content.script?.scenes.map((s) => s.imageKey).filter((k): k is string => !!k) ?? [])],
    [content],
  )
  useEffect(() => {
    let liveFlag = true
    void Promise.all(keys.map(getBlob)).then((list) => liveFlag && setImages(list.filter((v): v is string => !!v)))
    return () => {
      liveFlag = false
    }
  }, [keys])

  if (content.kind === 'plan' && content.plan) {
    return (
      <div className="mst-plan-table">
        {content.plan.slice(0, 7).map((d) => (
          <div className="mst-plan-row" key={d.day}>
            <b>{d.day}</b>
            <span className="mst-plan__fmt">{d.format}</span>
            <span className="mst-plan__idea"><b>{d.idea}</b> — {d.hook}</span>
          </div>
        ))}
        <p className="mst-note">{t('mk.gen.planMore', { n: content.plan.length })}</p>
      </div>
    )
  }

  return (
    <>
      {content.script && (
        <p className="mst-meta-line"><b>{t('mk.lib.hook')}:</b> {content.script.hook} · <b>{t('mk.lib.music')}:</b> {content.script.music}</p>
      )}
      {images.length > 0 ? (
        <div className="mst-results">
          {images.map((img, i) => (
            <div className="mst-result" key={i}>
              <img src={img} alt="" />
            </div>
          ))}
        </div>
      ) : content.kind === 'storyboard' ? (
        <p className="mst-note">{t('mk.gen.scriptOnly')}</p>
      ) : null}
    </>
  )
}
