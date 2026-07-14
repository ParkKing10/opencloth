/* ============================================================
   Motion engine — easing & interpolation math.
   Pure functions: every animation in the explainer is a function
   of time, so preview and export are guaranteed identical.
   ============================================================ */

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

/** Normalised progress of `t` within the window [a, b], clamped to 0..1. */
export const seg = (t: number, a: number, b: number): number => clamp01((t - a) / Math.max(1e-6, b - a))

export const easeInOutCubic = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3)

export const easeOutQuint = (t: number): number => 1 - Math.pow(1 - t, 5)

export const easeOutExpo = (t: number): number => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t))

/** Overshoots slightly past 1 then settles — the classic "pop". */
export const easeOutBack = (t: number): number => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

/** Triangle pulse: 0 → 1 over `w` after `at`, back to 0 over the next `w`. */
export const pulse = (t: number, at: number, w: number): number => {
  if (t <= at || t >= at + w * 2) return 0
  return t < at + w ? seg(t, at, at + w) : 1 - seg(t, at + w, at + w * 2)
}

/** Deterministic pseudo-random in [0, 1) from an integer seed — keeps preview and export identical. */
export function rand(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}
