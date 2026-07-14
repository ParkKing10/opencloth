/* ============================================================
   Ad Director — the auto-cut / storyboard planner.
   Turns one OR MANY recording analyses into a first cut WITHOUT the
   user touching a timeline: keep the key moments at full speed, speed
   through the dead zones, and describe the story as a storyboard
   (Hook → the important beats → Outro). Multiple clips are sequenced
   in upload order; every clip remembers which video it came from.
   Pure + deterministic.
   ============================================================ */

import type { RecordingAnalysis } from './recordingAnalysis'

/** A slice of a source recording to show, at a playback speed. `video` is the recording index. */
export type Clip = { video: number; start: number; end: number; speed: number; focus?: number }

/** A human-readable storyboard step the user sees (never scene/element jargon). */
export type Story = { video: number; t: number; label: string; kind: 'hook' | 'action' | 'reveal' | 'outro'; thumb?: string }

export type AdPlan = {
  clips: Clip[]
  story: Story[]
  /** Effective duration after speeding up the dead zones. */
  cutDuration: number
  deadTrimmed: number
}

export type PlanOptions = {
  /** How fast to run the dead zones (× real time). */
  deadSpeed?: number
  /** Snap clip cuts to these times (music beats) when close. */
  beats?: number[]
}

/** Snap `t` to the nearest beat within `tol` seconds, else return t unchanged. */
function snap(t: number, beats: number[] | undefined, tol: number): number {
  if (!beats?.length) return t
  let best = t
  let bestD = tol
  for (const b of beats) {
    const d = Math.abs(b - t)
    if (d < bestD) {
      bestD = d
      best = b
    }
  }
  return best
}

/** Build the cut for ONE recording → clips tagged with its video index. */
function clipsForVideo(a: RecordingAnalysis, vi: number, deadSpeed: number, beats?: number[]): Clip[] {
  const out: Clip[] = []
  const bound = Math.max(a.duration, 0.001)
  const isDead = (t: number) => a.deadZones.some((z) => t >= z.start && t <= z.end)
  const edges = [...new Set([0, ...a.deadZones.flatMap((z) => [z.start, z.end]), bound])]
    .filter((t) => t >= 0 && t <= bound)
    .sort((x, y) => x - y)
  for (let i = 0; i < edges.length - 1; i++) {
    let s = edges[i]
    let e = edges[i + 1]
    if (e - s < 0.05) continue
    const dead = isDead((s + e) / 2)
    if (!dead) {
      s = snap(s, beats, 0.2)
      e = snap(e, beats, 0.2)
    }
    if (e <= s) continue
    const inside = a.moments.filter((m) => m.t >= s && m.t <= e).sort((x, y) => y.strength - x.strength)[0]
    out.push({ video: vi, start: s, end: e, speed: dead ? deadSpeed : 1, focus: inside?.t })
  }
  return out
}

export function buildAdPlan(input: RecordingAnalysis | RecordingAnalysis[], opts: PlanOptions = {}): AdPlan {
  const analyses = Array.isArray(input) ? input : [input]
  const { deadSpeed = 4, beats } = opts

  const clips: Clip[] = []
  const story: Story[] = [{ video: 0, t: 0, label: 'Hook', kind: 'hook' }]
  let cutDuration = 0
  let deadTrimmed = 0
  let storySteps = 0

  analyses.forEach((a, vi) => {
    clips.push(...clipsForVideo(a, vi, deadSpeed, beats))
    deadTrimmed += a.deadZones.reduce((sum, z) => sum + (z.end - z.start), 0)
    // Storyboard: strongest moments per video (thumbnail if available), capped overall.
    const thumbAt = (t: number) => a.thumbs.reduce<{ t: number; url: string } | null>((best, th) => (best && Math.abs(best.t - t) <= Math.abs(th.t - t) ? best : th), null)
    for (const m of a.moments.slice(0, 5)) {
      if (storySteps >= 8) break
      story.push({ video: vi, t: m.t, kind: m.kind, label: m.kind === 'reveal' ? 'Reveal' : 'Action', thumb: thumbAt(m.t)?.url })
      storySteps++
    }
  })

  cutDuration = clips.reduce((sum, c) => sum + (c.end - c.start) / c.speed, 0)
  const lastDur = analyses[analyses.length - 1]?.duration ?? 0
  story.push({ video: analyses.length - 1, t: lastDur, label: 'Logo + CTA', kind: 'outro' })

  return { clips, story, cutDuration, deadTrimmed }
}
