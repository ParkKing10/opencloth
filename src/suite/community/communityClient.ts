/**
 * Community 2.0 data layer — the Lounge (channel chat), the Feedback/Collab boards and the
 * weekly challenge. Dual-mode, mirroring accessoryClient's contract:
 *
 *  - Supabase mode: rows in `community_messages` / `community_posts` (shared across ALL users).
 *  - Fallback (no backend, or the tables aren't migrated yet): localStorage, seeded with the same
 *    starter content the migration inserts, so the community feels alive either way. Every
 *    Supabase call degrades to local on error.
 *
 * Run supabase/community.sql once to make chat + boards cross-user.
 */
import { supabase, isSupabaseConfigured } from '../../lib/supabase'

const SUPA = isSupabaseConfigured ? supabase : null
const CHAT_KEY = 'loom-community-chat-v1'
const POSTS_KEY = 'loom-community-posts-v1'
const CLAIM_KEY = 'loom-challenge-claimed-v1'

/* ── Types ─────────────────────────────────────────────────────────────────────────────── */

export type ChannelId = 'general' | 'feedback' | 'production' | 'collabs' | 'drops'
export const CHANNELS: ChannelId[] = ['general', 'feedback', 'production', 'collabs', 'drops']

export type ChatMessage = {
  id: string
  channel: string
  authorId: string
  authorName: string
  text: string
  createdAt: number
}

export type PostReply = {
  id: string
  authorId: string
  authorName: string
  text: string
  createdAt: number
}

export type PostKind = 'feedback' | 'collab'

/** Collab tags: 'seeking' / 'offering' + a topic; feedback posts may carry 'challenge'. */
export type CommunityPost = {
  id: string
  kind: PostKind
  authorId: string
  authorName: string
  title: string
  body: string
  image?: string
  tags: string[]
  replies: PostReply[]
  votes: number
  voterIds: string[]
  createdAt: number
}

export const COLLAB_TOPICS = ['collab-drop', 'manufacturer', 'photography', 'print', 'design-help', 'other'] as const

function rid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/* ── Seed content (mirrors supabase/community.sql so both modes start alive) ───────────── */

const HOUR = 3_600_000

function seedMessages(now: number): ChatMessage[] {
  return [
    { id: 'seed_m1', channel: 'general', authorId: 'seed_mika', authorName: 'Mika Okafor', text: 'Welcome to the lounge! Drop what you are working on this week 👇', createdAt: now - 26 * HOUR },
    { id: 'seed_m2', channel: 'general', authorId: 'seed_nora', authorName: 'Nora Bennett', text: 'Finishing a faded-wash capsule. The AI garment edit for acid wash is scary good.', createdAt: now - 25 * HOUR },
    { id: 'seed_m3', channel: 'general', authorId: 'seed_diego', authorName: 'Diego Salas', text: 'Same — used it on a selvedge jacket yesterday. Saved me a full sample round.', createdAt: now - 22 * HOUR },
    { id: 'seed_m4', channel: 'production', authorId: 'seed_elias', authorName: 'Elias Vandt', text: 'Anyone got a trusted manufacturer for small-batch shell jackets in Europe? MOQ under 100.', createdAt: now - 20 * HOUR },
    { id: 'seed_m5', channel: 'production', authorId: 'seed_sora', authorName: 'Sora Tanaka', text: '@Elias Vandt check the Manufacturers tab — the Porto factory did our 80-piece run, solid QC.', createdAt: now - 19 * HOUR },
    { id: 'seed_m6', channel: 'feedback', authorId: 'seed_priya', authorName: 'Priya Raman', text: 'Posted my knit hoodie on the feedback board — be brutal, the neckline feels off to me.', createdAt: now - 8 * HOUR },
    { id: 'seed_m7', channel: 'collabs', authorId: 'seed_mika', authorName: 'Mika Okafor', text: 'Looking for a brand to split a 200-piece drop with. Streetwear, EU shipping. Board post is up.', createdAt: now - 6 * HOUR },
    { id: 'seed_m8', channel: 'drops', authorId: 'seed_nora', authorName: 'Nora Bennett', text: 'Faded Archive vol. 2 goes live Friday. Lookbook was shot entirely with loom on-model renders.', createdAt: now - 3 * HOUR },
  ]
}

