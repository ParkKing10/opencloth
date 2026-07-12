/**
 * Garment Library data layer. Supabase mode: files land in the private 'garments'
 * bucket ("<packId>/<slug>/<file>") with rows in garment_packs / garment_templates
 * / garment_representations. Fallback mode: metadata + thumbnail data-URLs persist
 * in localStorage so the catalog works without a backend (originals are skipped —
 * localStorage can't hold them). Mirrors driveClient's dual-mode contract.
 */
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import type {
  DetectedGarment,
  ExtractedFile,
  Garment,
  GarmentCategory,
  GarmentCategoryId,
  GarmentRepresentation,
  GarmentResult,
  GarmentViews,
  RepresentationKind,
} from './types'
import { CATEGORIES, EMPTY_VIEWS, isKnownCategory, titleCaseCategory, toCategoryId } from './types'
import { classifyExt, pickPreviewSource } from './import/detect'
import { generatePreview } from './import/preview'
import { builtinGarments, builtinGarmentDisplaySvg, isBuiltinGarmentId } from './builtinGarments'
import { loadTracedGarments, tracedGarmentSvgUrl, isTracedGarmentId } from './tracedGarments'

const SUPA = isSupabaseConfigured ? supabase : null
const BUCKET = 'garments'
const LOCAL_KEY = 'threados-garments-v1'
const LOCAL_CATS_KEY = 'threados-garment-categories-v1'

/**
 * When false, the catalog is composed EXCLUSIVELY of admin-uploaded garments — the built-in template
 * catalog and the traced base library are hidden everywhere (Library, Studio picker, Shop). This is
 * the "work only with my own uploaded templates" mode. Flip to true to restore the base library.
 * (getGarment/loadGarmentDisplay still resolve built-in/traced ids so any old references keep working.)
 */
const INCLUDE_BASE_LIBRARY = false

type Row = Record<string, unknown>
const str = (v: unknown, f = ''): string => (v == null ? f : String(v))
const num = (v: unknown, f = 0): number => (v == null ? f : Number(v))

/** Coerce a stored jsonb value into a complete GarmentViews (old rows may lack it). */
function toViews(v: unknown): GarmentViews {
  const o = (v && typeof v === 'object' ? v : {}) as Partial<GarmentViews>
  return {
    front: !!o.front,
    back: !!o.back,
    combinedFrontBack: !!o.combinedFrontBack,
    side: !!o.side,
    details: !!o.details,
    has3D: !!o.has3D,
  }
}

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  ai: 'application/postscript',
  dxf: 'image/vnd.dxf',
  ttf: 'font/ttf',
  otf: 'font/otf',
}

const safeName = (name: string): string => name.replace(/[^\w.\-() ]+/g, '_')

function slugFor(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  const suffix = Math.random().toString(36).slice(2, 6)
  return `${base || 'garment'}-${suffix}`
}

/** Map a file to a PRD-2 representation kind. */
function repKind(ext: string, isPreviewSource: boolean): RepresentationKind {
  if (isPreviewSource) return 'preview'
  const cls = classifyExt(ext)
  if (cls === 'document' || cls === 'vector') return 'master'
  return 'source'
}

async function currentUserId(): Promise<string | null> {
  if (!SUPA) return null
  const {
    data: { session },
  } = await SUPA.auth.getSession()
  return session?.user.id ?? null
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('read failed'))
    reader.readAsDataURL(blob)
  })
}

// ---------- fallback (localStorage) ----------
type LocalGarment = Omit<Garment, 'thumbUrl' | 'representations'> & { thumbDataUrl: string }

function readLocal(): LocalGarment[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    return raw ? (JSON.parse(raw) as LocalGarment[]) : []
  } catch {
    return []
  }
}
function writeLocal(list: LocalGarment[]): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list))
  } catch {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(list.slice(0, 40)))
    } catch {
      /* give up quietly */
    }
  }
}

