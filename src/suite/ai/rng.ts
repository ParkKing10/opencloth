/**
 * Tiny deterministic PRNG so concept generation is reproducible: the same prompt + seed always
 * yields the same artwork (no Math.random anywhere in the pipeline — generation is real, repeatable
 * synthesis, not a dice roll dressed up as AI).
 */

/** mulberry32 — fast, good-enough distribution for visual variation. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Stable 32-bit hash of a string → a seed. */
export function hashSeed(text: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export type Rng = () => number

/** Uniform float in [min, max). */
export function range(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min)
}

/** Integer in [min, max] inclusive. */
export function rangeInt(rng: Rng, min: number, max: number): number {
  return Math.floor(range(rng, min, max + 1))
}

/** Pick one element deterministically. */
export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))]
}

/** Round to 2 decimals for compact, stable SVG path strings. */
export function r2(n: number): number {
  return Math.round(n * 100) / 100
}
