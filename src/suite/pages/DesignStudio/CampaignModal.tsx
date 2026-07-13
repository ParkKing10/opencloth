import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IcoSparkle } from '../../components/ui/Icons'
import { useToast } from '../../components/ui/Toast'
import { downloadBlob, slugify } from '../../lib/download'
import { captureDesignPng } from '../../export/real/capture'
import { blobToDataUrl } from '../../assets/assetThumb'
import { putAsset, type Asset } from '../../assets/assetStore'
import { saveGeneratedAsset } from '../../assets/saveGenerated'
import { generateImages, hasImageAi } from '../../ai/imageProvider'
import {
  CAMPAIGN_MODELS,
  CAMPAIGN_POSES,
  CAMPAIGN_STYLES,
  CAMPAIGN_BACKGROUNDS,
  CAMPAIGN_LIGHTING,
  CAMPAIGN_QUALITIES,
  DEFAULT_CAMPAIGN,
  campaignPrompt,
  campaignImageParams,
  type CampaignSelection,
} from '../../ai/campaignPrompt'
import './campaign.css'

type Props = {
  open: boolean
  garmentName: string
  userId: string | undefined
  onClose: () => void
}

type Shot = { id: string; dataUrl: string }

/**
 * Campaign Generator — turn the finished garment into on-model campaign photography without leaving
 * the Studio. Step 1 auto-renders the garment (no manual export). Step 2 collects shoot preferences.
 * Step 3 sends the render + a hidden garment-preserving prompt to Runware. Honest: with no key it
 * explains what to connect instead of faking a person.
 */