// ---------- list ----------
function rowToGarment(r: Row, thumbUrl: string): Garment {
  return {
    id: str(r.id),
    name: str(r.name),
    slug: str(r.slug),
    category: (str(r.category, 'other') as GarmentCategoryId) || 'other',
    status: (str(r.status, 'published') as Garment['status']) || 'published',
    vendor: str(r.vendor),
    tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
    thumbUrl,
    createdAt: Date.parse(str(r.created_at)) || Date.now(),
    views: toViews(r.views),
    price: num(r.price),
  }
}

/**
 * List catalog garments. The built-in template catalog (90+ editable pieces) is ALWAYS included —
 * it's the platform's base library — followed by any admin-uploaded packs (Supabase or local).
 */
export async function listGarments(): Promise<Garment[]> {
  const base = INCLUDE_BASE_LIBRARY ? [...(await loadTracedGarments()), ...builtinGarments()] : []
  if (SUPA) {
    const { data, error } = await SUPA.from('garment_templates').select('*').order('created_at', { ascending: false })
    if (error || !data) {
      if (error) console.error('[garments] list:', error.message)
      return base
    }
    const paths = data.map((r) => str(r.thumb_path)).filter(Boolean)
    const { data: signed } = paths.length
      ? await SUPA.storage.from(BUCKET).createSignedUrls(paths, 3600)
      : { data: [] as { path: string | null; signedUrl: string }[] }
    const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]))
    const uploaded = (data as Row[]).map((r) => rowToGarment(r, urlByPath.get(str(r.thumb_path)) ?? ''))
    return [...uploaded, ...base]
  }
  const local = readLocal().map((g) => {
    const { thumbDataUrl, ...rest } = g
    return { ...rest, thumbUrl: thumbDataUrl, views: rest.views ?? EMPTY_VIEWS, price: rest.price ?? 0 }
  })
  return [...local, ...base]
}

/** Load one garment with its representations (signed URLs). Used by the detail view. */
export async function getGarment(id: string): Promise<Garment | null> {
  if (isBuiltinGarmentId(id)) return builtinGarments().find((g) => g.id === id) ?? null
  if (isTracedGarmentId(id)) return (await loadTracedGarments()).find((g) => g.id === id) ?? null
  if (SUPA) {
    const { data: g } = await SUPA.from('garment_templates').select('*').eq('id', id).maybeSingle()
    if (!g) return null
    const { data: reps } = await SUPA.from('garment_representations').select('*').eq('garment_id', id)
    const repRows = (reps as Row[] | null) ?? []
    const paths = [str(g.thumb_path), ...repRows.map((r) => str(r.storage_path))].filter(Boolean)
    const { data: signed } = paths.length
      ? await SUPA.storage.from(BUCKET).createSignedUrls(paths, 3600)
      : { data: [] as { path: string | null; signedUrl: string }[] }
    const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]))
    const representations: GarmentRepresentation[] = repRows.map((r) => ({
      id: str(r.id),
      kind: str(r.kind, 'source') as RepresentationKind,
      format: str(r.format),
      storagePath: str(r.storage_path),
      bytes: num(r.bytes),
      url: urlByPath.get(str(r.storage_path)) ?? '',
    }))
    const garment = rowToGarment(g, urlByPath.get(str(g.thumb_path)) ?? '')
    return { ...garment, representations }
  }
  const local = readLocal().find((g) => g.id === id)
  if (!local) return null
  const { thumbDataUrl, ...rest } = local
  return { ...rest, thumbUrl: thumbDataUrl, views: rest.views ?? EMPTY_VIEWS, price: rest.price ?? 0, representations: [] }
}

/** Strip scripts / event handlers / js-hrefs so an admin-uploaded SVG can be inlined safely. */
function sanitizeSvg(raw: string): string | null {
  try {
    const doc = new DOMParser().parseFromString(raw, 'image/svg+xml')
    if (doc.querySelector('parsererror')) return null
    const svg = doc.querySelector('svg')
    if (!svg) return null
    doc.querySelectorAll('script, foreignObject').forEach((n) => n.remove())
    doc.querySelectorAll('*').forEach((el) => {
      for (const attr of [...el.attributes]) {
        const name = attr.name.toLowerCase()
        const val = attr.value.trim().toLowerCase()
        if (name.startsWith('on')) el.removeAttribute(attr.name)
        if ((name === 'href' || name === 'xlink:href') && val.startsWith('javascript:')) el.removeAttribute(attr.name)
      }
    })
    return new XMLSerializer().serializeToString(svg)
  } catch {
    return null
  }
}