function seedPosts(now: number): CommunityPost[] {
  return [
    {
      id: 'seed_p1', kind: 'feedback', authorId: 'seed_priya', authorName: 'Priya Raman',
      title: 'Is this neckline too wide for a heavyweight knit?',
      body: 'Second iteration of my knit hoodie. The ribbed neckline reads too open to me on the front render — honest takes please.',
      tags: [], votes: 12, voterIds: [], createdAt: now - 9 * HOUR,
      replies: [{ id: 'seed_r1', authorId: 'seed_nora', authorName: 'Nora Bennett', text: 'Not too wide — but I would raise the rib height 2cm so it holds shape after washing.', createdAt: now - 7 * HOUR }],
    },
    {
      id: 'seed_p2', kind: 'feedback', authorId: 'seed_diego', authorName: 'Diego Salas',
      title: 'Back print placement — high or center?',
      body: 'Carpenter jacket, single back print. High between the shoulder blades feels premium, center feels more street. Votes?',
      tags: [], replies: [], votes: 8, voterIds: [], createdAt: now - 5 * HOUR,
    },
    {
      id: 'seed_p3', kind: 'collab', authorId: 'seed_mika', authorName: 'Mika Okafor',
      title: 'Split a 200-piece streetwear drop (EU)',
      body: 'I cover design + 50% of production. You bring audience + fulfilment. Revenue split 50/50, drop target in 6 weeks.',
      tags: ['seeking', 'collab-drop'], replies: [], votes: 15, voterIds: [], createdAt: now - 7 * HOUR,
    },
    {
      id: 'seed_p4', kind: 'collab', authorId: 'seed_sora', authorName: 'Sora Tanaka',
      title: 'Offering: technical flat drawings, 48h turnaround',
      body: 'Art director day-rate is off, but I take small flat-drawing jobs between projects. Portfolio on my profile.',
      tags: ['offering', 'design-help'], replies: [], votes: 9, voterIds: [], createdAt: now - 4 * HOUR,
    },
    {
      id: 'seed_p5', kind: 'collab', authorId: 'seed_elias', authorName: 'Elias Vandt',
      title: 'Seeking: lookbook photographer in Copenhagen',
      body: 'Two-day shoot, 12 outerwear pieces, studio + street. Paid, credits, and I will return the favour with tech packs.',
      tags: ['seeking', 'photography'], replies: [], votes: 6, voterIds: [], createdAt: now - 2 * HOUR,
    },
  ]
}

/* ── localStorage fallback ─────────────────────────────────────────────────────────────── */

function readLocal<T>(key: string, seed: () => T[]): T[] {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw) as T[]
  } catch {
    /* fall through to seed */
  }
  const seeded = seed()
  writeLocal(key, seeded)
  return seeded
}

function writeLocal<T>(key: string, list: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(list))
  } catch {
    try {
      // Quota pressure — drop the oldest half rather than losing the newest entries.
      localStorage.setItem(key, JSON.stringify(list.slice(0, Math.ceil(list.length / 2))))
    } catch {
      /* give up quietly */
    }
  }
}

const readChat = () => readLocal<ChatMessage>(CHAT_KEY, () => seedMessages(Date.now()))
const readPosts = () => readLocal<CommunityPost>(POSTS_KEY, () => seedPosts(Date.now()))

/* ── Supabase row mapping ──────────────────────────────────────────────────────────────── */

type Row = Record<string, unknown>
const str = (v: unknown, fb = ''): string => (v == null ? fb : String(v))
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])

function rowToMessage(r: Row): ChatMessage {
  return {
    id: str(r.id),
    channel: str(r.channel, 'general'),
    authorId: str(r.author_id),
    authorName: str(r.author_name, 'Member'),
    text: str(r.text),
    createdAt: Date.parse(str(r.created_at)) || Date.now(),
  }
}