export function CampaignModal({ open, garmentName, userId, onClose }: Props) {
  const toast = useToast()
  const [garmentPng, setGarmentPng] = useState<string | null>(null)
  const [captureError, setCaptureError] = useState<string | null>(null)
  const [sel, setSel] = useState<CampaignSelection>(DEFAULT_CAMPAIGN)
  // Number of in-flight generations. Multiple can run at once — clicking Generate never cancels a
  // running shot, it queues another, and each shows its own spinner tile on the right.
  const [pending, setPending] = useState(0)
  const generating = pending > 0
  const [shots, setShots] = useState<Shot[]>([])
  const [favs, setFavs] = useState<Set<string>>(new Set())
  const [saved, setSaved] = useState<Set<string>>(new Set())
  // Signature of the shoot settings used for the most recent generate — lets the button honestly show
  // whether the user has changed anything since, so a click always reflects the current selections.
  const [lastSig, setLastSig] = useState<string | null>(null)
  const pendingRef = useRef<Set<AbortController>>(new Set())
  const live = hasImageAi()

  // Auto-prepare the garment render the moment the modal opens — the user never exports manually.
  useEffect(() => {
    if (!open) return
    setShots([])
    setCaptureError(null)
    setGarmentPng(null)
    let cancelled = false
    captureDesignPng({ scope: 'garment', background: 'white', scale: 2 })
      .then((blob) => blobToDataUrl(blob))
      .then((url) => {
        if (!cancelled) setGarmentPng(url)
      })
      .catch((e) => {
        if (!cancelled) setCaptureError(e instanceof Error ? e.message : 'Could not render the garment.')
      })
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      pendingRef.current.forEach((c) => c.abort())
      pendingRef.current.clear()
      setPending(0)
      return
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Generate ONE campaign image, appending it to the set. Runs concurrently: a new call never cancels
  // an in-flight one — it adds another spinner tile on the right while the button stays live.
  const runOne = useCallback(async () => {
    if (!garmentPng) return
    if (!hasImageAi()) {
      toast('Connect your Runware API key in Settings → AI to generate campaign photos.', 'info')
      return
    }
    const ctrl = new AbortController()
    pendingRef.current.add(ctrl)
    setPending((n) => n + 1)
    const signal = AbortSignal.any([ctrl.signal, AbortSignal.timeout(120_000)])
    const sig = JSON.stringify(sel)
    try {
      const params = campaignImageParams(sel)
      // A Transparent backdrop means a true cut-out — run Runware's background remover on the result.
      const urls = await generateImages(campaignPrompt(sel), { references: [garmentPng], n: 1, ...params, removeBackground: sel.background === 'Transparent', signal })
      if (ctrl.signal.aborted) return
      if (urls[0]) {
        const shot: Shot = { id: `sh-${crypto.randomUUID()}`, dataUrl: urls[0] }
        setShots((prev) => [...prev, shot])
        setLastSig(sig) // remember what settings this shot used

        // Auto-save every campaign photo to the Asset Library so nothing is lost.
        if (userId) {
          void saveGeneratedAsset({ userId, dataUrl: urls[0], name: `Campaign — ${garmentName}`, category: 'campaign' }).then((a) => {
            if (a) setSaved((s) => new Set(s).add(shot.id))
          })
        }
      }
    } catch (err) {
      if (!ctrl.signal.aborted) {
        const msg = err instanceof DOMException && err.name === 'TimeoutError' ? 'Runware took too long — try again in a moment.' : err instanceof Error ? err.message : 'Campaign generation failed.'
        toast(msg, 'info')
      }
    } finally {
      pendingRef.current.delete(ctrl)
      setPending((n) => Math.max(0, n - 1))
    }
  }, [garmentPng, sel, toast, userId, garmentName])

  if (!open) return null

  const set = (patch: Partial<CampaignSelection>) => setSel((s) => ({ ...s, ...patch }))
  const toggleFav = (id: string) => setFavs((f) => { const n = new Set(f); n.has(id) ? n.delete(id) : n.add(id); return n })

  const download = async (shot: Shot, i: number) => {
    const blob = await fetch(shot.dataUrl).then((r) => r.blob())
    downloadBlob(blob, `${slugify(garmentName) || 'campaign'}-${i + 1}.png`)
    toast('Campaign image downloaded.', 'success')
  }

  const saveToLibrary = async (shot: Shot, i: number) => {
    if (saved.has(shot.id)) return // already auto-saved on generation
    if (!userId) {
      toast('Sign in to save to your Asset Library.', 'info')
      return
    }
    try {
      const blob = await fetch(shot.dataUrl).then((r) => r.blob())
      const asset: Asset = {
        id: crypto.randomUUID(),
        userId,
        filename: `Campaign — ${garmentName} ${i + 1}.png`,
        type: 'image/png',
        kind: 'raster',
        category: 'campaign',
        width: 1024,
        height: 1536,
        size: blob.size,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
        favorite: favs.has(shot.id),
        blob,
        thumb: blob,
      }
      await putAsset(asset)
      setSaved((s) => new Set(s).add(shot.id))
      toast('Saved to Asset Library → Campaign Images.', 'success')
    } catch {
      toast('Could not save that image.', 'info')
    }
  }

  const model = CAMPAIGN_MODELS.find((m) => m.id === sel.modelId)
  // Have the shoot settings changed since the last generated shot? Drives honest button copy.
  const settingsChanged = lastSig !== null && lastSig !== JSON.stringify(sel)

  return createPortal(
    <div className="suite">
      <div className="cg-scrim" onClick={onClose} />
      <div className="cg" role="dialog" aria-modal="true" aria-labelledby="cg-title">
        <header className="cg__head">
          <span className="cg__title" id="cg-title"><IcoSparkle width="18" height="18" /> Campaign Generator</span>
          <button type="button" className="cg__x" aria-label="Close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </header>

        <div className="cg__body">
          {/* Left: garment + preferences */}
          <div className="cg__setup">
            <div className="cg__garment">
              <span className="cg__label">Your garment</span>
              <div className="cg__garment-frame">
                {garmentPng ? <img src={garmentPng} alt={garmentName} /> : captureError ? <span className="cg__cap-err">{captureError}</span> : <span className="cg-spin" />}
              </div>
              <span className="cg__garment-note">Rendered automatically — colours, prints and placement preserved.</span>
            </div>

            <ChoiceGrid label="Model" options={CAMPAIGN_MODELS.map((m) => ({ id: m.id, label: m.label }))} value={sel.modelId} onPick={(id) => set({ modelId: id })} cols={3} />
            <ChoiceRow label="Pose" options={CAMPAIGN_POSES} value={sel.pose} onPick={(v) => set({ pose: v })} />
            <ChoiceRow label="Style" options={CAMPAIGN_STYLES} value={sel.style} onPick={(v) => set({ style: v })} />
            <ChoiceRow label="Background" options={CAMPAIGN_BACKGROUNDS} value={sel.background} onPick={(v) => set({ background: v })} />
            <ChoiceRow label="Lighting" options={CAMPAIGN_LIGHTING} value={sel.lighting} onPick={(v) => set({ lighting: v })} />
            <ChoiceRow label="Quality" options={CAMPAIGN_QUALITIES.map((q) => q.label)} value={CAMPAIGN_QUALITIES.find((q) => q.id === sel.quality)?.label ?? 'High'} onPick={(v) => set({ quality: (CAMPAIGN_QUALITIES.find((q) => q.label === v)?.id ?? 'high') })} />

            {/* Always clickable — the spinner shows in the results area on the right, never on the button,
                so you can queue more shots without waiting. */}
            <button type="button" className="cg__go" onClick={() => runOne()} disabled={!garmentPng}>
              {shots.length === 0
                ? `Generate image${model ? ` · ${model.label}` : ''}`
                : settingsChanged
                  ? `Generate with new settings${model ? ` · ${model.label}` : ''}`
                  : 'Generate another'}
            </button>
            {!live && <p className="cg__gate">Campaign photos need a real image model. Add your Runware API key in Settings → AI — there is no on-device stand-in for a photoreal person, and THREADOS won’t fake one.</p>}
          </div>

          {/* Right: results — one image, then a "+" tile to pull more */}
          <div className="cg__results">
            {shots.length === 0 && !generating && (
              <div className="cg__empty">
                <IcoSparkle width="22" height="22" />
                <p>Pick a model and shoot, then generate a campaign-quality photo of this exact garment on a person. Add more with +.</p>
              </div>
            )}
            {(shots.length > 0 || generating) && (
              <div className="cg__grid">
                {shots.map((shot, i) => (
                  <figure key={shot.id} className="cg-shot">
                    <img src={shot.dataUrl} alt={`Campaign ${i + 1}`} />
                    <button type="button" className={`cg-shot__fav${favs.has(shot.id) ? ' is-on' : ''}`} aria-label="Favorite" onClick={() => toggleFav(shot.id)}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill={favs.has(shot.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8"><path d="M12 20s-7-4.4-9.2-8.3C1 8.5 2.6 5 6 5c2 0 3.2 1.2 4 2.3C10.8 6.2 12 5 14 5c3.4 0 5 3.5 3.2 6.7C19 15.6 12 20 12 20Z" /></svg>
                    </button>
                    <figcaption className="cg-shot__bar">
                      <button type="button" onClick={() => download(shot, i)}>Download</button>
                      <button type="button" className={saved.has(shot.id) ? 'is-saved' : ''} onClick={() => saveToLibrary(shot, i)}>{saved.has(shot.id) ? 'Saved ✓' : 'Save to Library'}</button>
                    </figcaption>
                  </figure>
                ))}
                {/* One spinner tile per in-flight generation — the loading lives here, not on the button. */}
                {Array.from({ length: pending }).map((_, i) => (
                  <div key={`loading-${i}`} className="cg-shot cg-shot--loading"><span className="cg-spin" /></div>
                ))}
                {/* The "+" tile is always available (even while generating) so you can queue more. */}
                {shots.length > 0 && (
                  <button type="button" className="cg-shot cg-add" onClick={() => runOne()} title={settingsChanged ? 'Generate with your new settings' : 'Generate one more'} aria-label={settingsChanged ? 'Generate with new settings' : 'Generate one more'}>
                    <span className="cg-add__plus">+</span>
                    <span className="cg-add__label">{settingsChanged ? 'New settings' : 'One more'}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function ChoiceRow({ label, options, value, onPick }: { label: string; options: readonly string[]; value: string; onPick: (v: string) => void }) {
  return (
    <div className="cg__field">
      <span className="cg__label">{label}</span>
      <div className="cg__chips">
        {options.map((o) => (
          <button key={o} type="button" className={`cg__chip${value === o ? ' is-active' : ''}`} onClick={() => onPick(o)}>{o}</button>
        ))}
      </div>
    </div>
  )
}

function ChoiceGrid({ label, options, value, onPick, cols }: { label: string; options: { id: string; label: string }[]; value: string; onPick: (id: string) => void; cols: number }) {
  return (
    <div className="cg__field">
      <span className="cg__label">{label}</span>
      <div className="cg__models" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {options.map((o) => (
          <button key={o.id} type="button" className={`cg__model${value === o.id ? ' is-active' : ''}`} onClick={() => onPick(o.id)}>{o.label}</button>
        ))}
      </div>
    </div>
  )
}
