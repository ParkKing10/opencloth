/* ============================================================
   Motion editor — the AI-directed explainer builder.
   Left: scene list. Centre: live canvas preview + transport.
   Right: brand, assets, and the AI direction chat per scene.

   Two AI entry points (both via the app's OpenAI key):
   - "AI draft": one brief → the whole video as a first cut
   - per-scene chat: iterative directions ("zoom onto the chart,
     add a chip 'Live data', make the headline bigger")
   ============================================================ */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  IcoAI,
  IcoArrowRight,
  IcoBolt,
  IcoDesign,
  IcoPlus,
  IcoSparkle,
  IcoTrend,
  IcoUpload,
} from '../../components/ui/Icons'
import { useToast } from '../../components/ui/Toast'
import { downloadBlob, slugify } from '../../lib/download'
import { fmtTime, Slider } from './controls'
import { AudioPanel, WaveformStrip } from './AudioTrack'
import { directProject, draftProject, hasDirectorAi } from './engine/aiDirector'
import { applyPatch } from './engine/patch'
import { localDirect } from './engine/localDirector'
import { collectAssetIds, deleteAsset, ensureAssetsLoaded, listAssets, saveAsset, type AssetMeta } from './engine/assets'
import {
  analyzeBeats,
  AudioPlayer,
  computeWaveform,
  decodeAudioAsset,
  deleteAudioAsset,
  listAudioAssets,
  nearestBeat,
  saveAudioAsset,
  type AudioBeats,
  type AudioMeta,
} from './engine/audio'
import { EXPORT_SIZES, exportVideo } from './engine/exportVideo'
import { renderProject, sceneStarts, totalDuration } from './engine/render'
import { sanitizeProject } from './engine/sanitize'
import { fileExtFor } from './exporter'
import { pickMime } from './recorder'
import {
  defaultProject,
  defaultScene,
  type BgKey,
  type MotionAspect,
  type Project,
  type Scene,
  type SceneElement,
  type SceneType,
  type StatItem,
} from './types'

const STORE_KEY = 'loom-explainer-motion-v1'

function loadProject(): Project {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) {
      const p = sanitizeProject(JSON.parse(raw))
      if (p && p.scenes.length) return p
    }
  } catch {
    /* corrupted → fall back to the template */
  }
  return defaultProject()
}

const SCENE_META: Record<SceneType, { label: string; hint: string; icon: typeof IcoSparkle }> = {
  intro: { label: 'Intro', hint: 'Logo pop + kinetic title', icon: IcoSparkle },
  statement: { label: 'Statement', hint: 'Big message, word by word', icon: IcoDesign },
  feature: { label: 'Feature demo', hint: 'Animated app mockup + cursor', icon: IcoBolt },
  stats: { label: 'Stats', hint: 'Counting metrics', icon: IcoTrend },
  cta: { label: 'Call to action', hint: 'Closing card + button', icon: IcoArrowRight },
  custom: { label: 'AI scene', hint: 'Free composition — direct it via chat', icon: IcoAI },
}

const ACCENTS = ['#d1f94f', '#7ab8ff', '#ff7ab8', '#ffb26b', '#8f7aff']

const BG_LABELS: Record<BgKey, string> = { midnight: 'Midnight', aurora: 'Aurora', sunset: 'Sunset', mono: 'Mono' }

