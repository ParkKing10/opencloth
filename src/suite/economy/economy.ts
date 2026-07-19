/* ============================================================
   The loom studios economy.
   ONE rule: inside the app everything is priced in COINS. Euros/
   dollars appear in exactly ONE place — the coin-purchase packs.

   Coins are earned (referrals, UGC, viral tasks) or bought. This
   module holds the pack/plan/task definitions plus a small
   localStorage ledger of what a user earned and claimed. The coin
   BALANCE itself lives on the user record (mutated via the store);
   this module only records history + task/referral state.
   ============================================================ */

export type Currency = '€' | '$'

/** A coin pack — the ONLY place real money is shown. */
export type CoinPack = {
  id: string
  labelKey: string
  coins: number
  /** Bonus coins on top (marketing). */
  bonus: number
  /** Formatted price incl. currency symbol — the single currency string in the app. */
  price: string
  badge?: 'popular' | 'best'
}

export const COIN_PACKS: CoinPack[] = [
  { id: 'starter', labelKey: 'rewards.pack.starter', coins: 500, bonus: 0, price: '€4.99' },
  { id: 'creator', labelKey: 'rewards.pack.creator', coins: 1500, bonus: 150, price: '€12.99', badge: 'popular' },
  { id: 'studio', labelKey: 'rewards.pack.studio', coins: 5000, bonus: 1000, price: '€39.99' },
  { id: 'viral', labelKey: 'rewards.pack.viral', coins: 15000, bonus: 4500, price: '€99.99', badge: 'best' },
]

/** Plan tiers. A subscription is sold in € and GRANTS this many coins each month; inside the app
   you only ever spend coins. Priced against what we REPLACE (photographers, editors, UGC
   creators, agencies) — business pricing, not consumer pricing. `maxCharacters` gates the
   Marketing Studio character slots: the strongest real product differentiator per tier. */
export type PlanId = 'Free' | 'Creator' | 'Studio' | 'Scale' | 'Brand'
export type PlanTier = { id: PlanId; coinsPerMonth: number; coinCap: number; maxCharacters: number }
export const PLAN_TIERS: PlanTier[] = [
  { id: 'Free', coinsPerMonth: 0, coinCap: 2000, maxCharacters: 1 },
  { id: 'Creator', coinsPerMonth: 2000, coinCap: 10000, maxCharacters: 2 },
  { id: 'Studio', coinsPerMonth: 10000, coinCap: 50000, maxCharacters: 5 },
  { id: 'Scale', coinsPerMonth: 40000, coinCap: 200000, maxCharacters: 20 },
  { id: 'Brand', coinsPerMonth: 150000, coinCap: 750000, maxCharacters: Infinity },
]
export const planTier = (id: string): PlanTier => PLAN_TIERS.find((p) => p.id === id) ?? PLAN_TIERS[0]
export const isPaidPlan = (id: string): boolean => id !== 'Free'
export const maxCharactersFor = (planId: string): number => planTier(planId).maxCharacters

/* ---------------- generation costs + free trial ----------------
   Coins are meant to be scarce: an AI generation is real work the user would pay a
   freelancer for, so it costs real coins. Every kind gives ONE free trial (the aha-moment);
   after that a Free-plan user hits the paywall, a paid user spends coins. */

export type GenKind = 'design' | 'model' | 'garment' | 'edit' | 'mockup'

export const COSTS: Record<GenKind, number> = {
  design: 200, // AI Designer — a full front+back design
  garment: 200, // Garment Lab / create a garment
  model: 220, // photoreal on-model shot
  mockup: 220, // campaign mockup
  edit: 120, // edit an existing garment (holes, graphic, wash…)
}

const FREE_KEY = 'loom-freegen-v1'

type FreeMap = Record<string, Record<string, boolean>>
function readFree(): FreeMap {
  try {
    return JSON.parse(localStorage.getItem(FREE_KEY) || '{}') as FreeMap
  } catch {
    return {}
  }
}
/** Has this user already spent their one free trial of this generation kind? */
export function freeGenUsed(userId: string, kind: GenKind): boolean {
  return !!readFree()[userId]?.[kind]
}
export function markFreeGen(userId: string, kind: GenKind): void {
  const all = readFree()
  all[userId] = { ...(all[userId] ?? {}), [kind]: true }
  try {
    localStorage.setItem(FREE_KEY, JSON.stringify(all))
  } catch {
    /* quota — non-fatal */
  }
}

/* ---------------- subscription pricing (the € offer, OpenArt-style) ---------------- */

export type BillingCycle = 'monthly' | 'annual'

/** A paid subscription card on the pricing page. `annual` is the €/month price when billed yearly. */
export type PricingTier = {
  id: Exclude<PlanId, 'Free'>
  /** €/month billed monthly. */
  monthly: number
  /** €/month billed annually (the anchor discount). */
  annual: number
  /** Coins granted every month. */
  coins: number
  badge?: 'popular' | 'best'
  accent: string
  /** Number of bullet keys: pricing.feat.<id>.1 … .<n>. */
  bullets: number
  /** Whether this tier stacks "everything in the previous tier, plus…". */
  inherits?: PlanId
}

/* Business pricing, anchored against agency cost: a single UGC video runs €150–300 outside,
   one photo shoot €1,500+. The top tier exists to anchor — it makes Studio (€99) feel cheap.
   Annual is the default cycle in the UI: one payment a year = cash up front. */
