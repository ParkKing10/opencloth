import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useT } from '@/i18n'
import { useToast } from '../../components/ui/Toast'
import { useAuth } from '../../auth/auth'
import { useMarketing } from '../../marketing/useMarketing'
import { delBlobs, getBlob, type MkContent } from '../../marketing/marketingStore'
import { renderStoryboardVideo, storyboardDuration } from '../../marketing/storyboardVideo'
import { generateBeatVideos, publishKeyframe, type BeatResult } from '../../marketing/higgsfield'
import { hasHiggsfieldKey } from '../../garment-model/aiSettings'
import { downloadBlob, slugify } from '../../lib/download'

/* Generated Content — everything the studio creates lands here, ready to reuse:
   photo shoots, video storyboards (script + keyframes) and content plans. */

const FILTERS = ['all', 'photo', 'storyboard', 'plan'] as const

/** Resolve the first image of a content item from IndexedDB for the card cover. */
function useCover(item: MkContent): string | null {
  const [cover, setCover] = useState<string | null>(null)
  const key = item.imageKeys[0] ?? item.script?.scenes.find((s) => s.imageKey)?.imageKey ?? null
  useEffect(() => {
    let live = true
    if (!key) return
    void getBlob(key).then((v) => live && setCover(v))
    return () => {
      live = false
    }
  }, [key])
  return cover
}

function ContentCard({ item, onOpen }: { item: MkContent; onOpen: () => void }) {
  const t = useT()
  const cover = useCover(item)
  return (
    <button type="button" className="mst-item" onClick={onOpen}>
      <span className="mst-item__media">
        {cover ? <img src={cover} alt={item.title} loading="lazy" /> : <span aria-hidden="true">{item.kind === 'plan' ? '📅' : item.kind === 'storyboard' ? '🎬' : '📷'}</span>}
        <span className="mst-item__kind">{t(`mk.kind.${item.kind}`)}</span>
      </span>
      <span className="mst-item__body">
        <b>{item.title}</b>
        <small>{new Date(item.createdAt).toLocaleDateString()}</small>
      </span>
    </button>
  )
}

function SceneFrame({ imageKey, index }: { imageKey?: string; index: number }) {
  const [img, setImg] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    if (!imageKey) return
    void getBlob(imageKey).then((v) => live && setImg(v))
    return () => {
      live = false
    }
  }, [imageKey])
  return <span className="mst-scene__frame">{img ? <img src={img} alt="" /> : index + 1}</span>
}

/** Turn the storyboard into an actual video. Two paths:
    — Higgsfield (real AI video per beat, needs the key from Settings → AI) — THE way.
    — the local Ken-Burns render as a fast free preview. */
