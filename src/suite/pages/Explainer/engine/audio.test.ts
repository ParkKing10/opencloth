import { describe, expect, it } from 'vitest'
import { computeWaveform, detectBeats, nearestBeat } from './audio'

/** Minimal AudioBuffer stand-in — detectBeats/computeWaveform only read these members. */
function fakeBuffer(channel: Float32Array, sampleRate: number): AudioBuffer {
  return {
    sampleRate,
    length: channel.length,
    duration: channel.length / sampleRate,
    numberOfChannels: 1,
    getChannelData: () => channel,
  } as unknown as AudioBuffer
}

/** A click track: a sharp decaying impulse every `period` seconds. */
function clickTrack(bpm: number, seconds: number, sampleRate = 44100): Float32Array {
  const data = new Float32Array(Math.floor(seconds * sampleRate))
  const period = 60 / bpm
  for (let t = 0; t < seconds; t += period) {
    const start = Math.floor(t * sampleRate)
    for (let i = 0; i < 2000 && start + i < data.length; i++) {
      data[start + i] = Math.exp(-i / 250) * Math.sin((i / sampleRate) * 2 * Math.PI * 180)
    }
  }
  return data
}

describe('detectBeats', () => {
  it('recovers a 120 BPM click track within tolerance', () => {
    const buf = fakeBuffer(clickTrack(120, 8), 44100)
    const beats = detectBeats(buf)
    expect(beats.bpm).toBeGreaterThan(110)
    expect(beats.bpm).toBeLessThan(130)
    expect(beats.beats.length).toBeGreaterThan(8)
    // Beats should be spaced roughly half a second apart.
    const gaps = beats.beats.slice(1).map((b, i) => b - beats.beats[i])
    const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length
    expect(avg).toBeGreaterThan(0.4)
    expect(avg).toBeLessThan(0.6)
  })

  it('recovers a 90 BPM click track', () => {
    const beats = detectBeats(fakeBuffer(clickTrack(90, 8), 44100))
    expect(beats.bpm).toBeGreaterThan(82)
    expect(beats.bpm).toBeLessThan(98)
  })

  it('is deterministic', () => {
    const a = detectBeats(fakeBuffer(clickTrack(120, 6), 44100))
    const b = detectBeats(fakeBuffer(clickTrack(120, 6), 44100))
    expect(a.beats).toEqual(b.beats)
    expect(a.bpm).toBe(b.bpm)
  })
})

describe('nearestBeat', () => {
  it('snaps to the closest beat', () => {
    const beats = { bpm: 120, beats: [0, 0.5, 1, 1.5, 2], strongBeats: [0, 1, 2], duration: 2.5 }
    expect(nearestBeat(beats, 0.62)).toBe(0.5)
    expect(nearestBeat(beats, 0.9)).toBe(1)
    expect(nearestBeat(beats, 0.62, true)).toBe(1) // strong-only skips 0.5
  })
})

describe('computeWaveform', () => {
  it('returns normalised peaks in the requested bucket count', () => {
    const data = new Float32Array(44100)
    for (let i = 0; i < data.length; i++) data[i] = Math.sin(i / 20) * 0.5
    const peaks = computeWaveform(fakeBuffer(data, 44100), 100)
    expect(peaks.length).toBe(100)
    expect(Math.max(...peaks)).toBeCloseTo(1, 1) // loudest bucket fills the strip
    expect(Math.min(...peaks)).toBeGreaterThanOrEqual(0)
  })
})
