// Presentation Mode — isolated state helpers + the <html data-presentation> attribute.
//
// This mirrors src/suite/theme.ts (data-theme on the document root) but is admin-only and
// is applied ONLY by PresentationProvider (gated on isAdmin) — never pre-render — so a normal
// user never sees the feature even if the flag somehow lands in their localStorage.
//
// The entire feature is toggled by a single root attribute: [data-presentation='on']. Every
// presentation animation, camera effect and overlay keys off it, so production rendering is
// byte-for-byte unchanged when it is absent.

const KEY = 'threados-presentation' // internal key keeps the legacy prefix by design (see rebrand memory)

export function getStoredPresentation(): boolean {
  try {
    return localStorage.getItem(KEY) === 'on'
  } catch {
    return false
  }
}

export function storePresentation(on: boolean): void {
  try {
    if (on) localStorage.setItem(KEY, 'on')
    else localStorage.removeItem(KEY)
  } catch {
    /* ignore storage failures (private mode etc.) */
  }
}

/** Stamp (or clear) the root attribute that activates the whole presentation CSS layer. */
export function applyPresentation(on: boolean): void {
  const root = document.documentElement
  if (on) root.setAttribute('data-presentation', 'on')
  else root.removeAttribute('data-presentation')
}

/** Premium easings for JS-driven motion (cursor, camera). Matches the suite --s-ease family. */
export const PRESENTATION_EASE = {
  /** Decelerate — the house easing, great for arrivals. */
  out: 'cubic-bezier(0.22, 1, 0.36, 1)',
  /** Symmetric — for travel between two points. */
  inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
  /** Overshoot — a tiny, tasteful bounce on snaps/selects. */
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const

/** True when the viewer asked the OS to reduce motion — honoured everywhere for accessibility. */
export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}
