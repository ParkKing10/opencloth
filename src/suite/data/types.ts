/** Shared domain model for the whole suite + admin. */

export type Role = 'user' | 'admin'

export type User = {
  id: string
  name: string
  email: string
  role: Role
  plan: 'Free' | 'Studio' | 'Scale'
  status: 'active' | 'suspended'
  /** SHA-256 hex of the password — never stored in plaintext. */
  passwordHash: string
  createdAt: number
  coins: number
}

export type GarmentKind = 'hoodie' | 'tee' | 'jacket' | 'pants' | 'cap'

export type DesignStatus = 'draft' | 'in_review' | 'approved'

export type Design = {
  id: string
  ownerId: string
  name: string
  kind: GarmentKind
  status: DesignStatus
  progress: number
  collectionId?: string
  updatedAt: number
}

export type Collection = {
  id: string
  ownerId: string
  name: string
  season: string
  status: 'draft' | 'active' | 'published'
  updatedAt: number
}

export type TechPackStatus = 'draft' | 'in_review' | 'ready'

export type TechPack = {
  id: string
  ownerId: string
  name: string
  kind: GarmentKind
  status: TechPackStatus
  manufacturer?: string
  pages: number
  updatedAt: number
}

export type Manufacturer = {
  id: string
  name: string
  city: string
  country: string
  rating: number
  reviews: number
  moq: number
  leadDays: number
  capabilities: string[]
  priceFrom: number
  verified: boolean
  saved: boolean
}

export type OrderStage = 'sample' | 'production' | 'qc' | 'shipping' | 'delivered'

export type Order = {
  id: string
  ownerId: string
  designName: string
  kind: GarmentKind
  qty: number
  manufacturer: string
  country: string
  stage: OrderStage
  progress: number
  eta: string
}

export type AppNotification = {
  id: string
  title: string
  body: string
  tone: 'accent' | 'info' | 'success'
  time: string
  read: boolean
}

export type SuiteData = {
  designs: Design[]
  collections: Collection[]
  techPacks: TechPack[]
  manufacturers: Manufacturer[]
  orders: Order[]
  notifications: AppNotification[]
  users: User[]
}
