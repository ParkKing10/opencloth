import type { SuiteData, User } from './types'

/**
 * Initial data. Passwords are seeded as SHA-256 of the plaintext below so the
 * demo accounts can log in. (Demo only — real auth belongs on a server.)
 *   user:  mike@threados.com  / threados
 *   admin: admin@threados.com / threados
 */
export const DEMO_CREDENTIALS = {
  user: { email: 'mike@threados.com', password: 'threados' },
  admin: { email: 'admin@threados.com', password: 'threados' },
}

// SHA-256("threados")
const PW_THREADOS = '3b0eb3e4e23ad30ef3f5218a4fb73759cbcc429ee39571ab45b74d2b9adb39fa'

const now = Date.now()
const h = (n: number) => now - n * 3600_000
const d = (n: number) => now - n * 86_400_000

export const SEED_USERS: User[] = [
  {
    id: 'u_mike',
    name: 'Mike Carter',
    email: 'mike@threados.com',
    role: 'user',
    plan: 'Studio',
    status: 'active',
    passwordHash: PW_THREADOS,
    createdAt: d(120),
    coins: 12540,
  },
  {
    id: 'u_admin',
    name: 'Ava Reyes',
    email: 'admin@threados.com',
    role: 'admin',
    plan: 'Scale',
    status: 'active',
    passwordHash: PW_THREADOS,
    createdAt: d(300),
    coins: 99999,
  },
  {
    id: 'u_jordan',
    name: 'Jordan Diaz',
    email: 'jordan@atelier-nord.co',
    role: 'user',
    plan: 'Studio',
    status: 'active',
    passwordHash: PW_THREADOS,
    createdAt: d(64),
    coins: 3200,
  },
  {
    id: 'u_amara',
    name: 'Amara Lowe',
    email: 'amara@studio-atlas.io',
    role: 'user',
    plan: 'Free',
    status: 'active',
    passwordHash: PW_THREADOS,
    createdAt: d(28),
    coins: 400,
  },
  {
    id: 'u_kai',
    name: 'Kai Petrov',
    email: 'kai@driftsupply.co',
    role: 'user',
    plan: 'Scale',
    status: 'suspended',
    passwordHash: PW_THREADOS,
    createdAt: d(210),
    coins: 8800,
  },
]