/**
 * Best on-canvas display source for a garment: a crisp inline VECTOR (SVG) when the
 * pack has one — perfect at any zoom — otherwise the FULL-RESOLUTION raster (not the
 * small thumbnail). Falls back to the thumbnail.
 */
export async function loadGarmentDisplay(garmentId: string): Promise<{ svg?: string; imageUrl?: string }> {
  if (isBuiltinGarmentId(garmentId)) {
    const svg = builtinGarmentDisplaySvg(garmentId)
    if (svg) return { svg }
  }
  if (isTracedGarmentId(garmentId)) {
    try {
      const res = await fetch(tracedGarmentSvgUrl(garmentId))
      const clean = res.ok ? sanitizeSvg(await res.text()) : null
      if (clean) return { svg: clean }
    } catch {
      /* fall through to imageUrl */
    }
    return { imageUrl: tracedGarmentSvgUrl(garmentId) }
  }
  const g = await getGarment(garmentId)
  const reps = g?.representations ?? []
  const svgRep = reps.find((r) => r.format === 'svg' && r.url)
  if (svgRep?.url) {
    try {
      const res = await fetch(svgRep.url)
      const clean = res.ok ? sanitizeSvg(await res.text()) : null
      if (clean) return { svg: clean }
    } catch {
      /* CORS or fetch failure → fall through to a raster */
    }
  }
  const raster = reps.find((r) => (r.format === 'png' || r.format === 'webp') && r.kind !== 'thumbnail' && r.url)
  return { imageUrl: raster?.url ?? g?.thumbUrl ?? '' }
}

// ---------- publish ----------
export type PublishOutcome = { published: Garment[]; failed: { name: string; error: string }[] }

async function uploadOne(path: string, blob: Blob, ext: string): Promise<GarmentResult<null>> {
  if (!SUPA) return { ok: false, error: 'no backend' }
  const contentType = blob.type || MIME_BY_EXT[ext] || undefined
  const up = await SUPA.storage.from(BUCKET).upload(path, blob, { contentType, upsert: false })
  return up.error ? { ok: false, error: up.error.message } : { ok: true, value: null }
}

/**
 * Persist the admin-confirmed garments. Each included garment uploads its files +
 * thumbnail, then writes template + representation rows. A garment that fails is
 * rolled back individually (its storage objects removed) and reported; others still land.
 */