export const PRICING_TIERS: PricingTier[] = [
  { id: 'Creator', monthly: 29, annual: 19, coins: 2000, accent: '#7ab8ff', bullets: 6 },
  { id: 'Studio', monthly: 99, annual: 69, coins: 10000, badge: 'popular', accent: '#d1f94f', bullets: 7, inherits: 'Creator' },
  { id: 'Scale', monthly: 299, annual: 199, coins: 40000, accent: '#ff7ab8', bullets: 7, inherits: 'Studio' },
  { id: 'Brand', monthly: 799, annual: 549, coins: 150000, badge: 'best', accent: '#ffb26b', bullets: 8, inherits: 'Scale' },
]

/** The launch cash lever: a one-time Founders deal — Studio-tier limits for life, hard-capped
    seat count. Shown as its own card on the pricing page. */
export const FOUNDERS_DEAL = {
  price: '€499',
  priceNumber: 499,
  planId: 'Studio' as PlanId,
  seats: 200,
  coins: 10000,
} as const

const FOUNDERS_KEY = 'loom-founders-v1'
export function isFounder(userId: string): boolean {
  try {
    return !!(JSON.parse(localStorage.getItem(FOUNDERS_KEY) || '{}') as Record<string, boolean>)[userId]
  } catch {
    return false
  }
}
export function markFounder(userId: string): void {
  try {
    const all = JSON.parse(localStorage.getItem(FOUNDERS_KEY) || '{}') as Record<string, boolean>
    all[userId] = true
    localStorage.setItem(FOUNDERS_KEY, JSON.stringify(all))
  } catch {
    /* non-fatal */
  }
}

export const priceFor = (t: PricingTier, cycle: BillingCycle): number => (cycle === 'annual' ? t.annual : t.monthly)
/** Coins you get per euro — rises with every tier, so the big plans read as "best value". */
export const coinsPerEuro = (t: PricingTier, cycle: BillingCycle): number => Math.round(t.coins / priceFor(t, cycle))
/** Annual discount percentage vs. the monthly price. */
export const annualSavePct = (t: PricingTier): number => Math.round((1 - t.annual / t.monthly) * 100)

/** Viral earn tasks. UGC + social are repeatable to drive "make, make, make". */
export type TaskKind = 'ugc' | 'social' | 'review'
export type ViralTask = {
  id: string
  kind: TaskKind
  reward: number
  repeatable: boolean
  /** Optional cooldown between repeats, hours. */
  cooldownH?: number
  /** External action link (opens the platform). */
  actionUrl?: string
}
export const VIRAL_TASKS: ViralTask[] = [
  { id: 'ugc_tiktok', kind: 'ugc', reward: 150, repeatable: true, cooldownH: 20, actionUrl: 'https://www.tiktok.com/upload' },
  { id: 'ugc_reel', kind: 'ugc', reward: 120, repeatable: true, cooldownH: 20, actionUrl: 'https://www.instagram.com' },
  { id: 'story', kind: 'social', reward: 50, repeatable: true, cooldownH: 20, actionUrl: 'https://www.instagram.com' },
  { id: 'review', kind: 'review', reward: 100, repeatable: false },
]

/** What one referred subscription is worth to the referrer: one free month. */
export const REFERRAL_FREE_MONTHS = 1

/* ---------------- referral code ---------------- */

const slug = (s: string): string =>
  s
    .normalize('NFKD')
    .replace(/[^\w]+/g, '')
    .slice(0, 8)
    .toUpperCase()

/** Stable, shareable referral code for a user (name + id tail). */
export function referralCodeFor(user: { id: string; name: string }): string {
  const base = slug(user.name || 'LOOM') || 'LOOM'
  const tail = user.id.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase() || '0000'
  return `${base}${tail}`
}

export function referralLink(code: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://loomstudios.app'
  return `${origin}/signup?ref=${code}`
}

/* ---------------- rewards state (localStorage ledger) ---------------- */

export type LedgerEntry = { ts: number; delta: number; reason: string }
export type Submission = { id: string; taskId: string; url: string; ts: number; status: 'pending' | 'approved' }
export type RewardsState = {
  ledger: LedgerEntry[]
  submissions: Submission[]
  /** taskId → last claim timestamp (for cooldowns / one-shot). */
  lastClaim: Record<string, number>
  referrals: { invited: number; subscribed: number }
  freeMonths: number
}

const KEY = 'loom-rewards-v1'

function emptyState(): RewardsState {
  return { ledger: [], submissions: [], lastClaim: {}, referrals: { invited: 0, subscribed: 0 }, freeMonths: 0 }
}

export function loadRewards(userId: string): RewardsState {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) || '{}') as Record<string, RewardsState>
    return { ...emptyState(), ...(all[userId] ?? {}) }
  } catch {
    return emptyState()
  }
}

export function saveRewards(userId: string, state: RewardsState): void {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) || '{}') as Record<string, RewardsState>
    all[userId] = state
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    /* quota — non-fatal */
  }
}

/** Whether a task can be claimed now (respects one-shot + cooldown). */
export function taskAvailable(task: ViralTask, state: RewardsState, now: number): boolean {
  const last = state.lastClaim[task.id]
  if (!last) return true
  if (!task.repeatable) return false
  return now - last >= (task.cooldownH ?? 20) * 3600_000
}

export function rid(): string {
  return `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}
