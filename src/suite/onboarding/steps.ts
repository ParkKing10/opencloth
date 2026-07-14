/* ============================================================
   App tour — the step list.
   Every step spotlights one [data-tour="…"] anchor (or shows a
   centred card when `target` is unset). All steps run on the
   dashboard; `sidebar` steps open the nav drawer on compact
   viewports first. Copy lives in src/i18n/locales/tour.ts.
   ============================================================ */

export type TourStep = {
  id: string
  /** data-tour anchor to spotlight; a step without target renders a centred card. */
  target?: string
  /** Needs the sidebar visible — open the off-canvas drawer on compact viewports. */
  sidebar?: boolean
  /** i18n keys. */
  title: string
  body: string
}

export const TOUR_STEPS: TourStep[] = [
  { id: 'welcome', title: 'tour.welcome.title', body: 'tour.welcome.body' },
  { id: 'hero', target: 'dash-hero', title: 'tour.hero.title', body: 'tour.hero.body' },
  { id: 'features', target: 'dash-features', title: 'tour.features.title', body: 'tour.features.body' },
  { id: 'ai', target: 'nav-ai', sidebar: true, title: 'tour.ai.title', body: 'tour.ai.body' },
  { id: 'garments', target: 'nav-garments', sidebar: true, title: 'tour.garments.title', body: 'tour.garments.body' },
  { id: 'design', target: 'nav-design', sidebar: true, title: 'tour.design.title', body: 'tour.design.body' },
  { id: 'collections', target: 'nav-collections', sidebar: true, title: 'tour.collections.title', body: 'tour.collections.body' },
  { id: 'manufacturers', target: 'nav-manufacturers', sidebar: true, title: 'tour.manufacturers.title', body: 'tour.manufacturers.body' },
  { id: 'rewards', target: 'nav-rewards', sidebar: true, title: 'tour.rewards.title', body: 'tour.rewards.body' },
  { id: 'search', target: 'topbar-search', title: 'tour.search.title', body: 'tour.search.body' },
  { id: 'settings', target: 'nav-settings', sidebar: true, title: 'tour.settings.title', body: 'tour.settings.body' },
  { id: 'done', title: 'tour.done.title', body: 'tour.done.body' },
]