const safeHex = (h: string): string => (/^#[0-9a-fA-F]{6}$/.test(h) ? h : '#d1f94f')

function sceneTitle(s: Scene): string {
  switch (s.type) {
    case 'intro':
      return s.props.title
    case 'statement':
      return s.props.text
    case 'feature':
      return s.props.heading
    case 'stats':
      return s.props.heading
    case 'cta':
      return s.props.title
    case 'custom':
      return s.props.label
  }
}

function elSummary(el: SceneElement): string {
  switch (el.kind) {
    case 'text':
      return el.text
    case 'image':
      return 'uploaded image'
    case 'button':
      return el.label
    case 'chip':
      return el.label
    case 'chart':
      return el.chart === 'bars' ? 'bar chart' : 'line chart'
    case 'mockup':
      return `mock UI (${el.demo})`
    case 'shape':
      return el.shape
    case 'cursor':
      return `${el.path.length} waypoints`
  }
}

type ChatMsg = { role: 'user' | 'ai'; text: string }

export function MotionEditor({ onBusyChange }: { onBusyChange?: (busy: boolean) => void } = {}) {
  const toast = useToast()
  const [project, setProject] = useState<Project>(loadProject)
  const [selectedId, setSelectedId] = useState<string | null>(() => project.scenes[0]?.id ?? null)
  const [playing, setPlaying] = useState(false)
  const [timeSec, setTimeSec] = useState(0)
  const [addOpen, setAddOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState(0)

  // Audio state
  const [audioMeta, setAudioMeta] = useState<AudioMeta | null>(null)
  const [waveform, setWaveform] = useState<Float32Array | null>(null)
  const [beats, setBeats] = useState<AudioBeats | null>(null)
  const audioRef = useRef<AudioPlayer>(new AudioPlayer())
  const beatsRef = useRef<AudioBeats | null>(null)
  beatsRef.current = beats

  // AI state
  const [assets, setAssets] = useState<AssetMeta[]>([])
  const [briefOpen, setBriefOpen] = useState(false)
  const [brief, setBrief] = useState('')
  const [drafting, setDrafting] = useState(false)
  const [chat, setChat] = useState<Record<string, ChatMsg[]>>({})
  const [instruction, setInstruction] = useState('')
  const [directing, setDirecting] = useState(false)
  const aiAvailable = hasDirectorAi()

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const projectRef = useRef(project)
  projectRef.current = project
  const timeRef = useRef(0)
  const playingRef = useRef(false)
  const lastRef = useRef(0)
  const rafRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  // Paint bookkeeping: repaint only when something changed (or while playing), never during export.
  const dirtyRef = useRef(true)
  const exportingRef = useRef(false)
  const draggingRef = useRef(false)

  // Undo / redo history for structural + AI edits.
  const pastRef = useRef<Project[]>([])
  const futureRef = useRef<Project[]>([])
  const [hist, setHist] = useState({ undo: false, redo: false })

  // Persist the project so a reload never loses work.
  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(project))
    } catch {
      /* quota — non-fatal */
    }
    dirtyRef.current = true
  }, [project])

  // Assets: load the library once, and keep referenced images warm for the preview.
  useEffect(() => {
    void listAssets().then(setAssets)
  }, [])
  useEffect(() => {
    void ensureAssetsLoaded(collectAssetIds(project))
  }, [project])

  // Music: when the track changes, decode it, draw its waveform, detect beats, and hand the buffer
  // to the player. Heavy work stays off the render loop; nothing here blocks the UI.
  const audioId = project.audio?.assetId ?? null
  useEffect(() => {
    let alive = true
    if (!audioId) {
      audioRef.current.setBuffer(null)
      setAudioMeta(null)
      setWaveform(null)
      setBeats(null)
      return
    }
    void (async () => {
      const [metas, buf] = await Promise.all([listAudioAssets(), decodeAudioAsset(audioId)])
      if (!alive) return
      setAudioMeta(metas.find((m) => m.id === audioId) ?? null)
      if (buf) {
        audioRef.current.setBuffer(buf)
        setWaveform(computeWaveform(buf, 900))
      }
      const b = await analyzeBeats(audioId)
      if (alive) setBeats(b)
    })()
    return () => {
      alive = false
    }
  }, [audioId])

  // Keep the player's mix in sync with the audio settings.
  useEffect(() => {
    const a = project.audio
    if (a) audioRef.current.setMix({ volume: a.volume, fadeIn: a.fadeIn, fadeOut: a.fadeOut, offset: a.offset })
  }, [project.audio])

  // Stop audio if the editor unmounts mid-play.
  useEffect(() => {
    const player = audioRef.current
    return () => player.stop()
  }, [])

  // Preview loop: advances time while playing, but only PAINTS when playing or dirty —
  // and never during an export, so the recording keeps the full frame budget.
  useEffect(() => {
    const loop = (now: number) => {
      const canvas = canvasRef.current
      const shouldPaint = !exportingRef.current && (playingRef.current || dirtyRef.current)
      if (canvas && shouldPaint) {
        const p = projectRef.current
        const { w, h } = EXPORT_SIZES[p.aspect]
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w
          canvas.height = h
        }
        const total = totalDuration(p)
        if (playingRef.current) {
          timeRef.current += (now - lastRef.current) / 1000
          if (timeRef.current >= total) {
            timeRef.current = total
            playingRef.current = false
            setPlaying(false)
            audioRef.current.stop()
          }
          if (!draggingRef.current) setTimeSec(timeRef.current)
        }
        const ctx = canvas.getContext('2d')
        if (ctx) {
          renderProject(ctx, p, Math.min(timeRef.current, Math.max(0, total - 0.001)), w, h)
          dirtyRef.current = false
        }
      }
      lastRef.current = now
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const togglePlay = () => {
    if (playingRef.current) {
      playingRef.current = false
      setPlaying(false)
      audioRef.current.stop()
      return
    }
    const total = totalDuration(projectRef.current)
    if (timeRef.current >= total - 0.05) {
      timeRef.current = 0
      setTimeSec(0)
    }
    playingRef.current = true
    setPlaying(true)
    audioRef.current.start(timeRef.current, total)
  }

  const scrub = (v: number) => {
    timeRef.current = v
    setTimeSec(v)
    dirtyRef.current = true
    // Keep the music glued to the playhead while dragging.
    if (playingRef.current) audioRef.current.start(v, totalDuration(projectRef.current))
  }

  const jumpToScene = (sceneId: string) => {
    const p = projectRef.current
    const idx = p.scenes.findIndex((s) => s.id === sceneId)
    if (idx < 0) return
    timeRef.current = sceneStarts(p)[idx] + 0.02
    setTimeSec(timeRef.current)
    dirtyRef.current = true
    if (playingRef.current) audioRef.current.start(timeRef.current, totalDuration(p))
  }

  /* ---------------- project ops ---------------- */

  // Commit a whole new project state to history (undo/redo). Used by structural + AI edits.
  const commit = (next: Project) => {
    pastRef.current.push(projectRef.current)
    if (pastRef.current.length > 60) pastRef.current.shift()
    futureRef.current = []
    setProject(next)
    setHist({ undo: true, redo: false })
  }
  const undo = () => {
    const prev = pastRef.current.pop()
    if (!prev) return
    futureRef.current.push(projectRef.current)
    setProject(prev)
    setHist({ undo: pastRef.current.length > 0, redo: true })
    timeRef.current = 0
    setTimeSec(0)
  }
  const redo = () => {
    const nx = futureRef.current.pop()
    if (!nx) return
    pastRef.current.push(projectRef.current)
    setProject(nx)
    setHist({ undo: true, redo: futureRef.current.length > 0 })
  }

  const mutateScene = (id: string, fn: (s: Scene) => Scene) =>
    setProject((p) => ({ ...p, scenes: p.scenes.map((s) => (s.id === id ? fn(s) : s)) }))

  const addScene = (type: SceneType) => {
    const s = defaultScene(type)
    const p = projectRef.current
    const idx = p.scenes.findIndex((x) => x.id === selectedId)
    const scenes = [...p.scenes]
    scenes.splice(idx < 0 ? scenes.length : idx + 1, 0, s)
    commit({ ...p, scenes })
    setSelectedId(s.id)
    setAddOpen(false)
  }

  const removeScene = (id: string) => {
    commit({ ...projectRef.current, scenes: projectRef.current.scenes.filter((s) => s.id !== id) })
    if (selectedId === id) setSelectedId(null)
  }

  const moveScene = (id: string, dir: -1 | 1) => {
    const p = projectRef.current
    const i = p.scenes.findIndex((s) => s.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= p.scenes.length) return
    const scenes = [...p.scenes]
    ;[scenes[i], scenes[j]] = [scenes[j], scenes[i]]
    commit({ ...p, scenes })
  }

  const resetTemplate = () => {
    const p = defaultProject()
    commit(p)
    setSelectedId(p.scenes[0].id)
    timeRef.current = 0
    setTimeSec(0)
  }

  /* ---------------- AI: brief → full draft ---------------- */

  const runDraft = async () => {
    const text = brief.trim()
    if (!text || drafting) return
    setDrafting(true)
    onBusyChange?.(true)
    const bh = beatsRef.current ? `${beatsRef.current.bpm} BPM, ${beatsRef.current.beats.length} beats.` : undefined
    const res = await draftProject(text, projectRef.current.brand, assets, bh)
    setDrafting(false)
    onBusyChange?.(false)
    if (!res.ok) {
      toast(res.error, 'info')
      return
    }
    commit({ ...projectRef.current, scenes: res.value })
    setSelectedId(res.value[0]?.id ?? null)
    timeRef.current = 0
    setTimeSec(0)
    setBriefOpen(false)
    toast(`Draft ready — ${res.value.length} scenes. Refine each one via the AI chat.`, 'success')
  }

  /* ---------------- AI: per-scene direction ---------------- */

  // The power path: one box edits ANYTHING via a validated patch. Local parser first (instant,
  // offline for common asks), then the full AI patch director for everything else.
  const runDirect = async () => {
    const text = instruction.trim()
    if (!text || directing) return
    const focusId = selectedId
    const key = focusId ?? '__project__'
    const say = (role: 'user' | 'ai', msg: string) => setChat((c) => ({ ...c, [key]: [...(c[key] ?? []), { role, text: msg }] }))
    setDirecting(true)
    say('user', text)
    setInstruction('')

    const finish = (patchProject: Project, summary: string) => {
      commit(patchProject)
      if (focusId) jumpToScene(focusId)
      say('ai', `✓ ${summary}`)
    }

    // 1) Local parser — no round-trip.
    const local = localDirect(projectRef.current, text, focusId)
    if (local) {
      const res = applyPatch(projectRef.current, local, beatsRef.current)
      if (res.applied > 0) {
        setDirecting(false)
        finish(res.project, local.summary ?? 'Done.')
        return
      }
    }

    // 2) Full AI patch director.
    if (!aiAvailable) {
      setDirecting(false)
      say('ai', '⚠ Add an OpenAI key in Settings → AI for edits like this.')
      return
    }
    const bh = beatsRef.current ? `${beatsRef.current.bpm} BPM, ${beatsRef.current.beats.length} beats.` : undefined
    const r = await directProject(projectRef.current, text, assets, bh, focusId)
    setDirecting(false)
    if (!r.ok) {
      say('ai', `⚠ ${r.error}`)
      return
    }
    const res = applyPatch(projectRef.current, r.value, beatsRef.current)
    if (res.applied > 0) finish(res.project, r.value.summary ?? 'Updated.')
    else say('ai', '⚠ Nothing changed — try naming the element or scene.')
  }

  /* ---------------- assets ---------------- */

  const onUpload = async (files: FileList | null) => {
    if (!files?.length) return
    for (const f of Array.from(files)) {
      try {
        await saveAsset(f)
      } catch {
        toast(`Could not import ${f.name}.`, 'info')
      }
    }
    setAssets(await listAssets())
    toast('Asset added — tell the AI where to use it.', 'success')
  }

  const removeAsset = async (id: string) => {
    await deleteAsset(id)
    setAssets(await listAssets())
  }

  /* ---------------- audio ---------------- */

  const onUploadMusic = async (file: File) => {
    try {
      const meta = await saveAudioAsset(file)
      setProject((p) => ({
        ...p,
        audio: { assetId: meta.id, name: meta.name, volume: 0.8, fadeIn: 0.4, fadeOut: 0.8, offset: 0 },
      }))
      toast('Music added — detecting beats…', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not import that track.', 'info')
    }
  }

  const removeMusic = async () => {
    const id = projectRef.current.audio?.assetId
    audioRef.current.stop()
    setProject((p) => ({ ...p, audio: undefined }))
    if (id) await deleteAudioAsset(id)
  }

  const patchAudio = (patch: Partial<NonNullable<Project['audio']>>) =>
    setProject((p) => (p.audio ? { ...p, audio: { ...p.audio, ...patch } } : p))

  /** Snap the selected scene's clicks (button + cursor) onto the nearest detected beat. */
  const snapClicksToBeats = (strongOnly: boolean) => {
    const p = projectRef.current
    const b = beatsRef.current
    const sel = p.scenes.find((s) => s.id === selectedId)
    if (!sel || !p.audio || !b) return
    if (sel.type !== 'custom') {
      toast('Beat-snap works on AI scenes (with a cursor or button click).', 'info')
      return
    }
    const idx = p.scenes.findIndex((s) => s.id === sel.id)
    const start = sceneStarts(p)[idx]
    const d = sel.duration
    const offset = p.audio.offset
    const snap = (at: number): number => {
      const trackT = offset + start + at * d
      const bt = nearestBeat(b, trackT, strongOnly)
      if (bt == null) return at
      return Math.max(0, Math.min(1, (bt - offset - start) / d))
    }
    let touched = 0
    mutateScene(sel.id, (s) => {
      if (s.type !== 'custom') return s
      const elements = s.props.elements.map((el) => {
        if (el.kind === 'button' && typeof el.clickAt === 'number') {
          touched++
          return { ...el, clickAt: snap(el.clickAt) }
        }
        if (el.kind === 'cursor') {
          const path = el.path.map((pt) => (pt.click ? ((touched++, { ...pt, at: snap(pt.at) })) : pt))
          return { ...el, path }
        }
        return el
      })
      return { ...s, props: { ...s.props, elements } }
    })
    jumpToScene(sel.id)
    toast(touched ? `Snapped ${touched} click${touched === 1 ? '' : 's'} to the ${strongOnly ? 'strong ' : ''}beats.` : 'This scene has no clicks to snap yet.', touched ? 'success' : 'info')
  }

  /* ---------------- export ---------------- */

  const runExport = async () => {
    playingRef.current = false
    setPlaying(false)
    setExporting(true)
    exportingRef.current = true
    onBusyChange?.(true)
    setProgress(0)
    const abort = new AbortController()
    abortRef.current = abort
    try {
      await ensureAssetsLoaded(collectAssetIds(projectRef.current)) // images must be drawable before frame 1
      const a = projectRef.current.audio
      const buf = a ? await decodeAudioAsset(a.assetId) : null
      const exAudio = a && buf ? { buffer: buf, volume: a.volume, fadeIn: a.fadeIn, fadeOut: a.fadeOut, offset: a.offset } : null
      const blob = await exportVideo({ project: projectRef.current, audio: exAudio, onProgress: setProgress, signal: abort.signal })
      const ext = fileExtFor(pickMime())
      downloadBlob(blob, `${slugify(projectRef.current.brand.product)}-explainer.${ext}`)
      toast('Explainer rendered — check your downloads.', 'success')
    } catch (err) {
      if (!abort.signal.aborted) toast(err instanceof Error ? err.message : 'Export failed.', 'info')
    } finally {
      setExporting(false)
      exportingRef.current = false
      dirtyRef.current = true
      onBusyChange?.(false)
      abortRef.current = null
    }
  }

  useEffect(() => () => abortRef.current?.abort(), [])

  /* ---------------- render ---------------- */

  const total = totalDuration(project)
  const selected = project.scenes.find((s) => s.id === selectedId) ?? null
  const starts = sceneStarts(project)
  const chatKey = selected ? selected.id : '__project__'
  const history = chat[chatKey] ?? []
  const selectedIndex = selected ? project.scenes.findIndex((s) => s.id === selected.id) : -1

  return (
    <div className="mx-editor">
      {/* scene rail */}
      <aside className="mx-scenes">
        <div className="mx-scenes__head">
          <h3>Scenes</h3>
          <span>{total.toFixed(1)}s</span>
        </div>
        <div className="mx-scenes__list">
          {project.scenes.map((s, i) => {
            const meta = SCENE_META[s.type]
            const Icon = meta.icon
            return (
              <div
                key={s.id}
                role="button"
                tabIndex={0}
                className={`mx-scene${s.id === selectedId ? ' is-on' : ''}`}
                onClick={() => {
                  setSelectedId(s.id)
                  jumpToScene(s.id)
                }}
                onKeyDown={(e) => e.key === 'Enter' && setSelectedId(s.id)}
              >
                <span className="mx-scene__num">{i + 1}</span>
                <span className="mx-scene__body">
                  <span className="mx-scene__type">
                    <Icon width="13" height="13" /> {meta.label}
                  </span>
                  <span className="mx-scene__title">{sceneTitle(s)}</span>
                </span>
                <span className="mx-scene__dur">{s.duration.toFixed(1)}s</span>
                <span className="mx-scene__ops" onClick={(e) => e.stopPropagation()}>
                  <button title="Move up" onClick={() => moveScene(s.id, -1)} disabled={i === 0}>↑</button>
                  <button title="Move down" onClick={() => moveScene(s.id, 1)} disabled={i === project.scenes.length - 1}>↓</button>
                  <button title="Delete scene" onClick={() => removeScene(s.id)}>✕</button>
                </span>
              </div>
            )
          })}
          {project.scenes.length === 0 && <p className="mx-empty">No scenes yet — add one below or use AI draft.</p>}
        </div>
        <div className="mx-scenes__foot">
          <div className="mx-add">
            <button className="xp-btn" onClick={() => setAddOpen((o) => !o)}>
              <IcoPlus width="15" height="15" /> Add scene
            </button>
            {addOpen && (
              <div className="mx-add__menu">
                {(Object.keys(SCENE_META) as SceneType[]).map((tp) => (
                  <button key={tp} onClick={() => addScene(tp)}>
                    <b>{SCENE_META[tp].label}</b>
                    <small>{SCENE_META[tp].hint}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="mx-reset" onClick={resetTemplate}>
            Reset to template
          </button>
        </div>
      </aside>

      {/* stage */}
      <div className="mx-stage-col">
        <div className="mx-toolbar">
          <div className="mx-aspects">
            {(['16:9', '9:16', '1:1'] as MotionAspect[]).map((a) => (
              <button
                key={a}
                className={`mx-aspect${project.aspect === a ? ' is-on' : ''}`}
                onClick={() => setProject((p) => ({ ...p, aspect: a }))}
              >
                {a}
              </button>
            ))}
          </div>
          <div className="mx-toolbar__right">
            <button className="xp-btn" onClick={() => setBriefOpen(true)} disabled={exporting || drafting}>
              <IcoSparkle width="15" height="15" /> AI draft
            </button>
            <button className="xp-btn xp-btn--primary" onClick={runExport} disabled={exporting || project.scenes.length === 0}>
              <IcoUpload width="15" height="15" /> {exporting ? `Rendering ${Math.round(progress * 100)}%` : 'Export video'}
            </button>
          </div>
        </div>

        <div className={`xp-stage mx-stage${project.aspect === '9:16' ? ' mx-stage--tall' : ''}`}>
          <canvas ref={canvasRef} className="xp-canvas" />
          {exporting && (
            <div className="xp-export-veil">
              <div className="xp-export-ring" style={{ ['--p' as string]: progress }}>
                <span>{Math.round(progress * 100)}%</span>
              </div>
              <p>Rendering your explainer…</p>
            </div>
          )}
        </div>

        <div className="xp-transport">
          <button className="xp-play" onClick={togglePlay} disabled={exporting || project.scenes.length === 0}>
            {playing ? '❚❚' : '▶'}
          </button>
          <span className="xp-time">{fmtTime(timeSec)}</span>
          <div className="xp-track">
            <input
              type="range"
              min={0}
              max={Math.max(total, 0.001)}
              step={0.01}
              value={Math.min(timeSec, total)}
              onChange={(e) => scrub(parseFloat(e.target.value))}
              onPointerDown={() => {
                draggingRef.current = true
              }}
              onPointerUp={() => {
                draggingRef.current = false
              }}
              disabled={exporting}
            />
            {starts.slice(1).map((b, i) => (
              <span key={i} className="xp-mark" style={{ left: `${(b / Math.max(total, 0.001)) * 100}%` }} />
            ))}
          </div>
          <span className="xp-time">{fmtTime(total)}</span>
        </div>

        {/* music waveform + beat markers (click to seek) */}
        <div className="mx-wave-wrap">
          <WaveformStrip
            peaks={waveform}
            beats={beats}
            accent={safeHex(project.brand.accent)}
            timeSec={timeSec}
            total={total}
            offset={project.audio?.offset ?? 0}
            onSeek={scrub}
          />
        </div>
      </div>

      {/* inspector */}
      <aside className="xp-panel mx-panel">
        {/* AI direction chat — the primary way to build scenes */}
        <section className="xp-sec mx-ai">
          <h3>
            <IcoAI width="13" height="13" /> Direct with AI
          </h3>
          <div className="mx-histrow">
            <button className="xp-btn" onClick={undo} disabled={!hist.undo || directing || exporting} title="Undo">
              ↶ Undo
            </button>
            <button className="xp-btn" onClick={redo} disabled={!hist.redo || directing || exporting} title="Redo">
              ↷ Redo
            </button>
          </div>
          {!aiAvailable && (
            <p className="mx-warnline">
              No OpenAI key — simple edits (size, colour, aspect, timing, beat-sync, music) work offline; add a key in Settings → AI for anything else.
            </p>
          )}
          {history.length > 0 && (
            <div className="mx-chat">
              {history.slice(-6).map((m, i) => (
                <div key={i} className={`mx-msg mx-msg--${m.role}`}>
                  {m.text}
                </div>
              ))}
            </div>
          )}
          <textarea
            className="mx-input mx-input--area"
            rows={3}
            placeholder={'Change anything: "make the headline bigger", "accent blue", "put the click on the strong beat", "make it 9:16", "0.8s longer", "add a closing CTA"'}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void runDirect()
            }}
            disabled={directing || exporting}
          />
          <button
            className="xp-btn xp-btn--primary mx-direct"
            onClick={runDirect}
            disabled={directing || exporting || !instruction.trim()}
          >
            <IcoSparkle width="15" height="15" /> {directing ? 'Working…' : selected ? `Edit scene ${selectedIndex + 1}` : 'Apply'}
          </button>
          <p className="mx-aihint">
            {selected
              ? `Focused on scene ${selectedIndex + 1}. Name another scene or say “the whole video” to change more.`
              : 'Editing the whole project — click a scene to focus.'}
          </p>
        </section>

        <section className="xp-sec">
          <h3>Brand</h3>
          <Field label="Product name">
            <input
              className="mx-input"
              value={project.brand.product}
              onChange={(e) => setProject((p) => ({ ...p, brand: { ...p.brand, product: e.target.value } }))}
            />
          </Field>
          <span className="mx-label">Accent</span>
          <div className="mx-accents">
            {ACCENTS.map((c) => (
              <button
                key={c}
                className={`mx-accent${project.brand.accent === c ? ' is-on' : ''}`}
                style={{ background: c }}
                title={c}
                onClick={() => setProject((p) => ({ ...p, brand: { ...p.brand, accent: c } }))}
              />
            ))}
            <input
              type="color"
              className="mx-color"
              value={safeHex(project.brand.accent)}
              title="Custom accent"
              onChange={(e) => setProject((p) => ({ ...p, brand: { ...p.brand, accent: e.target.value } }))}
            />
          </div>
          <span className="mx-label">Background</span>
          <div className="mx-bgs">
            {(Object.keys(BG_LABELS) as BgKey[]).map((b) => (
              <button
                key={b}
                className={`xp-opt${project.brand.bg === b ? ' is-on' : ''}`}
                onClick={() => setProject((p) => ({ ...p, brand: { ...p.brand, bg: b } }))}
              >
                <span className="xp-opt__k">{BG_LABELS[b]}</span>
              </button>
            ))}
          </div>
        </section>

        {/* asset library: real screenshots / logos the AI can place */}
        <section className="xp-sec">
          <h3>Screenshots &amp; logos</h3>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              void onUpload(e.target.files)
              e.target.value = ''
            }}
          />
          <button className="xp-btn mx-upload" onClick={() => fileRef.current?.click()} disabled={exporting}>
            <IcoUpload width="15" height="15" /> Upload image
          </button>
          {assets.length === 0 && <p className="mx-empty">Upload real product screenshots — the AI places and animates them.</p>}
          {assets.map((a) => (
            <div key={a.id} className="mx-asset">
              <span className="mx-asset__name" title={a.name}>
                {a.name}
              </span>
              <button title="Delete asset" onClick={() => void removeAsset(a.id)}>
                ✕
              </button>
            </div>
          ))}
        </section>

        <AudioPanel
          audio={project.audio}
          meta={audioMeta}
          beats={beats}
          busy={exporting}
          onUpload={(f) => void onUploadMusic(f)}
          onRemove={() => void removeMusic()}
          onChange={patchAudio}
          onSnapBeats={snapClicksToBeats}
        />

        {selected ? (
          <SceneInspector scene={selected} onChange={mutateScene} />
        ) : (
          <section className="xp-sec">
            <p className="mx-empty">Select a scene to edit its content.</p>
          </section>
        )}
      </aside>

      {/* AI draft modal */}
      {briefOpen && (
        <div className="mx-modal-scrim" onClick={() => !drafting && setBriefOpen(false)}>
          <div className="mx-modal" onClick={(e) => e.stopPropagation()}>
            <h3>
              <IcoSparkle width="16" height="16" /> Generate the whole video from a brief
            </h3>
            <p className="mx-modal__sub">
              Describe the product, audience, key features and tone. The AI drafts every scene — afterwards you refine each
              scene in the chat.
            </p>
            {!aiAvailable && <p className="mx-warnline">No OpenAI key — add one in Settings → AI first.</p>}
            <textarea
              className="mx-input mx-input--area"
              rows={6}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder={'z.B. 30s Explainer für loom studios: Modemarken designen Kollektionen im Browser. Zielgruppe: Gründer. Zeig das Dashboard, 3 Kennzahlen, am Ende "Jetzt kostenlos testen".'}
              disabled={drafting}
            />
            {project.scenes.length > 0 && (
              <p className="mx-modal__note">Replaces the current {project.scenes.length} scenes.</p>
            )}
            <div className="mx-modal__row">
              <button className="xp-btn xp-btn--ghost" onClick={() => setBriefOpen(false)} disabled={drafting}>
                Cancel
              </button>
              <button className="xp-btn xp-btn--primary" onClick={runDraft} disabled={!aiAvailable || drafting || !brief.trim()}>
                {drafting ? 'Drafting…' : 'Generate scenes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------------- inspector ---------------- */

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mx-field">
      <span>{label}</span>
      {children}
    </label>
  )
}

function SceneInspector({ scene, onChange }: { scene: Scene; onChange: (id: string, fn: (s: Scene) => Scene) => void }) {
  const dur = (
    <Slider
      label="Duration"
      value={scene.duration}
      min={2}
      max={12}
      step={0.5}
      fmt={(v) => `${v.toFixed(1)}s`}
      onChange={(v) => onChange(scene.id, (s) => ({ ...s, duration: v }) as Scene)}
    />
  )

  switch (scene.type) {
    case 'intro':
      return (
        <section className="xp-sec">
          <h3>Intro scene</h3>
          {dur}
          <Field label="Title">
            <input
              className="mx-input"
              value={scene.props.title}
              onChange={(e) => onChange(scene.id, (s) => (s.type === 'intro' ? { ...s, props: { ...s.props, title: e.target.value } } : s))}
            />
          </Field>
          <Field label="Tagline">
            <input
              className="mx-input"
              value={scene.props.tagline}
              onChange={(e) => onChange(scene.id, (s) => (s.type === 'intro' ? { ...s, props: { ...s.props, tagline: e.target.value } } : s))}
            />
          </Field>
        </section>
      )
    case 'statement':
      return (
        <section className="xp-sec">
          <h3>Statement scene</h3>
          {dur}
          <Field label="Message">
            <textarea
              className="mx-input mx-input--area"
              rows={3}
              value={scene.props.text}
              onChange={(e) => onChange(scene.id, (s) => (s.type === 'statement' ? { ...s, props: { ...s.props, text: e.target.value } } : s))}
            />
          </Field>
          <Field label="Highlighted word">
            <input
              className="mx-input"
              value={scene.props.highlight}
              onChange={(e) => onChange(scene.id, (s) => (s.type === 'statement' ? { ...s, props: { ...s.props, highlight: e.target.value } } : s))}
            />
          </Field>
        </section>
      )
    case 'feature':
      return (
        <section className="xp-sec">
          <h3>Feature demo scene</h3>
          {dur}
          <Field label="Heading">
            <input
              className="mx-input"
              value={scene.props.heading}
              onChange={(e) => onChange(scene.id, (s) => (s.type === 'feature' ? { ...s, props: { ...s.props, heading: e.target.value } } : s))}
            />
          </Field>
          <Field label="Caption">
            <input
              className="mx-input"
              value={scene.props.caption}
              onChange={(e) => onChange(scene.id, (s) => (s.type === 'feature' ? { ...s, props: { ...s.props, caption: e.target.value } } : s))}
            />
          </Field>
          <span className="mx-label">Demo chart</span>
          <div className="mx-bgs">
            {(['dashboard', 'analytics'] as const).map((d) => (
              <button
                key={d}
                className={`xp-opt${scene.props.demo === d ? ' is-on' : ''}`}
                onClick={() => onChange(scene.id, (s) => (s.type === 'feature' ? { ...s, props: { ...s.props, demo: d } } : s))}
              >
                <span className="xp-opt__k">{d === 'dashboard' ? 'Line chart' : 'Bars'}</span>
              </button>
            ))}
          </div>
          <Field label="Callout 1">
            <input
              className="mx-input"
              value={scene.props.calloutA}
              onChange={(e) => onChange(scene.id, (s) => (s.type === 'feature' ? { ...s, props: { ...s.props, calloutA: e.target.value } } : s))}
            />
          </Field>
          <Field label="Callout 2">
            <input
              className="mx-input"
              value={scene.props.calloutB}
              onChange={(e) => onChange(scene.id, (s) => (s.type === 'feature' ? { ...s, props: { ...s.props, calloutB: e.target.value } } : s))}
            />
          </Field>
        </section>
      )
    case 'stats': {
      const patchStat = (i: number, patch: Partial<StatItem>) =>
        onChange(scene.id, (s) =>
          s.type === 'stats'
            ? { ...s, props: { ...s.props, stats: s.props.stats.map((x, j) => (j === i ? { ...x, ...patch } : x)) } }
            : s,
        )
      return (
        <section className="xp-sec">
          <h3>Stats scene</h3>
          {dur}
          <Field label="Heading">
            <input
              className="mx-input"
              value={scene.props.heading}
              onChange={(e) => onChange(scene.id, (s) => (s.type === 'stats' ? { ...s, props: { ...s.props, heading: e.target.value } } : s))}
            />
          </Field>
          <span className="mx-label">Metrics (value · suffix · label)</span>
          {scene.props.stats.map((st, i) => (
            <div key={i} className="mx-statrow">
              <input
                className="mx-input mx-input--sm"
                type="number"
                value={st.value}
                onChange={(e) => patchStat(i, { value: parseFloat(e.target.value) || 0 })}
              />
              <input className="mx-input mx-input--sm" value={st.suffix} placeholder="k+" onChange={(e) => patchStat(i, { suffix: e.target.value })} />
              <input className="mx-input" value={st.label} placeholder="Label" onChange={(e) => patchStat(i, { label: e.target.value })} />
            </div>
          ))}
        </section>
      )
    }
    case 'cta':
      return (
        <section className="xp-sec">
          <h3>CTA scene</h3>
          {dur}
          <Field label="Title">
            <input
              className="mx-input"
              value={scene.props.title}
              onChange={(e) => onChange(scene.id, (s) => (s.type === 'cta' ? { ...s, props: { ...s.props, title: e.target.value } } : s))}
            />
          </Field>
          <Field label="Subline">
            <input
              className="mx-input"
              value={scene.props.sub}
              onChange={(e) => onChange(scene.id, (s) => (s.type === 'cta' ? { ...s, props: { ...s.props, sub: e.target.value } } : s))}
            />
          </Field>
          <Field label="Button label">
            <input
              className="mx-input"
              value={scene.props.button}
              onChange={(e) => onChange(scene.id, (s) => (s.type === 'cta' ? { ...s, props: { ...s.props, button: e.target.value } } : s))}
            />
          </Field>
          <Field label="URL">
            <input
              className="mx-input"
              value={scene.props.url}
              onChange={(e) => onChange(scene.id, (s) => (s.type === 'cta' ? { ...s, props: { ...s.props, url: e.target.value } } : s))}
            />
          </Field>
        </section>
      )
    case 'custom': {
      const removeEl = (elId: string) =>
        onChange(scene.id, (s) =>
          s.type === 'custom' ? { ...s, props: { ...s.props, elements: s.props.elements.filter((e) => e.id !== elId) } } : s,
        )
      return (
        <section className="xp-sec">
          <h3>AI scene</h3>
          {dur}
          <Field label="Label">
            <input
              className="mx-input"
              value={scene.props.label}
              onChange={(e) => onChange(scene.id, (s) => (s.type === 'custom' ? { ...s, props: { ...s.props, label: e.target.value } } : s))}
            />
          </Field>
          <span className="mx-label">Elements ({scene.props.elements.length})</span>
          {scene.props.elements.length === 0 && <p className="mx-empty">Empty — describe this scene in the AI chat above.</p>}
          {scene.props.elements.map((el) => (
            <div key={el.id} className="mx-el">
              <span className="mx-el__kind">{el.kind}</span>
              <span className="mx-el__txt" title={elSummary(el)}>
                {elSummary(el)}
              </span>
              <button title="Remove element" onClick={() => removeEl(el.id)}>
                ✕
              </button>
            </div>
          ))}
        </section>
      )
    }
  }
}