export function buildSeed(): SuiteData {
  return {
    users: SEED_USERS,
    designs: [
      { id: 'd1', ownerId: 'u_mike', name: 'Vintage Washed Hoodie', kind: 'hoodie', status: 'approved', progress: 82, collectionId: 'c1', updatedAt: h(2) },
      { id: 'd2', ownerId: 'u_mike', name: 'Oversized Street Tee', kind: 'tee', status: 'in_review', progress: 64, collectionId: 'c1', updatedAt: d(1) },
      { id: 'd3', ownerId: 'u_mike', name: 'Cargo Pocket Jacket', kind: 'jacket', status: 'draft', progress: 38, collectionId: 'c2', updatedAt: d(2) },
      { id: 'd4', ownerId: 'u_mike', name: 'Baggy Cargo Pants', kind: 'pants', status: 'draft', progress: 21, collectionId: 'c2', updatedAt: d(3) },
      { id: 'd5', ownerId: 'u_mike', name: 'Washed Cap', kind: 'cap', status: 'approved', progress: 100, updatedAt: d(4) },
    ],
    collections: [
      { id: 'c1', ownerId: 'u_mike', name: 'SS26 — Concrete Series', season: 'SS26', status: 'active', updatedAt: h(6) },
      { id: 'c2', ownerId: 'u_mike', name: 'Utility — Cargo Drop', season: 'FW25', status: 'draft', updatedAt: d(2) },
      { id: 'c3', ownerId: 'u_mike', name: 'Baseline — Everyday Tees', season: 'CORE', status: 'published', updatedAt: d(9) },
    ],
    techPacks: [
      { id: 't1', ownerId: 'u_mike', name: 'Vintage Washed Hoodie', kind: 'hoodie', status: 'ready', manufacturer: 'Atelier Norte', pages: 12, updatedAt: h(2) },
      { id: 't2', ownerId: 'u_mike', name: 'Oversized Street Tee', kind: 'tee', status: 'in_review', manufacturer: 'Bosphorus Mills', pages: 8, updatedAt: d(1) },
      { id: 't3', ownerId: 'u_mike', name: 'Cargo Pocket Jacket', kind: 'jacket', status: 'draft', pages: 5, updatedAt: d(2) },
      { id: 't4', ownerId: 'u_mike', name: 'Baggy Cargo Pants', kind: 'pants', status: 'ready', manufacturer: 'Saigon Craft Co.', pages: 14, updatedAt: d(3) },
    ],
    manufacturers: [
      { id: 'm1', name: 'Atelier Norte', city: 'Porto', country: 'Portugal', rating: 4.9, reviews: 128, moq: 50, leadDays: 18, capabilities: ['Knitwear', 'Cut & Sew'], priceFrom: 14, verified: true, saved: false },
      { id: 'm2', name: 'Bosphorus Mills', city: 'Istanbul', country: 'Turkey', rating: 4.8, reviews: 214, moq: 100, leadDays: 16, capabilities: ['Cut & Sew', 'Knitwear', 'Accessories'], priceFrom: 9, verified: true, saved: false },
      { id: 'm3', name: 'Saigon Craft Co.', city: 'Ho Chi Minh City', country: 'Vietnam', rating: 4.7, reviews: 96, moq: 150, leadDays: 24, capabilities: ['Outerwear', 'Cut & Sew'], priceFrom: 21, verified: true, saved: false },
      { id: 'm4', name: 'Milano Forma', city: 'Milan', country: 'Italy', rating: 5.0, reviews: 74, moq: 30, leadDays: 28, capabilities: ['Outerwear', 'Denim'], priceFrom: 46, verified: true, saved: true },
      { id: 'm5', name: 'Canton Thread Works', city: 'Guangzhou', country: 'China', rating: 4.6, reviews: 331, moq: 300, leadDays: 20, capabilities: ['Cut & Sew', 'Knitwear', 'Accessories'], priceFrom: 7, verified: true, saved: false },
      { id: 'm6', name: 'Indigo House Denim', city: 'Ahmedabad', country: 'India', rating: 4.8, reviews: 152, moq: 200, leadDays: 26, capabilities: ['Denim', 'Cut & Sew'], priceFrom: 16, verified: true, saved: false },
    ],
    orders: [
      { id: 'o1', ownerId: 'u_mike', designName: 'Boxy Fit Wool Overshirt', kind: 'jacket', qty: 60, manufacturer: 'Atlas Garment Co.', country: 'Portugal', stage: 'sample', progress: 25, eta: 'Jul 22' },
      { id: 'o2', ownerId: 'u_mike', designName: 'Baggy Cargo Pants', kind: 'pants', qty: 250, manufacturer: 'Saigon Craft Co.', country: 'Vietnam', stage: 'production', progress: 68, eta: 'Aug 09' },
      { id: 'o3', ownerId: 'u_mike', designName: 'Vintage Washed Hoodie', kind: 'hoodie', qty: 500, manufacturer: 'Atelier Norte', country: 'Portugal', stage: 'production', progress: 54, eta: 'Aug 12' },
      { id: 'o4', ownerId: 'u_mike', designName: 'Cargo Pocket Jacket', kind: 'jacket', qty: 320, manufacturer: 'Milano Forma', country: 'Italy', stage: 'qc', progress: 90, eta: 'Jul 18' },
      { id: 'o5', ownerId: 'u_mike', designName: 'Oversized Street Tee', kind: 'tee', qty: 1200, manufacturer: 'Canton Thread Works', country: 'China', stage: 'shipping', progress: 96, eta: 'Jul 24' },
      { id: 'o6', ownerId: 'u_mike', designName: 'Washed Cap', kind: 'cap', qty: 800, manufacturer: 'Bosphorus Mills', country: 'Turkey', stage: 'delivered', progress: 100, eta: 'Delivered' },
    ],
    notifications: [
      { id: 'n1', title: 'Your tech pack is ready', body: 'Vintage Washed Hoodie tech pack has been generated.', tone: 'accent', time: '2h', read: false },
      { id: 'n2', title: 'Manufacturer matched', body: 'We found 3 manufacturers for “Oversized Street Tee”.', tone: 'info', time: '5h', read: false },
      { id: 'n3', title: 'Sample approved', body: 'Your sample for “Cargo Pocket Jacket” has been approved.', tone: 'success', time: '1d', read: true },
    ],
  }
}
