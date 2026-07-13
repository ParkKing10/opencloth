// Presentation event bus — fires named cues so sound design (or analytics, or haptics) can hook
// in LATER without touching any component. Pure, dependency-free, and a no-op when nobody listens.
//
// Usage (future sound layer):
//   const off = onPresentationCue((e) => sounds[e.cue]?.play())
// Cues are also mirrored on window as 'threados:cue' CustomEvents for an external bridge.

export type PresentationCue =
  | 'click' // any pointer interaction while presenting
  | 'whoosh' // scene transitions / navigation
  | 'select' // something becomes focused/selected
  | 'type' // a keystroke in the scripted typing
  | 'generate' // AI generation kicks off
  | 'reveal' // a garment/graphic/card animates in
  | 'drag' // a drag begins
  | 'snap' // a drag snaps into place
  | 'recolor' // a colour transition
  | 'complete' // a step finishes
  | 'success' // the workflow finishes
  | 'scene' // a new scene starts

export type PresentationEvent = { cue: PresentationCue; detail?: unknown; at: number }
type Listener = (e: PresentationEvent) => void

const listeners = new Set<Listener>()

/** Subscribe to cues. Returns an unsubscribe fn. */
export function onPresentationCue(fn: Listener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/** Fire a cue. Never throws — a broken listener can never break the show. */
export function emitPresentationCue(cue: PresentationCue, detail?: unknown): void {
  const at = typeof performance !== 'undefined' ? performance.now() : 0
  const event: PresentationEvent = { cue, detail, at }
  listeners.forEach((fn) => {
    try {
      fn(event)
    } catch {
      /* swallow — presentation must be unbreakable */
    }
  })
  try {
    window.dispatchEvent(new CustomEvent('threados:cue', { detail: event }))
  } catch {
    /* ignore environments without CustomEvent */
  }
}
