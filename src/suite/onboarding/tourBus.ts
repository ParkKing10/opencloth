/* ============================================================
   App tour — tiny start bus.
   Anything in the suite (Settings card, topbar "?" button) can
   request the tour without importing the overlay: dispatch a
   window event that the mounted TourOverlay listens for.
   ============================================================ */

export const TOUR_START_EVENT = 'loom:tour-start'

/** Ask the mounted TourOverlay to start the walkthrough. */
export function requestTour(): void {
  window.dispatchEvent(new Event(TOUR_START_EVENT))
}
