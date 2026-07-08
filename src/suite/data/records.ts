/**
 * Supabase data engine — the bridge between the app's camelCase domain model
 * (types.ts) and the snake_case Postgres schema (supabase/schema.sql).
 *
 * Two responsibilities:
 *  1) hydrate()   — read the signed-in user's data (RLS-scoped) into a SuiteData.
 *  2) reconcile() — diff a previous vs next SuiteData and persist the delta
 *                   (INSERT / UPDATE / DELETE) so the synchronous `mutate` API
 *                   stays intact while data lands in the database.
 *
 * Only the four owner-scoped tables + profiles + manufacturers are persisted.
 * Notifications have no table and the Manufacturer.saved flag has no column —
 * both stay client-side, so mapping simply omits them.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Collection,
  Design,
  Manufacturer,
  Order,
  SuiteData,
  TechPack,
  User,
} from './types'

/** Minimal view of the authenticated Supabase user the store/auth pass around. */
export type SessionUser = { id: string; email: string; name: string }

type Row = Record<string, unknown>

const toMs = (iso: unknown): number => (typeof iso === 'string' ? Date.parse(iso) : Date.now())
const toIso = (ms: number): string => new Date(ms).toISOString()
const num = (v: unknown, fallback = 0): number => (v == null ? fallback : Number(v))
const str = (v: unknown, fallback = ''): string => (v == null ? fallback : String(v))

// ---------- row → entity ----------
export function rowToUser(r: Row): User {
  return {
    id: str(r.id),
    name: str(r.name),
    email: str(r.email),
    role: r.role === 'admin' ? 'admin' : 'user',
    plan: (['Free', 'Studio', 'Scale'].includes(str(r.plan)) ? r.plan : 'Free') as User['plan'],
    status: r.status === 'suspended' ? 'suspended' : 'active',
    passwordHash: '', // never leaves Supabase auth
    createdAt: toMs(r.created_at),
    coins: num(r.coins, 0),
  }
}

function rowToDesign(r: Row): Design {
  return {
    id: str(r.id),
    ownerId: str(r.owner_id),
    name: str(r.name),
    kind: str(r.kind, 'hoodie') as Design['kind'],
    status: str(r.status, 'draft') as Design['status'],
    progress: num(r.progress),
    collectionId: r.collection_id ? str(r.collection_id) : undefined,
    updatedAt: toMs(r.updated_at),
  }
}

function rowToCollection(r: Row): Collection {
  return {
    id: str(r.id),
    ownerId: str(r.owner_id),
    name: str(r.name),
    season: str(r.season),
    status: str(r.status, 'draft') as Collection['status'],
    updatedAt: toMs(r.updated_at),
  }
}

function rowToTechPack(r: Row): TechPack {
  return {
    id: str(r.id),
    ownerId: str(r.owner_id),
    name: str(r.name),
    kind: str(r.kind, 'hoodie') as TechPack['kind'],
    status: str(r.status, 'draft') as TechPack['status'],
    manufacturer: r.manufacturer ? str(r.manufacturer) : undefined,
    pages: num(r.pages, 1),
    updatedAt: toMs(r.updated_at),
  }
}

function rowToOrder(r: Row): Order {
  return {
    id: str(r.id),
    ownerId: str(r.owner_id),
    designName: str(r.design_name),
    kind: str(r.kind, 'hoodie') as Order['kind'],
    qty: num(r.qty),
    manufacturer: str(r.manufacturer),
    country: str(r.country),
    stage: str(r.stage, 'sample') as Order['stage'],
    progress: num(r.progress),
    eta: str(r.eta),
  }
}

function rowToManufacturer(r: Row): Manufacturer {
  return {
    id: str(r.id),
    name: str(r.name),
    city: str(r.city),
    country: str(r.country),
    rating: num(r.rating),
    reviews: num(r.reviews),
    moq: num(r.moq),
    leadDays: num(r.lead_days),
    capabilities: Array.isArray(r.capabilities) ? (r.capabilities as string[]) : [],
    priceFrom: num(r.price_from),
    verified: Boolean(r.verified),
    saved: false, // client-only overlay — no column
  }
}

// ---------- entity → row ----------
const designToRow = (d: Design, ownerId: string): Row => ({
  id: d.id,
  owner_id: ownerId,
  name: d.name,
  kind: d.kind,
  status: d.status,
  progress: d.progress,
  collection_id: d.collectionId ?? null,
  updated_at: toIso(d.updatedAt),
})

const collectionToRow = (c: Collection, ownerId: string): Row => ({
  id: c.id,
  owner_id: ownerId,
  name: c.name,
  season: c.season,
  status: c.status,
  updated_at: toIso(c.updatedAt),
})

const techPackToRow = (t: TechPack, ownerId: string): Row => ({
  id: t.id,
  owner_id: ownerId,
  name: t.name,
  kind: t.kind,
  status: t.status,
  manufacturer: t.manufacturer ?? null,
  pages: t.pages,
  updated_at: toIso(t.updatedAt),
})

const orderToRow = (o: Order, ownerId: string): Row => ({
  id: o.id,
  owner_id: ownerId,
  design_name: o.designName,
  kind: o.kind,
  qty: o.qty,
  manufacturer: o.manufacturer || null,
  country: o.country || null,
  stage: o.stage,
  progress: o.progress,
  eta: o.eta || null,
})

// update-only rows (no id / owner / created_at)
const userToUpdateRow = (u: User): Row => ({
  name: u.name,
  email: u.email,
  role: u.role,
  plan: u.plan,
  status: u.status,
  coins: u.coins,
})