function StoryboardVideoBlock({ item }: { item: MkContent }) {
  const t = useT()
  const toast = useToast()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [pct, setPct] = useState<number | null>(null) // null = idle (local render)
  const [video, setVideo] = useState<{ url: string; blob: Blob; ext: string } | null>(null)
  const [hfState, setHfState] = useState<'idle' | 'publishing' | 'generating'>('idle')
  const [hfProgress, setHfProgress] = useState('')
  const [hfVideos, setHfVideos] = useState<BeatResult[] | null>(null)

  // Blob URLs die with the component.
  useEffect(() => () => {
    if (video) URL.revokeObjectURL(video.url)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const scenes = item.script?.scenes ?? []
  const seconds = Math.round(storyboardDuration(scenes.length))
  const withFrames = scenes.filter((s) => s.imageKey)

  const generateHf = async () => {
    if (hfState !== 'idle') return
    if (!hasHiggsfieldKey()) {
      navigate('/settings?section=ai')
      return
    }
    if (!user || withFrames.length === 0) {
      toast(t('mk.lib.hfNoFrames'), 'info')
      return
    }
    try {
      setHfState('publishing')
      setHfProgress(t('mk.lib.hfPublishing'))
      const beats: { imageUrl: string; prompt: string }[] = []
      for (let i = 0; i < withFrames.length; i++) {
        const s = withFrames[i]
        const dataUrl = s.imageKey ? await getBlob(s.imageKey) : null
        if (!dataUrl) continue
        const imageUrl = await publishKeyframe(user.id, `${item.id}-${i}`, dataUrl)
        beats.push({ imageUrl, prompt: `${s.camera}. ${s.action}` })
      }
      setHfState('generating')
      setHfProgress(t('mk.lib.hfGenerating', { done: 0, total: beats.length }))
      const results = await generateBeatVideos(beats, (done, total) =>
        setHfProgress(t('mk.lib.hfGenerating', { done, total })),
      )
      setHfVideos(results)
      if (results.every((r) => !r.url)) toast(t('mk.lib.hfAllFailed'), 'info')
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (msg === 'auth') toast(t('mk.lib.hfAuthFail'), 'info')
      else if (msg === 'storage') toast(t('mk.lib.hfNoStorage'), 'info')
      else toast(t('mk.lib.hfFail'), 'info')
    } finally {
      setHfState('idle')
      setHfProgress('')
    }
  }

  const downloadHf = async (url: string, i: number) => {
    try {
      const blob = await fetch(url).then((r) => r.blob())
      downloadBlob(blob, `loom-${slugify(item.title)}-beat${i + 1}.mp4`)
    } catch {
      window.open(url, '_blank') // CORS-blocked fetch → let the browser handle it
    }
  }

  const render = async () => {
    if (pct !== null || !scenes.length) return
    setPct(0)
    try {
      const frames = await Promise.all(
        scenes.map(async (s) => ({
          image: s.imageKey ? await getBlob(s.imageKey) : null,
          title: s.title,
          caption: s.caption,
        })),
      )
      const out = await renderStoryboardVideo({ scenes: frames, onProgress: setPct })
      setVideo({ url: URL.createObjectURL(out.blob), blob: out.blob, ext: out.ext })
    } catch {
      toast(t('mk.lib.renderFail'), 'info')
    } finally {
      setPct(null)
    }
  }

  return (
    <div className="mst-render">
      {/* — Higgsfield: the real thing — */}
      {hfVideos ? (
        <div className="mst-hf-grid">
          {hfVideos.map((r, i) => (
            <div className="mst-hf-beat" key={i}>
              {r.url ? (
                <>
                  <video className="mst-render__video" src={r.url} controls playsInline preload="metadata" />
                  <button type="button" className="s-btn s-btn--accent" onClick={() => void downloadHf(r.url!, i)}>
                    {t('mk.lib.downloadVideo')}
                  </button>
                </>
              ) : (
                <p className="mst-note">
                  {t('mk.lib.hfBeatFailed', { n: i + 1 })}
                  {r.error ? ` (${r.error})` : ''}
                </p>
              )}
            </div>
          ))}
          <p className="mst-note">{t('mk.lib.hfKeep')}</p>
        </div>
      ) : (
        <div className="mst-render__row">
          <button type="button" className="s-btn s-btn--accent" disabled={hfState !== 'idle'} onClick={() => void generateHf()}>
            {hfState !== 'idle'
              ? hfProgress
              : hasHiggsfieldKey()
                ? `✨ ${t('mk.lib.hfGenerate', { n: withFrames.length })}`
                : `✨ ${t('mk.lib.hfNeedsKey')}`}
          </button>
          {hfState === 'idle' && <span className="mst-note">{t('mk.lib.hfNote')}</span>}
        </div>
      )}

      {/* — local Ken-Burns preview (free, instant-ish) — */}
      {video ? (
        <>
          <video className="mst-render__video" src={video.url} controls autoPlay loop playsInline />
          <div className="mst-render__row">
            <button
              type="button"
              className="s-btn s-btn--subtle"
              onClick={() => downloadBlob(video.blob, `loom-${slugify(item.title)}.${video.ext}`)}
            >
              {t('mk.lib.downloadVideo')}
            </button>
            <span className="mst-note">{t('mk.lib.renderHint')}</span>
          </div>
        </>
      ) : (
        <div className="mst-render__row">
          <button type="button" className="s-btn s-btn--subtle" disabled={pct !== null} onClick={() => void render()}>
            {pct !== null ? t('mk.lib.rendering', { p: Math.round(pct * 100) }) : `🎬 ${t('mk.lib.renderPreview', { s: seconds })}`}
          </button>
        </div>
      )}
    </div>
  )
}

function Viewer({ item, onClose, onDelete }: { item: MkContent; onClose: () => void; onDelete: () => void }) {
  const t = useT()
  const toast = useToast()
  const [images, setImages] = useState<string[]>([])

  useEffect(() => {
    let live = true
    void Promise.all(item.imageKeys.map(getBlob)).then((list) => live && setImages(list.filter((v): v is string => !!v)))
    return () => {
      live = false
    }
  }, [item])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function copyScript() {
    if (!item.script) return
    const text = [
      `HOOK: ${item.script.hook}`,
      '',
      ...item.script.scenes.map((s, i) => `SCENE ${i + 1} — ${s.title}\nCamera: ${s.camera}\nAction: ${s.action}\nCaption: ${s.caption}`),
      '',
      `VOICEOVER: ${item.script.voiceover}`,
      `CTA: ${item.script.cta}`,
      `MUSIC: ${item.script.music}`,
    ].join('\n')
    try {
      await navigator.clipboard.writeText(text)
      toast(t('mk.lib.copied'), 'success')
    } catch {
      toast(t('mk.lib.copyFail'), 'info')
    }
  }

  async function copyPlan() {
    if (!item.plan) return
    const text = item.plan.map((d) => `Day ${d.day} · ${d.format} — ${d.idea} (Hook: ${d.hook})`).join('\n')
    try {
      await navigator.clipboard.writeText(text)
      toast(t('mk.lib.copied'), 'success')
    } catch {
      toast(t('mk.lib.copyFail'), 'info')
    }
  }

  async function download(url: string, i: number) {
    try {
      const blob = await fetch(url).then((r) => r.blob())
      downloadBlob(blob, `loom-${slugify(item.title)}-${i + 1}.jpg`)
    } catch {
      toast(t('mk.lib.copyFail'), 'info')
    }
  }

  return (
    <div className="mst-scrim" role="presentation" onClick={onClose}>
      <div className="mst-modal mst-view" role="dialog" aria-modal="true" aria-label={item.title} onClick={(e) => e.stopPropagation()}>
        <div className="mst-modal__head">
          <div>
            <h2>{item.title}</h2>
            <p>{item.prompt}</p>
          </div>
          <button type="button" className="mst-modal__x" aria-label={t('mk.close')} onClick={onClose}>×</button>
        </div>

        {item.kind === 'photo' && (
          <div className="mst-results">
            {images.map((img, i) => (
              <div className="mst-result" key={i}>
                <img src={img} alt={`${item.title} ${i + 1}`} />
                <button type="button" className="s-btn s-btn--subtle" style={{ margin: 10 }} onClick={() => void download(img, i)}>
                  {t('mk.lib.download')}
                </button>
              </div>
            ))}
            {images.length === 0 && <p className="mst-note">{t('mk.loading')}</p>}
          </div>
        )}

        {item.kind === 'storyboard' && item.script && (
          <>
            {/* The storyboard becomes a REAL 9:16 video — Ken-Burns keyframes + captions,
                rendered in the browser (realtime capture, ~duration seconds). */}
            <StoryboardVideoBlock item={item} />
            <p className="mst-meta-line"><b>{t('mk.lib.hook')}:</b> {item.script.hook}</p>
            <div>
              {item.script.scenes.map((s, i) => (
                <div className="mst-scene" key={i}>
                  <SceneFrame imageKey={s.imageKey} index={i} />
                  <div className="mst-scene__body">
                    <b>{i + 1}. {s.title}</b>
                    <p><b>{t('mk.lib.camera')}:</b> {s.camera}</p>
                    <p>{s.action}</p>
                    <span className="mst-scene__caption">„{s.caption}"</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="mst-meta-line"><b>{t('mk.lib.voiceover')}:</b> {item.script.voiceover}</p>
            <p className="mst-meta-line"><b>CTA:</b> {item.script.cta} · <b>{t('mk.lib.music')}:</b> {item.script.music}</p>
            <div className="mst-modal__foot">
              <button type="button" className="s-btn s-btn--accent" onClick={() => void copyScript()}>{t('mk.lib.copyScript')}</button>
            </div>
          </>
        )}

        {item.kind === 'plan' && item.plan && (
          <>
            <div className="mst-plan-table">
              {item.plan.map((d) => (
                <div className="mst-plan-row" key={d.day}>
                  <b>{d.day}</b>
                  <span className="mst-plan__fmt">{d.format}</span>
                  <span className="mst-plan__idea"><b>{d.idea}</b> — {d.hook}</span>
                </div>
              ))}
            </div>
            <div className="mst-modal__foot">
              <button type="button" className="s-btn s-btn--accent" onClick={() => void copyPlan()}>{t('mk.lib.copyPlan')}</button>
            </div>
          </>
        )}

        <div className="mst-modal__foot">
          <button type="button" className="mst-char__del" style={{ padding: '8px 14px' }} onClick={onDelete}>
            {t('mk.delete')}
          </button>
        </div>
      </div>
    </div>
  )
}

export function MkLibrary() {
  const t = useT()
  const { meta, update } = useMarketing()
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all')
  const [openId, setOpenId] = useState<string | null>(null)

  const shown = meta.content.filter((c) => filter === 'all' || c.kind === filter)
  const open = meta.content.find((c) => c.id === openId) ?? null

  function remove(item: MkContent) {
    if (!window.confirm(t('mk.lib.confirmDelete'))) return
    const keys = [...item.imageKeys, ...(item.script?.scenes.map((s) => s.imageKey).filter((k): k is string => !!k) ?? [])]
    void delBlobs(keys)
    update((m) => ({ ...m, content: m.content.filter((c) => c.id !== item.id) }))
    setOpenId(null)
  }

  return (
    <section className="mst-sec">
      <div className="mst-sec__head">
        <div>
          <h2>{t('mk.lib.head')}</h2>
          <p>{t('mk.lib.sub')}</p>
        </div>
      </div>

      <div className="mst-chiprow" role="group" aria-label={t('mk.lib.filterAria')}>
        {FILTERS.map((f) => (
          <button key={f} type="button" className={`mst-chip${filter === f ? ' is-on' : ''}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {t(`mk.kindFilter.${f}`)}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="mst-empty">
          <b>{t('mk.lib.emptyTitle')}</b>
          <p>{t('mk.lib.emptyBody')}</p>
        </div>
      ) : (
        <div className="mst-lib">
          {shown.map((item) => (
            <ContentCard key={item.id} item={item} onOpen={() => setOpenId(item.id)} />
          ))}
        </div>
      )}

      {open && <Viewer item={open} onClose={() => setOpenId(null)} onDelete={() => remove(open)} />}
    </section>
  )
}