function rowToPost(r: Row): CommunityPost {
  return {
    id: str(r.id),
    kind: (r.kind === 'collab' ? 'collab' : 'feedback') as PostKind,
    authorId: str(r.author_id),
    authorName: str(r.author_name, 'Member'),
    title: str(r.title),
    body: str(r.body),
    image: r.image ? str(r.image) : undefined,
    tags: arr<string>(r.tags),
    replies: arr<PostReply>(r.replies),
    votes: Number(r.votes ?? 0),
    voterIds: arr<string>(r.voter_ids),
    createdAt: Date.parse(str(r.created_at)) || Date.now(),
  }
}

/** True when the shared Supabase tables are reachable (i.e. the migration has been applied). */
export async function communityShared(): Promise<boolean> {
  if (!SUPA) return false
  try {
    const { error } = await SUPA.from('community_messages').select('id').limit(1)
    return !error
  } catch {
    return false
  }
}

/* ── Lounge chat ───────────────────────────────────────────────────────────────────────── */

export async function listMessages(channel: string): Promise<ChatMessage[]> {
  if (SUPA) {
    try {
      const { data, error } = await SUPA.from('community_messages')
        .select('*')
        .eq('channel', channel)
        .order('created_at', { ascending: true })
        .limit(300)
      if (error) throw error
      return (data as Row[]).map(rowToMessage)
    } catch {
      /* fall back to local */
    }
  }
  return readChat()
    .filter((m) => m.channel === channel)
    .sort((a, b) => a.createdAt - b.createdAt)
}

export async function sendMessage(input: {
  channel: string
  authorId: string
  authorName: string
  text: string
}): Promise<ChatMessage | null> {
  const text = input.text.trim().slice(0, 800)
  if (!text) return null
  const msg: ChatMessage = {
    id: rid('msg'),
    channel: input.channel,
    authorId: input.authorId,
    authorName: input.authorName,
    text,
    createdAt: Date.now(),
  }
  if (SUPA) {
    try {
      const { error } = await SUPA.from('community_messages').insert({
        id: msg.id,
        channel: msg.channel,
        author_id: msg.authorId,
        author_name: msg.authorName,
        text: msg.text,
        created_at: new Date(msg.createdAt).toISOString(),
      })
      if (error) throw error
      return msg
    } catch {
      /* fall back to local */
    }
  }
  writeLocal(CHAT_KEY, [...readChat(), msg])
  return msg
}

/* ── Boards (feedback + collab posts) ──────────────────────────────────────────────────── */

export async function listPosts(kind: PostKind): Promise<CommunityPost[]> {
  if (SUPA) {
    try {
      const { data, error } = await SUPA.from('community_posts')
        .select('*')
        .eq('kind', kind)
        .order('created_at', { ascending: false })
        .limit(120)
      if (error) throw error
      return (data as Row[]).map(rowToPost)
    } catch {
      /* fall back to local */
    }
  }
  return readPosts()
    .filter((p) => p.kind === kind)
    .sort((a, b) => b.createdAt - a.createdAt)
}

export async function createPost(input: {
  kind: PostKind
  authorId: string
  authorName: string
  title: string
  body: string
  image?: string
  tags: string[]
}): Promise<CommunityPost | null> {
  const title = input.title.trim().slice(0, 120)
  if (!title) return null
  const post: CommunityPost = {
    id: rid('post'),
    kind: input.kind,
    authorId: input.authorId,
    authorName: input.authorName,
    title,
    body: input.body.trim().slice(0, 1000),
    image: input.image ? await shrinkImage(input.image) : undefined,
    tags: input.tags,
    replies: [],
    votes: 0,
    voterIds: [],
    createdAt: Date.now(),
  }
  if (SUPA) {
    try {
      const { error } = await SUPA.from('community_posts').insert({
        id: post.id,
        kind: post.kind,
        author_id: post.authorId,
        author_name: post.authorName,
        title: post.title,
        body: post.body,
        image: post.image ?? null,
        tags: post.tags,
        replies: [],
        votes: 0,
        voter_ids: [],
        created_at: new Date(post.createdAt).toISOString(),
      })
      if (error) throw error
      return post
    } catch {
      /* fall back to local */
    }
  }
  writeLocal(POSTS_KEY, [post, ...readPosts()])
  return post
}

