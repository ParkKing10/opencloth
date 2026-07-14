/* ============================================================
   Explainer Studio — audio UI.
   WaveformStrip: the waveform + beat markers + playhead under the
   preview (click to seek). AudioPanel: upload music, see the BPM,
   set the mix, and snap scene clicks onto detected beats.
   ============================================================ */

import { useEffect, useRef } from 'react'
import { IcoUpload } from '../../components/ui/Icons'
import { Slider } from './controls'
import type { AudioBeats, AudioMeta } from './engine/audio'
import type { ProjectAudio } from './types'

/** Waveform + beat ticks + playhead. Project time 0..total maps to track offset..offset+total. */
export function WaveformStrip({
  peaks,
  beats,
  accent,
  timeSec,
  total,
  offset,
  onSeek,
}: {
  peaks: Float32Array | null
  beats: AudioBeats | null
  accent: string
  timeSec: number
  total: number
  offset: number
  onSeek: (t: number) => void
}) {
  const ref = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const cssW = canvas.clientWidth || 600
    const cssH = 54
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, cssW, cssH)
    const mid = cssH / 2

    if (!peaks || peaks.length === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.28)'
      ctx.font = '12px Inter, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('No music yet — upload a track in the Audio panel →', cssW / 2, mid + 4)
      return
    }

    // Waveform bars.
    const n = peaks.length
    const step = cssW / n
    ctx.fillStyle = 'rgba(255,255,255,0.30)'
    for (let i = 0; i < n; i++) {
      const h = Math.max(1, peaks[i] * (cssH - 8))
      ctx.fillRect(i * step, mid - h / 2, Math.max(0.6, step * 0.7), h)
    }

    // Beat ticks within the visible window [offset, offset+total].
    if (beats && total > 0) {
      const toX = (tTrack: number) => ((tTrack - offset) / total) * cssW
      ctx.strokeStyle = 'rgba(255,255,255,0.16)'
      ctx.lineWidth = 1
      for (const b of beats.beats) {
        const x = toX(b)
        if (x < 0 || x > cssW) continue
        ctx.beginPath()
        ctx.moveTo(x, 4)
        ctx.lineTo(x, cssH - 4)
        ctx.stroke()
      }
      ctx.strokeStyle = accent
      ctx.globalAlpha = 0.85
      ctx.lineWidth = 2
      for (const b of beats.strongBeats) {
        const x = toX(b)
        if (x < 0 || x > cssW) continue
        ctx.beginPath()
        ctx.moveTo(x, 2)
        ctx.lineTo(x, cssH - 2)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }

    // Playhead.
    if (total > 0) {
      const x = (Math.min(timeSec, total) / total) * cssW
      ctx.fillStyle = '#fff'
      ctx.fillRect(x - 1, 0, 2, cssH)
    }
  }, [peaks, beats, accent, timeSec, total, offset])

  return (
    <canvas
      ref={ref}
      className="mx-wave"
      onClick={(e) => {
        const r = (e.target as HTMLCanvasElement).getBoundingClientRect()
        const frac = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
        onSeek(frac * total)
      }}
    />
  )
}

export function AudioPanel({
  audio,
  meta,
  beats,
  busy,
  onUpload,
  onRemove,
  onChange,
  onSnapBeats,
}: {
  audio: ProjectAudio | undefined
  meta: AudioMeta | null
  beats: AudioBeats | null
  busy: boolean
  onUpload: (file: File) => void
  onRemove: () => void
  onChange: (patch: Partial<ProjectAudio>) => void
  onSnapBeats: (strongOnly: boolean) => void
}) {
  const fileRef = useRef<HTMLInputElement | null>(null)
  return (
    <section className="xp-sec">
      <h3>🎵 Music &amp; beats</h3>
      <input
        ref={fileRef}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onUpload(f)
          e.target.value = ''
        }}
      />
      {!audio && (
        <>
          <button className="xp-btn mx-upload" onClick={() => fileRef.current?.click()} disabled={busy}>
            <IcoUpload width="15" height="15" /> Upload music
          </button>
          <p className="mx-empty">Add a track — the studio finds its BPM and beats so your clicks and reveals can land on the music.</p>
        </>
      )}
      {audio && (
        <>
          <div className="mx-asset">
            <span className="mx-asset__name" title={audio.name}>
              {audio.name}
            </span>
            <button title="Remove music" onClick={onRemove} disabled={busy}>
              ✕
            </button>
          </div>
          <div className="mx-beatinfo">
            {beats ? (
              <>
                <b>{beats.bpm} BPM</b>
                <span>· {beats.beats.length} beats · {beats.strongBeats.length} strong</span>
              </>
            ) : (
              <span>Analysing beats…</span>
            )}
          </div>
          <Slider label="Music volume" value={audio.volume} min={0} max={1} step={0.05} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => onChange({ volume: v })} />
          <Slider label="Fade in" value={audio.fadeIn} min={0} max={4} step={0.1} fmt={(v) => `${v.toFixed(1)}s`} onChange={(v) => onChange({ fadeIn: v })} />
          <Slider label="Fade out" value={audio.fadeOut} min={0} max={4} step={0.1} fmt={(v) => `${v.toFixed(1)}s`} onChange={(v) => onChange({ fadeOut: v })} />
          <Slider label="Start at" value={audio.offset} min={0} max={Math.max(0, (meta?.duration ?? 0) - 1)} step={0.1} fmt={(v) => `${v.toFixed(1)}s`} onChange={(v) => onChange({ offset: v })} />
          <span className="mx-label">Sync the current scene</span>
          <div className="mx-beatbtns">
            <button className="xp-btn" onClick={() => onSnapBeats(false)} disabled={busy || !beats}>
              Snap clicks to beats
            </button>
            <button className="xp-btn" onClick={() => onSnapBeats(true)} disabled={busy || !beats}>
              Snap to strong beats
            </button>
          </div>
        </>
      )}
    </section>
  )
}
