/* ============================================================
   Guided tours — the step registry.
   'app' is the 12-step shell walkthrough (dashboard + sidebar).
   The page tours (design / garments / shop / ai) explain one page
   each and auto-start once per user on first visit. Every step
   spotlights one [data-tour="…"] anchor; a missing/conditional
   anchor gracefully falls back to a centred card, so copy must
   read fine without a spotlight too. Copy: src/i18n/locales/tour.ts.
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

export type TourId = 'app' | 'design' | 'garments' | 'shop' | 'ai'

const APP_STEPS: TourStep[] = [
  { id: 'welcome', title: 'tour.welcome.title', body: 'tour.welcome.body' },
  { id: 'hero', target: 'dash-hero', title: 'tour.hero.title', body: 'tour.hero.body' },
  { id: 'features', target: 'dash-features', title: 'tour.features.title', body: 'tour.features.body' },
  { id: 'ai', target: 'nav-ai', sidebar: true, title: 'tour.ai.title', body: 'tour.ai.body' },
  { id: 'garments', target: 'nav-garments', sidebar: true, title: 'tour.garments.title', body: 'tour.garments.body' },
  { id: 'design', target: 'nav-design', sidebar: true, title: 'tour.design.title', body: 'tour.design.body' },
  { id: 'collections', target: 'nav-collections', sidebar: true, title: 'tour.collections.title', body: 'tour.collections.body' },
  { id: 'manufacturers', target: 'nav-manufacturers', sidebar: true, title: 'tour.manufacturers.title', body: 'tour.manufacturers.body' },
  { id: 'rewards', target: 'nav-rewards', sidebar: true, title: 'tour.rewards.title', body: 'tour.rewards.body' },
  { id: 'settings', target: 'nav-settings', sidebar: true, title: 'tour.settings.title', body: 'tour.settings.body' },
  { id: 'done', title: 'tour.done.title', body: 'tour.done.body' },
]

const DESIGN_STEPS: TourStep[] = [
  { id: 'hero', target: 'studio-hero', title: 'tour.pgDesign.hero.title', body: 'tour.pgDesign.hero.body' },
  { id: 'designs', target: 'studio-designs-head', title: 'tour.pgDesign.designs.title', body: 'tour.pgDesign.designs.body' },
  { id: 'new', target: 'studio-new-design', title: 'tour.pgDesign.new.title', body: 'tour.pgDesign.new.body' },
]

const GARMENTS_STEPS: TourStep[] = [
  { id: 'create', target: 'garments-create', title: 'tour.pgGarments.create.title', body: 'tour.pgGarments.create.body' },
  { id: 'import', target: 'garments-import', title: 'tour.pgGarments.import.title', body: 'tour.pgGarments.import.body' },
  { id: 'grid', target: 'garments-grid', title: 'tour.pgGarments.grid.title', body: 'tour.pgGarments.grid.body' },
  { id: 'sort', target: 'garments-sort', title: 'tour.pgGarments.sort.title', body: 'tour.pgGarments.sort.body' },
]

const SHOP_STEPS: TourStep[] = [
  { id: 'grid', target: 'shop-grid', title: 'tour.pgShop.grid.title', body: 'tour.pgShop.grid.body' },
  { id: 'cats', target: 'shop-cats', title: 'tour.pgShop.cats.title', body: 'tour.pgShop.cats.body' },
  { id: 'balance', target: 'shop-balance', title: 'tour.pgShop.balance.title', body: 'tour.pgShop.balance.body' },
  { id: 'buy', target: 'shop-buy', title: 'tour.pgShop.buy.title', body: 'tour.pgShop.buy.body' },
]

const AI_STEPS: TourStep[] = [
  { id: 'prompt', target: 'aid-prompt', title: 'tour.pgAi.prompt.title', body: 'tour.pgAi.prompt.body' },
  { id: 'style', target: 'aid-style-pills', title: 'tour.pgAi.style.title', body: 'tour.pgAi.style.body' },
  { id: 'refs', target: 'aid-reference-images', title: 'tour.pgAi.refs.title', body: 'tour.pgAi.refs.body' },
  { id: 'generate', target: 'aid-generate-cta', title: 'tour.pgAi.generate.title', body: 'tour.pgAi.generate.body' },
  { id: 'grid', target: 'aid-design-grid', title: 'tour.pgAi.grid.title', body: 'tour.pgAi.grid.body' },
]

export const TOURS: Record<TourId, { steps: TourStep[]; route: string }> = {
  app: { steps: APP_STEPS, route: '/' },
  design: { steps: DESIGN_STEPS, route: '/design' },
  garments: { steps: GARMENTS_STEPS, route: '/garments' },
  shop: { steps: SHOP_STEPS, route: '/shop' },
  ai: { steps: AI_STEPS, route: '/ai' },
}

/** The tour that belongs to a pathname — undefined when the page has none. */
export function tourForPath(pathname: string): TourId | undefined {
  if (pathname === '/') return 'app'
  const entry = (Object.keys(TOURS) as TourId[]).find((id) => id !== 'app' && TOURS[id].route === pathname)
  return entry
}