/** Read-modify-write helper shared by replies and votes; races are acceptable at this scale. */
async function patchPost(
  postId: string,
  change: (p: CommunityPost) => CommunityPost,
): Promise<CommunityPost | null> {
  if (SUPA) {
    try {
      const { data, error } = await SUPA.from('community_posts').select('*').eq('id', postId).single()
      if (error || !data) throw error ?? new Error('not found')
      const next = change(rowToPost(data as Row))
      const { error: upErr } = await SUPA.from('community_posts')
        .update({ replies: next.replies, votes: next.votes, voter_ids: next.voterIds })
        .eq('id', postId)
      if (upErr) throw upErr
      return next
    } catch {
      /* fall back to local */
    }
  }
  const all = readPosts()
  const idx = all.findIndex((p) => p.id === postId)
  if (idx === -1) return null
  const next = change(all[idx])
  all[idx] = next
  writeLocal(POSTS_KEY, all)
  return next
}

export async function addReply(
  postId: string,
  input: { authorId: string; authorName: string; text: string },
): Promise<CommunityPost | null> {
  const text = input.text.trim().slice(0, 600)
  if (!text) return null
  const reply: PostReply = { id: rid('re'), authorId: input.authorId, authorName: input.authorName, text, createdAt: Date.now() }
  return patchPost(postId, (p) => ({ ...p, replies: [...p.replies, reply] }))
}

export async function toggleVote(postId: string, userId: string): Promise<CommunityPost | null> {
  return patchPost(postId, (p) => {
    const has = p.voterIds.includes(userId)
    return {
      ...p,
      voterIds: has ? p.voterIds.filter((v) => v !== userId) : [...p.voterIds, userId],
      votes: Math.max(0, p.votes + (has ? -1 : 1)),
    }
  })
}

/* ── Image shrink (posts stay small: localStorage quota + light DB rows) ───────────────── */

/** Downscale a data-URL image for a post card. HTTP(S) URLs pass through untouched. */
export async function shrinkImage(src: string, maxDim = 640): Promise<string> {
  if (!src.startsWith('data:')) return src
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = () => rej(new Error('decode'))
      i.src = src
    })
    const longest = Math.max(img.width, img.height) || 1
    const scale = Math.min(1, maxDim / longest)
    if (scale >= 1 && src.length < 250_000) return src
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.width * scale))
    canvas.height = Math.max(1, Math.round(img.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) return src
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.85)
  } catch {
    return src
  }
}

/* ── Weekly challenge ──────────────────────────────────────────────────────────────────── */

export const CHALLENGE_REWARD = 150

const CHALLENGE_THEMES = ['varsity', 'denim', 'techrunner', 'monochrome', 'oversized', 'workwear', 'y2k', 'capsule'] as const

function isoWeek(d: Date): { year: number; week: number } {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
  return { year: date.getUTCFullYear(), week }
}

/** The current weekly challenge — id rotates every ISO week, theme cycles a fixed list. */
export function currentChallenge(): { id: string; themeKey: string } {
  const { year, week } = isoWeek(new Date())
  const theme = CHALLENGE_THEMES[week % CHALLENGE_THEMES.length]
  return { id: `${year}-w${String(week).padStart(2, '0')}`, themeKey: `chub.challenge.theme.${theme}` }
}

export function challengeClaimed(userId: string, challengeId: string): boolean {
  try {
    const all = JSON.parse(localStorage.getItem(CLAIM_KEY) || '{}') as Record<string, Record<string, boolean>>
    return Boolean(all[userId]?.[challengeId])
  } catch {
    return false
  }
}

export function markChallengeClaimed(userId: string, challengeId: string): void {
  try {
    const all = JSON.parse(localStorage.getItem(CLAIM_KEY) || '{}') as Record<string, Record<string, boolean>>
    all[userId] = { ...(all[userId] ?? {}), [challengeId]: true }
    localStorage.setItem(CLAIM_KEY, JSON.stringify(all))
  } catch {
    /* non-fatal */
  }
}

/** Deterministic "online now" figure — stable within the hour, believable range. */
export function onlineNow(): number {
  const h = new Date()
  const seed = h.getFullYear() * 1000 + h.getMonth() * 50 + h.getDate() + h.getHours()
  return 140 + (((seed * 2654435761) >>> 0) % 90)
}
