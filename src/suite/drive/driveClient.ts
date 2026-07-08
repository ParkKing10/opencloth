/**
 * THREADOS Drive — permanent, account-scoped asset storage.
 * Supabase mode: files land in the private 'drive' bucket ("<uid>/<folder>/<name>")
 * with a metadata row in drive_assets. Fallback mode: small files persist as data
 * URLs in localStorage so the feature works without a backend.
 */
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { uid } from '../data/utils'

export const DRIVE_FOLDERS = [
  'My Logos',
  'Graphics',
  'Fonts',
  'Patterns',
  'Textures',
  'Labels',
  'Packaging',
  'Mockups',
  'AI Generations',
  'References',
  'Collections',
  'Brand Assets',
] as const

export type DriveFolder = (typeof DRIVE_FOLDERS)[number]

export type DriveAsset = {
  id: string
  name: string
  folder: DriveFolder
  mime: string
  sizeBytes: number
  /** Renderable URL (signed URL in Supabase mode, data URL in fallback). */
  url: string
  createdAt: number
}

const SUPA = isSupabaseConfigured ? supabase : null
const LOCAL_KEY = 'threados-drive-v1'
const LOCAL_MAX_BYTES = 1.5 * 1024 * 1024 // keep localStorage safe

/** Auto-categorize an upload by its file type (vision: SVG→Logo, PNG→Artwork, …). */
export function categorize(filename: string, mime: string): DriveFolder {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'svg') return 'My Logos'
  if (ext === 'png' || ext === 'webp') return 'Graphics'
  if (ext === 'dxf') return 'Patterns'
  if (ext === 'ttf' || ext === 'otf' || ext === 'woff' || ext === 'woff2') return 'Fonts'
  if (ext === 'jpg' || ext === 'jpeg') return 'References'
  if (ext === 'ai' || ext === 'pdf') return 'Brand Assets'
  if (mime.startsWith('image/')) return 'Graphics'
  if (mime.startsWith('font/')) return 'Fonts'
  return 'Graphics'
}

// ---------- fallback (localStorage) ----------
type LocalAsset = Omit<DriveAsset, 'url'> & { dataUrl: string }

function readLocal(): LocalAsset[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    return raw ? (JSON.parse(raw) as LocalAsset[]) : []
  } catch {
    return []
  }
}

function writeLocal(assets: LocalAsset[]): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(assets))
  } catch {
    /* quota — drop oldest and retry once */
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(assets.slice(0, 12)))
    } catch {
      /* give up quietly */
    }
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('read failed'))
    reader.readAsDataURL(file)
  })
}

// ---------- public API ----------
export type DriveResult<T> = { ok: true; value: T } | { ok: false; error: string }

async function currentUserId(): Promise<string | null> {
  if (!SUPA) return null
  const {
    data: { session },
  } = await SUPA.auth.getSession()
  return session?.user.id ?? null
}

/** List every asset the signed-in user owns, newest first. */
export async function listAssets(): Promise<DriveAsset[]> {
  if (SUPA) {
    const userId = await currentUserId()
    if (!userId) return []
    const { data, error } = await SUPA.from('drive_assets').select('*').order('created_at', { ascending: false })
    if (error || !data) {
      if (error) console.error('[drive] list:', error.message)
      return []
    }
    // one signed URL batch for all paths (1h validity — plenty for a session)
    const paths = data.map((r) => r.storage_path as string)
    const { data: signed } = paths.length
      ? await SUPA.storage.from('drive').createSignedUrls(paths, 3600)
      : { data: [] as { path: string | null; signedUrl: string }[] }
    const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]))
    return data.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      folder: (r.folder as DriveFolder) ?? 'Graphics',
      mime: String(r.mime ?? ''),
      sizeBytes: Number(r.size_bytes ?? 0),
      url: urlByPath.get(r.storage_path as string) ?? '',
      createdAt: Date.parse(String(r.created_at)),
    }))
  }
  return readLocal().map(({ dataUrl, ...a }) => ({ ...a, url: dataUrl }))
}

/** Upload one file: storage object + metadata row (or local data URL). */
export async function uploadAsset(file: File, folderOverride?: DriveFolder): Promise<DriveResult<DriveAsset>> {
  const folder = folderOverride ?? categorize(file.name, file.type)

  if (SUPA) {
    const userId = await currentUserId()
    if (!userId) return { ok: false, error: 'Sign in to upload to Drive.' }
    const safeName = file.name.replace(/[^\w.\-() ]+/g, '_')
    const path = `${userId}/${folder}/${Date.now().toString(36)}-${safeName}`
    const up = await SUPA.storage.from('drive').upload(path, file, { contentType: file.type || undefined })
    if (up.error) return { ok: false, error: up.error.message }
    const { data: row, error } = await SUPA.from('drive_assets')
      .insert({
        owner_id: userId,
        name: file.name,
        folder,
        mime: file.type,
        size_bytes: file.size,
        storage_path: path,
      })
      .select('*')
      .single()
    if (error || !row) {
      // roll the orphaned object back so storage stays consistent
      await SUPA.storage.from('drive').remove([path])
      return { ok: false, error: error?.message ?? 'Could not save the asset.' }
    }
    const { data: signed } = await SUPA.storage.from('drive').createSignedUrl(path, 3600)
    return {
      ok: true,
      value: {
        id: String(row.id),
        name: file.name,
        folder,
        mime: file.type,
        sizeBytes: file.size,
        url: signed?.signedUrl ?? '',
        createdAt: Date.now(),
      },
    }
  }

  if (file.size > LOCAL_MAX_BYTES) {
    return { ok: false, error: 'File too large for offline Drive (max 1.5 MB). Connect Supabase for full storage.' }
  }
  const dataUrl = await fileToDataUrl(file)
  const asset: LocalAsset = {
    id: uid('a'),
    name: file.name,
    folder,
    mime: file.type,
    sizeBytes: file.size,
    dataUrl,
    createdAt: Date.now(),
  }
  writeLocal([asset, ...readLocal()])
  return { ok: true, value: { ...asset, url: dataUrl } }
}

/** Delete an asset (metadata + stored object). */
export async function deleteAsset(asset: DriveAsset): Promise<DriveResult<null>> {
  if (SUPA) {
    const { data: row } = await SUPA.from('drive_assets').select('storage_path').eq('id', asset.id).maybeSingle()
    const { error } = await SUPA.from('drive_assets').delete().eq('id', asset.id)
    if (error) return { ok: false, error: error.message }
    if (row?.storage_path) await SUPA.storage.from('drive').remove([String(row.storage_path)])
    return { ok: true, value: null }
  }
  writeLocal(readLocal().filter((a) => a.id !== asset.id))
  return { ok: true, value: null }
}