const manufacturerToUpdateRow = (m: Manufacturer): Row => ({
  name: m.name,
  city: m.city,
  country: m.country,
  rating: m.rating,
  reviews: m.reviews,
  moq: m.moq,
  lead_days: m.leadDays,
  capabilities: m.capabilities,
  price_from: m.priceFrom,
  verified: m.verified,
})

/** A neutral current-user profile used before/without a DB fetch. */
export function synthUser(s: SessionUser): User {
  return {
    id: s.id,
    name: s.name || s.email.split('@')[0] || 'You',
    email: s.email,
    role: 'user',
    plan: 'Free',
    status: 'active',
    passwordHash: '',
    createdAt: Date.now(),
    coins: 100,
  }
}

/** Read all data the signed-in user is allowed to see (RLS-scoped). */
export async function hydrate(sb: SupabaseClient, session: SessionUser): Promise<Partial<SuiteData>> {
  const [designs, collections, techPacks, orders, manufacturers, profiles] = await Promise.all([
    sb.from('designs').select('*'),
    sb.from('collections').select('*'),
    sb.from('tech_packs').select('*'),
    sb.from('orders').select('*'),
    sb.from('manufacturers').select('*'),
    sb.from('profiles').select('*'),
  ])

  const labelled: [string, { error: { message: string } | null }][] = [
    ['designs', designs],
    ['collections', collections],
    ['tech_packs', techPacks],
    ['orders', orders],
    ['manufacturers', manufacturers],
    ['profiles', profiles],
  ]
  labelled.forEach(([name, r]) => r.error && console.error(`[store] hydrate ${name}:`, r.error.message))

  const users = ((profiles.data as Row[] | null) ?? []).map(rowToUser)
  if (!users.some((u) => u.id === session.id)) users.unshift(synthUser(session))

  return {
    designs: ((designs.data as Row[] | null) ?? []).map(rowToDesign),
    collections: ((collections.data as Row[] | null) ?? []).map(rowToCollection),
    techPacks: ((techPacks.data as Row[] | null) ?? []).map(rowToTechPack),
    orders: ((orders.data as Row[] | null) ?? []).map(rowToOrder),
    manufacturers: ((manufacturers.data as Row[] | null) ?? []).map(rowToManufacturer),
    users,
  }
}

// ---------- reconcile ----------
type Identified = { id: string }

type QueryResult = { error: { message: string } | null }

/** Await a Supabase query builder and normalize it to an error message (or null). */
async function run(table: string, query: PromiseLike<QueryResult>): Promise<void> {
  const { error } = await query
  if (error) console.error(`[store] ${table}:`, error.message)
}

async function reconcileOwned<T extends Identified>(
  sb: SupabaseClient,
  table: string,
  prev: T[],
  next: T[],
  toRow: (item: T, ownerId: string) => Row,
  ownerId: string,
): Promise<void> {
  const prevById = new Map(prev.map((x) => [x.id, x]))
  const nextById = new Map(next.map((x) => [x.id, x]))

  const inserts = next.filter((n) => !prevById.has(n.id)).map((n) => toRow(n, ownerId))
  const deleteIds = prev.filter((p) => !nextById.has(p.id)).map((p) => p.id)
  const updates = next.filter((n) => {
    const p = prevById.get(n.id)
    return p && JSON.stringify(toRow(p, ownerId)) !== JSON.stringify(toRow(n, ownerId))
  })

  const ops: Promise<void>[] = []
  if (inserts.length) ops.push(run(table, sb.from(table).insert(inserts)))
  if (deleteIds.length) ops.push(run(table, sb.from(table).delete().in('id', deleteIds)))
  for (const u of updates) {
    const row = toRow(u, ownerId)
    delete row.id
    ops.push(run(table, sb.from(table).update(row).eq('id', u.id)))
  }
  await Promise.all(ops)
}

async function reconcileUpdateOnly<T extends Identified>(
  sb: SupabaseClient,
  table: string,
  prev: T[],
  next: T[],
  toRow: (item: T) => Row,
): Promise<void> {
  const prevById = new Map(prev.map((x) => [x.id, x]))
  const updates = next.filter((n) => {
    const p = prevById.get(n.id)
    return p && JSON.stringify(toRow(p)) !== JSON.stringify(toRow(n))
  })
  await Promise.all(updates.map((u) => run(table, sb.from(table).update(toRow(u)).eq('id', u.id))))
}

/** Persist the delta between two SuiteData snapshots for the current user. */
export async function reconcile(
  sb: SupabaseClient,
  prev: SuiteData,
  next: SuiteData,
  ownerId: string,
): Promise<void> {
  // collections first so a new design can reference a freshly-created collection
  await reconcileOwned(sb, 'collections', prev.collections, next.collections, collectionToRow, ownerId)
  await Promise.all([
    reconcileOwned(sb, 'designs', prev.designs, next.designs, designToRow, ownerId),
    reconcileOwned(sb, 'tech_packs', prev.techPacks, next.techPacks, techPackToRow, ownerId),
    reconcileOwned(sb, 'orders', prev.orders, next.orders, orderToRow, ownerId),
  ])
  await Promise.all([
    reconcileUpdateOnly(sb, 'profiles', prev.users, next.users, userToUpdateRow),
    reconcileUpdateOnly(sb, 'manufacturers', prev.manufacturers, next.manufacturers, manufacturerToUpdateRow),
  ])
}