export async function publishGarments(
  detected: DetectedGarment[],
  meta: { packName: string; sourceName: string },
): Promise<PublishOutcome> {
  const included = detected.filter((d) => d.include)
  const published: Garment[] = []
  const failed: { name: string; error: string }[] = []

  if (SUPA) {
    const userId = await currentUserId()
    if (!userId) return { published: [], failed: [{ name: meta.packName, error: 'Sign in as an admin to publish.' }] }

    // Guarantee every referenced category row exists (custom categories) before the FK insert.
    for (const cat of Array.from(new Set(included.map((d) => d.category)))) await ensureCategory(cat)

    const fileCount = included.reduce((n, d) => n + d.files.length, 0)
    const { data: pack } = await SUPA.from('garment_packs')
      .insert({
        uploaded_by: userId,
        name: meta.packName,
        source_name: meta.sourceName,
        file_count: fileCount,
        garment_count: included.length,
        status: 'imported',
      })
      .select('id')
      .single()
    const packId = pack ? str(pack.id) : null

    for (const d of included) {
      const slug = slugFor(d.name)
      const base = `${packId ?? 'loose'}/${slug}`
      const uploaded: string[] = []
      try {
        // thumbnail
        if (d.previewBlob) {
          const tp = `${base}/_thumb.png`
          const r = await uploadOne(tp, d.previewBlob, 'png')
          if (!r.ok) throw new Error(r.error)
          uploaded.push(tp)
        }
        // original files (dedupe basenames). The chosen preview source becomes the
        // 'preview' (or 'combined_front_back') representation; the rest are master/source.
        const previewSourceName = pickPreviewSource(d.files)?.name ?? ''
        const seen = new Set<string>()
        const repRows: Row[] = []
        for (const f of d.files) {
          const isPreview = f.name === previewSourceName
          let fname = safeName(f.name)
          if (seen.has(fname)) fname = `${seen.size}-${fname}`
          seen.add(fname)
          const fp = `${base}/${fname}`
          const r = await uploadOne(fp, f.blob, f.ext)
          if (!r.ok) throw new Error(r.error)
          uploaded.push(fp)
          repRows.push({
            kind: isPreview && d.views.combinedFrontBack ? 'combined_front_back' : repKind(f.ext, isPreview),
            format: f.ext || 'bin',
            storage_path: fp,
            bytes: f.bytes,
          })
        }

        const search = `${d.name} ${d.category} ${d.files.map((f) => f.name).join(' ')}`.toLowerCase()
        const thumbPath = d.previewBlob ? `${base}/_thumb.png` : null
        const { data: gRow, error: gErr } = await SUPA.from('garment_templates')
          .insert({
            pack_id: packId,
            created_by: userId,
            name: d.name,
            slug,
            category: d.category,
            status: 'published',
            search_text: search,
            thumb_path: thumbPath,
            views: d.views,
            price: Math.max(0, Math.round(d.price)),
          })
          .select('*')
          .single()
        if (gErr || !gRow) throw new Error(gErr?.message ?? 'Could not save garment.')

        // representation rows (thumbnail + files)
        const allReps = [
          ...(thumbPath ? [{ kind: 'thumbnail', format: 'png', storage_path: thumbPath, bytes: d.previewBlob?.size ?? 0 }] : []),
          ...repRows,
        ].map((r) => ({ ...r, garment_id: gRow.id }))
        if (allReps.length) {
          const { error: rErr } = await SUPA.from('garment_representations').insert(allReps)
          if (rErr) throw new Error(rErr.message)
        }

        const { data: signed } = thumbPath
          ? await SUPA.storage.from(BUCKET).createSignedUrl(thumbPath, 3600)
          : { data: null }
        published.push(rowToGarment(gRow, signed?.signedUrl ?? d.previewUrl))
      } catch (err: unknown) {
        if (uploaded.length) await SUPA.storage.from(BUCKET).remove(uploaded)
        failed.push({ name: d.name, error: err instanceof Error ? err.message : 'Publish failed.' })
      }
    }

    if (packId) {
      await SUPA.from('garment_packs').update({ garment_count: published.length }).eq('id', packId)
    }
    return { published, failed }
  }

  // fallback: keep metadata + thumbnail only
  const existing = readLocal()
  for (const d of included) {
    try {
      const thumbDataUrl = d.previewBlob ? await blobToDataUrl(d.previewBlob) : ''
      const g: LocalGarment = {
        id: `lg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        name: d.name,
        slug: slugFor(d.name),
        category: d.category,
        status: 'published',
        vendor: '',
        tags: [],
        createdAt: Date.now(),
        views: d.views,
        price: Math.max(0, Math.round(d.price)),
        thumbDataUrl,
      }
      existing.unshift(g)
      const { thumbDataUrl: t, ...rest } = g
      published.push({ ...rest, thumbUrl: t })
    } catch {
      failed.push({ name: d.name, error: 'Could not store garment offline.' })
    }
  }
  writeLocal(existing)
  return { published, failed }
}

// ---------- mutate ----------
export async function updateGarment(
  id: string,
  patch: { name?: string; category?: GarmentCategoryId; status?: Garment['status'] },
): Promise<GarmentResult<null>> {
  if (SUPA) {
    const row: Row = { updated_at: new Date().toISOString() }
    if (patch.name != null) row.name = patch.name
    if (patch.category != null) row.category = patch.category
    if (patch.status != null) row.status = patch.status
    const { error } = await SUPA.from('garment_templates').update(row).eq('id', id)
    return error ? { ok: false, error: error.message } : { ok: true, value: null }
  }
  writeLocal(readLocal().map((g) => (g.id === id ? { ...g, ...patch } : g)))
  return { ok: true, value: null }
}

export async function deleteGarment(id: string): Promise<GarmentResult<null>> {
  // Built-in / traced catalog garments come from code + files, not storage — can't be deleted here.
  if (isBuiltinGarmentId(id) || isTracedGarmentId(id)) return { ok: false, error: 'Catalog templates cannot be deleted.' }
  if (SUPA) {
    const { data: reps } = await SUPA.from('garment_representations').select('storage_path').eq('garment_id', id)
    const { data: g } = await SUPA.from('garment_templates').select('thumb_path').eq('id', id).maybeSingle()
    const paths = [
      ...((reps as Row[] | null) ?? []).map((r) => str(r.storage_path)),
      ...(g?.thumb_path ? [str(g.thumb_path)] : []),
    ].filter(Boolean)
    const { error } = await SUPA.from('garment_templates').delete().eq('id', id)
    if (error) return { ok: false, error: error.message }
    if (paths.length) await SUPA.storage.from(BUCKET).remove(paths)
    return { ok: true, value: null }
  }
  writeLocal(readLocal().filter((g) => g.id !== id))
  return { ok: true, value: null }
}

/**
 * Delete EVERY admin-uploaded garment (and its storage files) in one shot — the "start fresh"
 * action. Built-in/traced base-library garments are code/asset-sourced and are never touched.
 * Returns how many garments were removed.
 */
export async function deleteAllUploadedGarments(): Promise<GarmentResult<{ deleted: number }>> {
  if (SUPA) {
    const { data: rows, error: listErr } = await SUPA.from('garment_templates').select('id, thumb_path')
    if (listErr) return { ok: false, error: listErr.message }
    const ids = ((rows as Row[] | null) ?? []).map((r) => str(r.id)).filter(Boolean)
    if (ids.length === 0) return { ok: true, value: { deleted: 0 } }

    // Collect every storage object (representation files + thumbnails) before deleting the rows.
    const { data: reps } = await SUPA.from('garment_representations').select('storage_path')
    const paths = [
      ...((reps as Row[] | null) ?? []).map((r) => str(r.storage_path)),
      ...((rows as Row[]).map((r) => str(r.thumb_path))),
    ].filter(Boolean)

    // Delete the rows (garment_representations cascade via FK on delete cascade).
    const { error: delErr } = await SUPA.from('garment_templates').delete().in('id', ids)
    if (delErr) return { ok: false, error: delErr.message }
    // Storage removal is best-effort in chunks (the API caps how many paths one call accepts).
    for (let i = 0; i < paths.length; i += 100) {
      await SUPA.storage.from(BUCKET).remove(paths.slice(i, i + 100))
    }
    return { ok: true, value: { deleted: ids.length } }
  }
  const deleted = readLocal().length
  writeLocal([])
  return { ok: true, value: { deleted } }
}

// ---------- categories ----------
function readLocalCats(): GarmentCategory[] {
  try {
    const raw = localStorage.getItem(LOCAL_CATS_KEY)
    return raw ? (JSON.parse(raw) as GarmentCategory[]) : []
  } catch {
    return []
  }
}
function writeLocalCats(list: GarmentCategory[]): void {
  try {
    localStorage.setItem(LOCAL_CATS_KEY, JSON.stringify(list))
  } catch {
    /* ignore */
  }
}

/** Built-in defaults first (by sort), then any custom categories, deduped by id. */
function mergeCategories(extra: GarmentCategory[]): GarmentCategory[] {
  const byId = new Map<string, GarmentCategory>()
  for (const c of CATEGORIES) byId.set(c.id, c)
  for (const c of extra) if (!byId.has(c.id)) byId.set(c.id, c)
  return [...byId.values()].sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label))
}

/** Every category the admin can pick from: built-in defaults + custom ones created before. */
export async function listCategories(): Promise<GarmentCategory[]> {
  if (SUPA) {
    const { data } = await SUPA.from('garment_categories').select('*').order('sort', { ascending: true })
    const rows = ((data as Row[] | null) ?? []).map((r) => ({
      id: str(r.id),
      label: str(r.label) || titleCaseCategory(str(r.id)),
      sort: num(r.sort, 50),
    }))
    return mergeCategories(rows)
  }
  return mergeCategories(readLocalCats())
}

/**
 * Create (or reuse) a custom category so garments can reference it (FK) and it shows in the chips.
 * A name matching a built-in returns that built-in unchanged.
 */
export async function createCategory(label: string): Promise<GarmentResult<GarmentCategory>> {
  const clean = label.trim()
  if (!clean) return { ok: false, error: 'Enter a category name.' }
  const id = toCategoryId(clean)
  if (isKnownCategory(id)) {
    const known = CATEGORIES.find((c) => c.id === id)
    return { ok: true, value: known ?? { id, label: clean, sort: 50 } }
  }
  const cat: GarmentCategory = { id, label: clean, sort: 50 }
  if (SUPA) {
    const { error } = await SUPA.from('garment_categories').upsert({ id, label: clean, sort: 50 }, { onConflict: 'id' })
    if (error) return { ok: false, error: error.message }
    return { ok: true, value: cat }
  }
  const list = readLocalCats()
  if (!list.some((c) => c.id === id)) {
    list.push(cat)
    writeLocalCats(list)
  }
  return { ok: true, value: cat }
}

/** Guarantee a category row exists before a garment references it (FK safety on publish). */
async function ensureCategory(id: string): Promise<void> {
  if (!SUPA || isKnownCategory(id)) return
  await SUPA.from('garment_categories').upsert({ id, label: titleCaseCategory(id), sort: 50 }, { onConflict: 'id' })
}

/**
 * Re-render a garment's thumbnail from its STORED source files (transparent, correct
 * preview priority) — lets old imports get fixed previews without a re-upload.
 */
export async function regenerateThumbnail(id: string): Promise<GarmentResult<string>> {
  // Built-in / traced catalog thumbnails are always current (rendered from code / vector files).
  if (isBuiltinGarmentId(id)) {
    const g = builtinGarments().find((x) => x.id === id)
    return g ? { ok: true, value: g.thumbUrl } : { ok: false, error: 'Garment not found.' }
  }
  if (isTracedGarmentId(id)) return { ok: true, value: tracedGarmentSvgUrl(id) }
  if (!SUPA) return { ok: false, error: 'Regenerate needs the Supabase backend.' }
  const g = await getGarment(id)
  if (!g) return { ok: false, error: 'Garment not found.' }
  const sources = (g.representations ?? []).filter((r) => r.kind !== 'thumbnail' && r.url && r.storagePath)
  if (sources.length === 0) return { ok: false, error: 'No source files to regenerate from.' }

  const asFiles: ExtractedFile[] = sources.map((r) => ({
    path: r.storagePath,
    name: r.storagePath.split('/').pop() ?? r.format,
    ext: r.format,
    bytes: r.bytes || 1,
    blob: new Blob(),
  }))
  const chosen = pickPreviewSource(asFiles)
  const rep = (chosen ? sources.find((r) => r.storagePath === chosen.path) : sources[0]) ?? sources[0]
  if (!rep.url) return { ok: false, error: 'No renderable source.' }

  let blob: Blob
  try {
    const res = await fetch(rep.url)
    if (!res.ok) throw new Error('fetch failed')
    blob = await res.blob()
  } catch {
    return { ok: false, error: 'Could not read the source file.' }
  }
  const file: ExtractedFile = { path: rep.storagePath, name: asFiles[0].name, ext: rep.format, bytes: rep.bytes, blob }
  const thumb = await generatePreview(file, { name: g.name, category: g.category })
  const dir = rep.storagePath.split('/').slice(0, -1).join('/')
  const thumbPath = `${dir}/_thumb.png`
  const up = await SUPA.storage.from(BUCKET).upload(thumbPath, thumb, { contentType: 'image/png', upsert: true })
  if (up.error) return { ok: false, error: up.error.message }
  await SUPA.from('garment_templates')
    .update({ thumb_path: thumbPath, updated_at: new Date().toISOString() })
    .eq('id', id)
  const { data: signed } = await SUPA.storage.from(BUCKET).createSignedUrl(thumbPath, 3600)
  return { ok: true, value: signed?.signedUrl ?? '' }
}
