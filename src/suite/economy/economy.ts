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
   you only ever spend coins. */
export type PlanId = 'Free' | 'Creator' | 'Studio' | 'Scale' | 'Brand'
export type PlanTier = { id: PlanId; coinsPerMonth: number; coinCap: number }
export const PLAN_TIERS: PlanTier[] = [
  { id: 'Free', coinsPerMonth: 0, coinCap: 2000 },
  { id: 'Creator', coinsPerMonth: 3000, coinCap: 15000 },
  { id: 'Studio', coinsPerMonth: 9000, coinCap: 45000 },
  { id: 'Scale', coinsPerMonth: 24000, coinCap: 120000 },
  { id: 'Brand', coinsPerMonth: 80000, coinCap: 400000 },
]
export const planTier = (id: string): PlanTier => PLAN_TIERS.find((p) => p.id === id) ?? PLAN_TIERS[0]
export const isPaidPlan = (id: string): boolean => id !== 'Free'

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

export const PRICING_TIERS: PricingTier[] = [
  { id: 'Creator', monthly: 19, annual: 14, coins: 3000, accent: '#7ab8ff', bullets: 6 },
  { id: 'Studio', monthly: 39, annual: 29, coins: 9000, badge: 'popular', accent: '#d1f94f', bullets: 7, inherits: 'Creator' },
  { id: 'Scale', monthly: 79, annual: 59, coins: 24000, accent: '#ff7ab8', bullets: 7, inherits: 'Studio' },
  { id: 'Brand', monthly: 199, annual: 149, coins: 80000, badge: 'best', accent: '#ffb26b', bullets: 8, inherits: 'Scale' },
]

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
