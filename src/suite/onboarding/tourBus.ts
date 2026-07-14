/* ============================================================
   App tour — tiny start bus.
   Anything in the suite (Settings card, topbar "?" button) can
   request the tour without importing the overlay: dispatch a
   window event that the mounted TourOverlay listens for.
   ============================================================ */

export const TOUR_START_EVENT = 'loom:tour-start'

/** Ask the mounted TourOverlay to start a walkthrough.
    No id → the tour that belongs to the current page (fallback: the app tour). */
export function requestTour(tourId?: string): void {
  window.dispatchEvent(new CustomEvent(TOUR_START_EVENT, { detail: tourId }))
}
