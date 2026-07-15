/**
 * Editable Garment Foundation + AI Garment Designer (Milestones 7–8).
 *
 * One editor, one garment, one history. Manual edits (visibility, lock, reorder, rename) and AI
 * edits (the prompt panel) both append to the SAME undoable revision timeline — AI is just another
 * editing tool and can never destroy manual work. No AI model is connected; the AI edits run
 * through a deterministic placeholder that returns an editable garment, never an image.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useT } from '@/i18n'
import { useToast } from '../../components/ui/Toast'
import { useAuth } from '../../auth/auth'
import { defaultCapabilities, type EditableGarment, type GarmentRegion, type GarmentViewId } from '../../garment-model/editableGarment'
import type { ShapeRole } from '../../garment-model/garmentStyle'
import { getRegion, moveRegion, rename, setRegionColor, toggleLocked, toggleVisible } from '../../garment-model/regionTree'
import { addRootRegion, mapRegionShapes, removeRegions } from '../../garment-model/regionEdit'
import { translateD } from '../../garment-model/pathTransform'
import { loadReferenceGarment, FUTURE_PIPELINE_STAGES } from '../../garment-model/garmentGenerator'
import { saveHistory } from '../../garment-model/garmentDocumentStore'
import { isEmptyGarment, generateGarment, isLiveAi, GENERATION_PHASES } from '../../garment-model/garmentGeneration'
import { buildFromTemplate } from '../../garment-model/garmentFactory'
import { getGarment, toggleFavorite, updateGarmentOrigin, type GarmentOrigin, type GarmentSummary } from '../../garment-model/garmentLibrary'
import { listAccessories, type Accessory } from '../../accessories/accessoryClient'
import { exportGarmentFlatPng, exportGarmentThreados } from '../../garment-model/garmentExport'
import { useGarmentHistory } from './useGarmentHistory'
import { GarmentHeader } from './GarmentHeader'
import { GenerationExperience } from './GenerationExperience'
import { DrawMode } from './DrawMode'
import { GarmentCreateMethods } from './GarmentCreateMethods'
import { EditableGarmentCanvas } from './EditableGarmentCanvas'
import { RegionTreePanel } from './RegionTreePanel'
import { RegionInspector } from './RegionInspector'
import { AiPanel } from './AiPanel'
import './garment-lab.css'

function savedAgo(ms: number, t: (key: string, vars?: Record<string, string | number>) => string): string {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000))
  if (s < 5) return t('labMain.savedJustNow')
  if (s < 60) return t('labMain.savedSecondsAgo', { s })
  const m = Math.floor(s / 60)
  if (m < 60) return t('labMain.savedMinutesAgo', { m })
  return t('labMain.savedAt', { time: new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) })
}

type RightTab = 'ai' | 'region'

const ZOOM_MIN = 0.4
const ZOOM_MAX = 5
const ZOOM_STEP = 1.2
const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z))

export function GarmentLab() {
  const navigate = useNavigate()
  const t = useT()
  const toast = useToast()
  const { user } = useAuth()
  const { garmentId = '' } = useParams()

  // Never open the editor for a garment that isn't in the user's collection — return to Garments.
  useEffect(() => {
    if (user?.id && garmentId && !getGarment(user.id, garmentId)) navigate('/garments', { replace: true })
  }, [user?.id, garmentId, navigate])

  // Fallback only fires if a real history is somehow missing; key it to the route id so it can
  // never overwrite the shared reference garment (the redirect above handles unknown garments).
  const hist = useGarmentHistory(garmentId, () => ({ ...loadReferenceGarment(), id: garmentId || 'reference-bomber' }), user?.id)
  const garment = hist.garment

  const [view, setView] = useState<GarmentViewId>('front')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [rightTab, setRightTab] = useState<RightTab>('ai')
  const [summary, setSummary] = useState<GarmentSummary | undefined>(undefined)
  const [savedAt, setSavedAt] = useState(() => Date.now())
  const [mode, setMode] = useState<'edit' | 'draw'>('edit')
  const [genPrompt, setGenPrompt] = useState<string | null>(null)
  const [accessories, setAccessories] = useState<Accessory[]>([])
  const [zoom, setZoom] = useState(1)
  const scrollRef = useRef<HTMLDivElement>(null)
  const drawCount = useRef(0)
  const empty = isEmptyGarment(garment)
  // The current view's viewBox drives the canvas aspect ratio, so height-based sizing (which fits the
  // portrait flat to the stage at 100%) can derive the width even for non-default proportions.
  const viewBox = garment.views.find((v) => v.id === view)?.viewBox ?? { w: 400, h: 560 }

  // Shared accessory library — the same admin-curated accessories as the Design Studio.
  useEffect(() => {
    void listAccessories().then(setAccessories)
  }, [])

  // Track collection metadata (origin badge, favorite) + last-saved stamp.
  useEffect(() => {
    if (user?.id && garmentId) setSummary(getGarment(user.id, garmentId))
  }, [user?.id, garmentId])
  useEffect(() => {
    // Only stamp "saved" when the write actually landed — see useGarmentHistory.saveOk.
    if (hist.saveOk) setSavedAt(Date.now())
  }, [hist.history, hist.saveOk])

  const refreshSummary = useCallback(() => {
    if (user?.id && garmentId) setSummary(getGarment(user.id, garmentId))
  }, [user?.id, garmentId])

  // Replace the whole garment (generation / import), keeping the collection id + created stamp so
  // history and the card stay keyed correctly. Updates the origin badge (blank → ai/upload).
  const replaceGarment = useCallback(
    (next: EditableGarment, label: string, origin: GarmentOrigin) => {
      const keyed: EditableGarment = { ...next, id: garment.id, createdAt: garment.createdAt }
      hist.commitManual(keyed, label)
      if (user?.id && garmentId) {
        updateGarmentOrigin(user.id, garmentId, origin)
        refreshSummary()
      }
    },
    [garment.id, garment.createdAt, hist, user?.id, garmentId, refreshSummary],
  )

  const handleGenerated = useCallback(
    (g: EditableGarment) => {
      replaceGarment(g, t('labMain.revGeneratedAi'), 'ai')
      setGenPrompt(null)
      setSelectedId(null)
      toast(t('labMain.toastGenerated'), 'success')
    },
    [replaceGarment, toast, t],
  )

  const handleTemplate = useCallback(
    (templateId: string) => {
      const { garment, name } = buildFromTemplate(templateId)
      replaceGarment({ ...garment, name }, t('labMain.revStartedFrom', { name }), 'blank')
      setSelectedId(null)
      toast(t('labMain.toastTemplateStarted', { name }), 'success')
    },
    [replaceGarment, toast, t],
  )

  // Draw Garment: each stroke becomes a new editable region (front/back per the current view).
  const addDrawnRegion = useCallback(
    (d: string, role: ShapeRole) => {
      drawCount.current += 1
      const n = drawCount.current
      const region: GarmentRegion = {
        id: `draw-${Date.now().toString(36)}-${n}`,
        name: t('labMain.regionDrawn', { n }),
        type: 'panel',
        children: [],
        shapes: [{ view, d, role }],
        visible: true,
        locked: false,
        capabilities: defaultCapabilities('panel'),
      }
      hist.commitManual(addRootRegion(garment, region), t('labMain.revDrew', { name: region.name }))
    },
    [garment, view, hist, t],
  )

  // Drag-to-move a region on the canvas: translate all its shapes (both views) and commit once.
  const moveRegionBy = useCallback(
    (id: string, dx: number, dy: number) => {
      const res = mapRegionShapes(garment, id, (s) => ({ ...s, d: translateD(s.d, dx, dy) }))
      if (res.changed) hist.commitManual(res.garment, t('labMain.revMoved', { name: getRegion(garment, id)?.name ?? t('labMain.regionFallback') }))
    },
    [garment, hist, t],
  )

  const nameOf = (id: string) => getRegion(garment, id)?.name ?? t('labMain.regionFallback')

  const select = useCallback((id: string | null) => {
    setSelectedId(id)
    if (id) setRightTab('region')
  }, [])

  // Delete a region (button + keyboard). Removes it and its children, commits, clears selection.
  const deleteRegion = useCallback(
    (id: string) => {
      const name = nameOf(id)
      const res = removeRegions(garment, new Set([id]))
      if (res.removed.length === 0) return
      hist.commitManual(res.garment, t('labMain.revDeleted', { name }))
      setSelectedId((cur) => (cur && res.removed.includes(cur) ? null : cur))
      toast(t('labMain.toastRegionDeleted', { name }), 'default')
    },
    // nameOf reads the current garment via closure; garment is in deps.
    [garment, hist, toast, t], // eslint-disable-line react-hooks/exhaustive-deps
  )

  // Keyboard undo/redo — ignored while typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return
      const t = e.target as HTMLElement
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
      e.preventDefault()
      if (e.shiftKey) hist.redo()
      else hist.undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // undo/redo are stable useCallbacks — depend on them, not the whole (per-render) hist object.
  }, [hist.undo, hist.redo])

  // Delete / Backspace removes the selected region (ignored while typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      const el = e.target as HTMLElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      if (!selectedId) return
      e.preventDefault()
      deleteRegion(selectedId)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId, deleteRegion])

  // ---- Canvas zoom & pan ----
  // Zoom grows the canvas via a CSS var; the scroll container then pans natively. The canvas'
  // client→viewBox math reads getBoundingClientRect (which reflects the scaled size), so selection
  // and drag stay pixel-correct at any zoom without touching that code. Zoom is centre-anchored
  // (the scroll position is left untouched) — simple and consistent across buttons, keys and wheel.
  const zoomBy = useCallback((factor: number) => setZoom((z) => clampZoom(z * factor)), [])
  const resetZoom = useCallback(() => setZoom(1), [])

  // Only mount the zoom handlers when the zoomable edit canvas is actually on screen — never in Draw
  // mode or the empty Create screen (where the canvas is absent), so we don't hijack the browser's
  // own zoom keys or silently change a hidden zoom the user can't see.
  const canvasVisible = mode === 'edit' && !empty

  // Ctrl/⌘ + wheel (and trackpad pinch, which arrives as ctrl+wheel) zooms; a plain wheel pans
  // natively. Attached non-passively so we can preventDefault the browser's page zoom.
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !canvasVisible) return
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      e.preventDefault()
      zoomBy(e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomBy, canvasVisible])

  // ⌘/Ctrl +, −, 0 — the universal zoom shortcuts. Only while the edit canvas is visible, and never
  // while typing in a field.
  useEffect(() => {
    if (!canvasVisible) return
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      const el = e.target as HTMLElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      if (e.key === '=' || e.key === '+') {
        e.preventDefault()
        zoomBy(ZOOM_STEP)
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault()
        zoomBy(1 / ZOOM_STEP)
      } else if (e.key === '0') {
        e.preventDefault()
        resetZoom()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoomBy, resetZoom, canvasVisible])

  const handleApply = useCallback(
    async (prompt: string) => {
      const result = await hist.applyAi(prompt)
      if (!result.understood) {
        toast(result.summary[0], 'info')
      } else if (result.changedRegionIds.length > 0) {
        // Select a changed region that still exists (removals leave no region to select).
        const stillThere = result.changedRegionIds.find((id) => result.garment.regions[id])
        setSelectedId(stillThere ?? null)
        setRightTab('ai')
        toast(t('labMain.toastAiApplied'), 'success')
      } else {
        toast(result.summary[0], 'info')
      }
      return result
    },
    [hist.applyAi, toast, t],
  )

  const revNumber = hist.history.currentIndex + 1
  const revTotal = hist.history.revisions.length

  const handleRename = useCallback(
    (name: string) => {
      const clean = name.trim()
      if (!clean || clean === garment.name) return
      // Rename in place. The header shows garment.name (immediately correct) and the persist effect
      // syncs the collection card via touchGarment. Origin/favorite (the only fields `summary` feeds
      // the header) are unchanged by a rename, so no summary refresh is needed here — and refreshing
      // now would race the not-yet-run persist effect and read stale storage.
      hist.replaceCurrent({ ...garment, name: clean })
    },
    [garment, hist],
  )

  const handleFavorite = useCallback(() => {
    if (!user?.id || !garmentId) return
    toggleFavorite(user.id, garmentId)
    refreshSummary()
  }, [user?.id, garmentId, refreshSummary])

  const openDesignStudio = useCallback(() => {
    navigate(`/studio?garment=${encodeURIComponent(garmentId)}&name=${encodeURIComponent(garment.name)}`)
  }, [navigate, garmentId, garment.name])

  return (
    // `suite` brings the --s-* design tokens + theme into this full-screen route (like the Design
    // Studio's `suite studio` root), so the editor matches the loom studios design language.
    <div className="suite eg-lab">
      <GarmentHeader
        name={garment.name}
        category={garment.category}
        regionCount={Object.keys(garment.regions).length}
        isAi={summary?.origin === 'ai'}
        isFavorite={!!summary?.favorite}
        savedLabel={hist.saveOk ? savedAgo(savedAt, t) : t('labMain.saveFailed')}
        canUndo={hist.canUndo}
        canRedo={hist.canRedo}
        rev={`${revNumber}/${revTotal}`}
        views={garment.views}
        view={view}
        onBack={() => navigate('/garments')}
        onRename={handleRename}
        onToggleFavorite={handleFavorite}
        onSave={() => {
          // Save reports the REAL storage outcome, including quota pruning.
          const r = saveHistory(hist.history)
          if (!r.ok) toast(t('labMain.toastSaveFull'), 'info')
          else if (r.pruned) toast(t('labMain.toastSavePruned'), 'info')
          else toast(t('labMain.toastSaved'), 'success')
        }}
        onUndo={hist.undo}
        onRedo={hist.redo}
        onSetView={(id) => setView(id as GarmentViewId)}
        onOpenDesignStudio={openDesignStudio}
        onExportPng={() => {
          // Export what the user is looking at — the Back tab exports the back view.
          const toExport = view === 'back' ? { ...garment, views: [...garment.views].reverse() } : garment
          void exportGarmentFlatPng(toExport)
            .then(() => toast(t('labMain.toastFlatExported', { view: t(view === 'back' ? 'labMain.viewBack' : 'labMain.viewFront') }), 'success'))
            .catch(() => toast(t('labMain.toastFlatFailed'), 'info'))
        }}
        onExportThreados={() => {
          try {
            exportGarmentThreados(garment)
            toast(t('labMain.toastThreadosExported'), 'success')
          } catch {
            toast(t('labMain.toastThreadosFailed'), 'info')
          }
        }}
      />

      <div className="eg-lab__pipeline" aria-label={t('labMain.pipelineAria')}>
        {FUTURE_PIPELINE_STAGES.map((stage, i) => (
          <span key={stage} className={`eg-stage${i === 3 ? ' is-current' : ''}`}>
            {stage}
            {i < FUTURE_PIPELINE_STAGES.length - 1 && <em aria-hidden="true">→</em>}
          </span>
        ))}
        <span className="eg-stage__note">{t('labMain.pipelineNote')}</span>
      </div>

      <div className="eg-lab__body eg-lab__body--m8">
        <RegionTreePanel
          garment={garment}
          selectedId={selectedId}
          onSelect={select}
          onHighlight={setHighlightId}
          onToggleVisible={(id) => hist.commitManual(toggleVisible(garment, id), t(getRegion(garment, id)?.visible ? 'labMain.revHid' : 'labMain.revShowed', { name: nameOf(id) }))}
          onToggleLocked={(id) => hist.commitManual(toggleLocked(garment, id), t(getRegion(garment, id)?.locked ? 'labMain.revUnlocked' : 'labMain.revLocked', { name: nameOf(id) }))}
          onMove={(id, dir) => {
            // moveRegion returns the SAME garment at the ends — never commit a no-op revision.
            const next = moveRegion(garment, id, dir)
            if (next !== garment) hist.commitManual(next, t('labMain.revReordered', { name: nameOf(id) }))
          }}
          onRename={(id, name) => hist.replaceCurrent(rename(garment, id, name))}
          accessories={accessories}
          onOpenAccessory={openDesignStudio}
        />

        <main className="eg-stage-wrap">
          {mode === 'draw' ? (
            <DrawMode garment={garment} view={view} onCommit={addDrawnRegion} onExit={() => setMode('edit')} />
          ) : empty ? (
            <GarmentCreateMethods onGenerate={(p) => setGenPrompt(p)} onDraw={() => setMode('draw')} onTemplate={handleTemplate} />
          ) : (
            <>
              {/* The scroll layer: zoom grows the canvas via --eg-zoom, panning is native scroll. */}
              <div
                className="eg-scroll"
                ref={scrollRef}
                style={{ '--eg-zoom': zoom, '--eg-aspect': `${viewBox.w} / ${viewBox.h}` } as CSSProperties}
              >
                <EditableGarmentCanvas
                  garment={garment}
                  view={view}
                  selectedId={selectedId}
                  highlightId={highlightId}
                  onSelect={select}
                  onHighlight={setHighlightId}
                  onMoveRegion={moveRegionBy}
                />
              </div>
              {/* Draw ON the existing flat: pen / line / curve / oval, each stroke a new editable region.
                  Works with a mouse on desktop and a finger or Apple Pencil on iPad. */}
              <button type="button" className="eg-draw-toggle" onClick={() => setMode('draw')} title={t('labMain.drawToggleTitle')}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
                {t('labMain.drawToggle')}
              </button>
              {/* Zoom controls float over the stage (outside the scroller, so they never pan away). */}
              <div className="eg-zoom" role="group" aria-label={t('labMain.zoomAria')}>
                <button type="button" className="eg-zoom__btn" onClick={() => zoomBy(1 / ZOOM_STEP)} disabled={zoom <= ZOOM_MIN + 0.001} aria-label={t('labMain.zoomOut')} title={t('labMain.zoomOut')}>
                  −
                </button>
                <button type="button" className="eg-zoom__val" onClick={resetZoom} title={t('labMain.zoomReset')} aria-label={t('labMain.zoomReset')}>
                  {Math.round(zoom * 100)}%
                </button>
                <button type="button" className="eg-zoom__btn" onClick={() => zoomBy(ZOOM_STEP)} disabled={zoom >= ZOOM_MAX - 0.001} aria-label={t('labMain.zoomIn')} title={t('labMain.zoomIn')}>
                  +
                </button>
              </div>
            </>
          )}
        </main>

        <div className="eg-right">
          <div className="eg-right__tabs" role="tablist" aria-label={t('labMain.panelAria')}>
            <button type="button" role="tab" aria-selected={rightTab === 'ai'} className={`eg-right__tab${rightTab === 'ai' ? ' is-active' : ''}`} onClick={() => setRightTab('ai')}>
              {t('labMain.tabAiDesigner')}
            </button>
            <button type="button" role="tab" aria-selected={rightTab === 'region'} className={`eg-right__tab${rightTab === 'region' ? ' is-active' : ''}`} onClick={() => setRightTab('region')}>
              {t('labMain.tabRegion')}
            </button>
          </div>
          {rightTab === 'ai' ? (
            <AiPanel history={hist.history} onApply={handleApply} onRestore={hist.restore} />
          ) : (
            <RegionInspector
              garment={garment}
              selectedId={selectedId}
              onRename={(id, name) => hist.replaceCurrent(rename(garment, id, name))}
              onToggleVisible={(id) => hist.commitManual(toggleVisible(garment, id), t(getRegion(garment, id)?.visible ? 'labMain.revHid' : 'labMain.revShowed', { name: nameOf(id) }))}
              onToggleLocked={(id) => hist.commitManual(toggleLocked(garment, id), t(getRegion(garment, id)?.locked ? 'labMain.revUnlocked' : 'labMain.revLocked', { name: nameOf(id) }))}
              onSetColor={(id, hex) => hist.commitManual(setRegionColor(garment, id, hex), hex ? t('labMain.revColoured', { name: nameOf(id) }) : t('labMain.revResetColour', { name: nameOf(id) }))}
              onDelete={deleteRegion}
            />
          )}
        </div>
      </div>

      {genPrompt !== null && (
        <GenerationExperience
          eyebrow={isLiveAi() ? t('labMain.genEyebrowLive') : t('labMain.genEyebrowLocal')}
          title={t('labMain.genTitle')}
          subtitle={`“${genPrompt}”`}
          phases={GENERATION_PHASES}
          etaLabel={isLiveAi() ? t('labMain.genEtaLive') : t('labMain.genEtaLocal')}
          minRevealMs={isLiveAi() ? 0 : 2800}
          stepMs={isLiveAi() ? 3200 : 300}
          run={async () => ({ garment: (await generateGarment(genPrompt)).garment })}
          onComplete={handleGenerated}
          onCancel={() => setGenPrompt(null)}
        />
      )}
    </div>
  )
}
