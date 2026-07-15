import type { Lang, LocaleBundle } from './types'
import { common } from './locales/common'
import { landing } from './locales/landing'
import { auth } from './locales/auth'
import { shell } from './locales/shell'
import { dashboard } from './locales/dashboard'
import { shop } from './locales/shop'
import { garments } from './locales/garments'
import { garmentUi } from './locales/garmentUi'
import { studioLanding } from './locales/studioLanding'
import { aiDesigner } from './locales/aiDesigner'
import { collections } from './locales/collections'
import { assets } from './locales/assets'
import { manufacturers } from './locales/manufacturers'
import { community } from './locales/community'
import { marketplace } from './locales/marketplace'
import { analytics } from './locales/analytics'
import { settings } from './locales/settings'
import { techPacks } from './locales/techPacks'
import { accessories } from './locales/accessories'
import { adminShell } from './locales/adminShell'
import { adminPages } from './locales/adminPages'
import { drive } from './locales/drive'
import { exportUi } from './locales/exportUi'
import { sharedUi } from './locales/sharedUi'
import { dsMain } from './locales/dsMain'
import { dsCanvas } from './locales/dsCanvas'
import { dsPanels } from './locales/dsPanels'
import { dsInspectors } from './locales/dsInspectors'
import { dsAi } from './locales/dsAi'
import { dsDialogs } from './locales/dsDialogs'
import { labMain } from './locales/labMain'
import { labPanels } from './locales/labPanels'
import { presentation } from './locales/presentation'
import { explainer } from './locales/explainer'
import { rewards } from './locales/rewards'
import { pricing } from './locales/pricing'
import { studioMobile } from './locales/studioMobile'
import { marketingStudio } from './locales/marketingStudio'
import { tour } from './locales/tour'
import { trial } from './locales/trial'

// Every feature bundle. Adding a namespace = import it above and drop it in this list.
const BUNDLES: LocaleBundle[] = [
  common,
  landing,
  auth,
  shell,
  dashboard,
  shop,
  garments,
  garmentUi,
  studioLanding,
  aiDesigner,
  collections,
  assets,
  manufacturers,
  community,
  marketplace,
  analytics,
  settings,
  techPacks,
  accessories,
  adminShell,
  adminPages,
  drive,
  exportUi,
  sharedUi,
  dsMain,
  dsCanvas,
  dsPanels,
  dsInspectors,
  dsAi,
  dsDialogs,
  labMain,
  labPanels,
  presentation,
  explainer,
  rewards,
  pricing,
  studioMobile,
  marketingStudio,
  tour,
  trial,
]

function merge(lang: Lang): Record<string, string> {
  return Object.assign({}, ...BUNDLES.map((b) => b[lang]))
}

/** Flattened lookup table per language, built once at module load. */
export const DICT: Record<Lang, Record<string, string>> = {
  en: merge('en'),
  de: merge('de'),
}
