/**
 * Pure detection logic for the garment import pipeline: classify files, resolve
 * INDIVIDUAL garments (never one-per-format, never one-per-category), infer a
 * category, and pick a preview source. No I/O — fully unit-testable.
 */
import type { ExtractedFile, GarmentCategoryId, GarmentViews, GarmentHealth } from '../types'

// ---------- file classification ----------

export type FileClass = 'vector' | 'raster' | 'document' | 'pattern' | 'font' | 'other'

const CLASS_BY_EXT: Record<string, FileClass> = {
  ai: 'document', // Illustrator (PDF-compatible) — rendered via pdf.js
  pdf: 'document',
  svg: 'vector',
  eps: 'document',
  png: 'raster',
  jpg: 'raster',
  jpeg: 'raster',
  webp: 'raster',
  gif: 'raster',
  dxf: 'pattern',
  plt: 'pattern',
  ttf: 'font',
  otf: 'font',
  woff: 'font',
  woff2: 'font',
}

export const classifyExt = (ext: string): FileClass => CLASS_BY_EXT[ext.toLowerCase()] ?? 'other'

/** Files that are archive cruft, never part of a garment. */
export function isJunk(path: string, name: string): boolean {
  if (name === '.DS_Store' || name.toLowerCase() === 'thumbs.db') return true
  if (name.startsWith('._')) return true
  if (path.split('/').some((seg) => seg === '__MACOSX')) return true
  if (name.startsWith('.')) return true
  return false
}

// ---------- naming ----------

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Turn a folder/archive name into a human title ("oversized_hoodie-01" → "Oversized Hoodie 01"). */
export function prettyName(raw: string): string {
  const base = raw
    .replace(/\.[a-z0-9]+$/i, '') // drop extension if present
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase → spaced
    .replace(/\s+/g, ' ')
    .trim()
  if (!base) return 'Untitled Garment'
  return base
    .split(' ')
    .map((w) => (w.length <= 3 && w === w.toUpperCase() ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ')
}

// ---------- category inference ----------

// Ordered most-specific first; first hit wins.
const CATEGORY_RULES: readonly { id: GarmentCategoryId; keywords: readonly string[] }[] = [
  { id: 'bomber', keywords: ['bomber'] },
  { id: 'blazer', keywords: ['blazer', 'suit jacket', 'sport coat'] },
  { id: 'hoodie', keywords: ['hoodie', 'hooded', 'pullover hood'] },
  { id: 'sweatshirt', keywords: ['sweatshirt', 'crewneck', 'crew neck', 'crew-neck'] },
  { id: 'knitwear', keywords: ['knit', 'sweater', 'cardigan', 'jumper', 'turtleneck'] },
  { id: 'jacket', keywords: ['jacket', 'parka', 'windbreaker', 'coat', 'anorak', 'puffer'] },
  { id: 'pants', keywords: ['pant', 'trouser', 'jogger', 'sweatpant', 'cargo', 'chino', 'legging'] },
  { id: 'shorts', keywords: ['short'] },
  { id: 'tee', keywords: ['t-shirt', 'tshirt', 't shirt', 'tee'] },
  { id: 'cap', keywords: ['cap', 'hat', 'beanie', 'snapback', 'bucket'] },
  { id: 'dress', keywords: ['dress', 'gown'] },
  { id: 'skirt', keywords: ['skirt'] },
  { id: 'accessory', keywords: ['bag', 'tote', 'sock', 'glove', 'scarf', 'belt', 'backpack'] },
]

/** Infer a garment category from free text (folder + file names). */
export function inferCategory(text: string): GarmentCategoryId {
  const hay = ` ${text.toLowerCase()} `
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((k) => hay.includes(k))) return rule.id
  }
  return 'other'
}

// ---------- grouping ----------

const dirSegments = (path: string): string[] => path.replace(/^\.?\//, '').split('/').slice(0, -1) // drop basename

// Folders that organize files BY FORMAT, not by garment (e.g. "AI/…" + "PNG/…").
// These are representation buckets — they NEVER define a garment's identity.
const FORMAT_FOLDERS = new Set([
  'ai', 'png', 'pdf', 'svg', 'dxf', 'jpg', 'jpeg', 'eps', 'psd', 'webp', 'tif', 'tiff', 'gif',
  'vector', 'vectors', 'raster', 'rasters', 'source', 'sources', 'print', 'prints', 'export', 'exports',
  'mockup', 'mockups', 'preview', 'previews', 'flat', 'flats', 'artwork',
])

/** Is this folder a format bucket ("AI", "PNG", "PNG Files", "Print Ready") rather than a garment/category? */
export function isFormatFolder(name: string): boolean {
  const raw = name.trim().toLowerCase()
  if (FORMAT_FOLDERS.has(raw)) return true
  const stripped = raw.replace(/[\s_-]*(files|ready|assets)$/g, '').trim()
  return stripped !== raw && FORMAT_FOLDERS.has(stripped)
}

// Generic view/variant words in a filename — they describe a REPRESENTATION of a
// garment (front/back/mockup/…), not a distinct garment.
const VIEW_TOKENS = new Set([
  'front', 'back', 'rear', 'side', 'left', 'right', 'detail', 'details', 'mockup', 'mockups',
  'flat', 'flats', 'main', 'hero', 'thumb', 'thumbnail', 'cover', 'preview', 'previews',
  'artwork', 'view', 'angle', 'closeup', 'zoom', 'render', 'proof',
])

/**
 * The garment identity carried by a filename, with trailing view/variant + numeric
 * tokens stripped: "Double Breasted Blazer front.png" → "double breasted blazer";
 * "front.png" → "" (a pure view — no garment identity of its own).
 */
export function garmentStem(name: string): string {
  const words = name
    .replace(/\.[a-z0-9]+$/i, '')
    .toLowerCase()
    .split(/[\s_\-.]+/)
    .filter(Boolean)
    .filter((w) => !/^v?\d+$/.test(w)) // drop pure numbers / v1 / 01
  while (words.length && VIEW_TOKENS.has(words[words.length - 1])) words.pop()
  return words.join(' ')
}

/** Longest common leading segment sequence across a set of path-segment lists. */
function longestCommonPrefix(lists: string[][]): string[] {
  if (lists.length === 0) return []
  let prefix = lists[0]
  for (const l of lists.slice(1)) {
    let i = 0
    while (i < prefix.length && i < l.length && prefix[i] === l[i]) i++
    prefix = prefix.slice(0, i)
    if (prefix.length === 0) break
  }
  return prefix
}

export type DetectedGroup = { name: string; category: GarmentCategoryId; files: ExtractedFile[] }

/**
 * Resolve INDIVIDUAL garments from an archive — never one-per-format, never
 * one-per-category. A garment is identified by:
 *   (a) its own folder below any shared category/wrapper root (the format
 *       sub-folders AI/PNG/SVG/… become its representations); OR
 *   (b) a shared file basename when a category buckets files by format
 *       (AI/blazer.ai + PNG/blazer.png → one "Blazer").
 * Every garment collects ALL of its representations under one garment.
 */
export function groupIntoGarments(rawFiles: ExtractedFile[], archiveName: string): DetectedGroup[] {
  const clean = rawFiles.filter((f) => !isJunk(f.path, f.name) && f.bytes > 0)
  if (clean.length === 0) return []

  const archiveRoot = prettyName(archiveName.replace(/\.[a-z0-9]+$/i, '')) || 'Garment'

  // Each file's directory with format-bucket segments removed — what remains is the
  // garment/category structure. The shared prefix of all of them is the pack/category root.
  const nonFormat = clean.map((f) => dirSegments(f.path).filter((seg) => !isFormatFolder(seg)))
  const commonRoot = longestCommonPrefix(nonFormat)
  const rootName = commonRoot.length ? prettyName(commonRoot[commonRoot.length - 1]) : archiveRoot

  const groups = new Map<string, { name: string; files: ExtractedFile[] }>()
  const push = (key: string, name: string, f: ExtractedFile): void => {
    const g = groups.get(key) ?? { name, files: [] }
    g.files.push(f)
    groups.set(key, g)
  }

  // (a) files inside a garment-specific sub-folder → grouped by that folder path.
  const looseFiles: ExtractedFile[] = []
  clean.forEach((f, i) => {
    const nf = nonFormat[i]
    if (nf.length > commonRoot.length) {
      push(`dir:${nf.join('/').toLowerCase()}`, prettyName(nf[nf.length - 1]), f)
    } else {
      looseFiles.push(f)
    }
  })

  // (b) loose files sit at the root/category level (format-bucketed or flat).
  //     ≥2 distinct basenames → a category of many garments (split by basename);
  //     otherwise a single garment (named after the wrapper folder, its lone basename, or the archive).
  const looseStems = new Set(looseFiles.map((f) => garmentStem(f.name)).filter(Boolean))
  if (looseStems.size >= 2) {
    for (const f of looseFiles) {
      const stem = garmentStem(f.name)
      if (stem) push(`stem:${stem}`, prettyName(stem), f)
      else push(`root:${rootName.toLowerCase()}`, rootName, f)
    }
  } else if (looseFiles.length > 0) {
    const single = commonRoot.length
      ? rootName
      : looseStems.size === 1
        ? prettyName([...looseStems][0])
        : archiveRoot
    for (const f of looseFiles) push(`one:${single.toLowerCase()}`, single, f)
  }

  const out: DetectedGroup[] = [...groups.values()].map((g) => ({
    name: g.name,
    category: inferCategory(`${rootName} ${g.name} ${g.files.map((f) => f.name).join(' ')}`),
    files: g.files,
  }))
  out.sort((a, b) => a.name.localeCompare(b.name))
  return out
}

// ---------- preview source selection ----------

// Production-ready preview images first; AI is rendered only when nothing else exists.
const PREVIEW_ORDER = ['png', 'webp', 'svg', 'jpg', 'jpeg', 'ai', 'pdf']
const PREVIEW_HINTS = ['front', 'preview', 'mockup', 'main', 'hero', 'thumb', 'cover']

/**
 * Choose the best file to render a preview from — favouring exported preview images
 * over source artwork: PNG → WEBP → SVG → JPG → AI (rendered) → PDF → placeholder.
 */
export function pickPreviewSource(files: ExtractedFile[]): ExtractedFile | null {
  const usable = files.filter((f) => f.bytes > 0)
  for (const fmt of PREVIEW_ORDER) {
    const matches = usable.filter((f) => f.ext.toLowerCase() === fmt)
    if (matches.length === 0) continue
    // within a format, prefer a front/preview/mockup-hinted file
    return matches.find((f) => PREVIEW_HINTS.some((h) => f.name.toLowerCase().includes(h))) ?? matches[0]
  }
  return null
}

// ---------- view detection ----------

const THREE_D_EXT = new Set(['glb', 'gltf', 'obj', 'fbx', 'usdz'])
// Filename tokens that indicate a real DETAIL view (not the main flat).
const DETAIL_TOKENS = ['detail', 'details', 'sleeve', 'collar', 'neck', 'label', 'inside', 'outside', 'pocket', 'cuff', 'closeup']

/** Whole-word-ish token test so "inside" doesn't match "side" and "frontier" doesn't match "front". */
function hasToken(text: string, token: string): boolean {
  return new RegExp(`(^|[^a-z])${token}([^a-z]|$)`).test(text)
}

/**
 * Detect the REAL views a garment has, from its file names + formats — never faked.
 * - Separate `front` and `back` files → two views.
 * - A single file naming both, OR a plain flat with no front/back tokens → one combined view.
 * - side / details / 3D only when a matching file actually exists.
 */
export function detectViews(files: ExtractedFile[]): GarmentViews {
  const names = files.map((f) => f.name.toLowerCase())
  const has3D = files.some((f) => THREE_D_EXT.has(f.ext.toLowerCase()))
  const side = names.some((n) => hasToken(n, 'side'))
  const details = names.some((n) => DETAIL_TOKENS.some((t) => hasToken(n, t)))

  const frontOnly = names.some((n) => hasToken(n, 'front') && !hasToken(n, 'back'))
  const backOnly = names.some((n) => hasToken(n, 'back') && !hasToken(n, 'front'))

  if (frontOnly && backOnly) {
    return { front: true, back: true, combinedFrontBack: false, side, details, has3D }
  }
  return { front: false, back: false, combinedFrontBack: true, side, details, has3D }
}

/**
 * The ordered list of REAL view labels a garment has — the single source of truth
 * for both the review summary and the studio's dynamic view tabs. Never faked:
 * a label appears only when a matching file was actually detected.
 */
export function viewList(v: GarmentViews): string[] {
  const parts: string[] = []
  if (v.front && v.back) parts.push('Front', 'Back')
  else if (v.combinedFrontBack) parts.push('Front + Back')
  else if (v.front) parts.push('Front')
  else if (v.back) parts.push('Back')
  if (v.side) parts.push('Side')
  if (v.details) parts.push('Details')
  if (v.has3D) parts.push('3D')
  return parts
}

/** A short human label of a garment's views ("Front + Back", "Front · Back · Side"). */
export function viewsSummary(v: GarmentViews): string {
  return viewList(v).join(' · ') || 'Preview'
}

// ---------- garment health ----------

const GENERIC_NAMES = new Set(['garment', 'untitled garment', 'untitled', 'file', 'artwork', 'export', 'image', 'design'])
const EDITABLE_FORMATS = new Set(['ai', 'svg', 'pdf', 'eps', 'dxf'])
const PREVIEW_IMAGE_FORMATS = new Set(['png', 'webp', 'svg', 'jpg', 'jpeg'])

/** Import-quality signal for a detected garment (before publish). */
export function garmentHealth(name: string, files: ExtractedFile[], hasPreview: boolean): GarmentHealth {
  const issues: string[] = []
  const clean = name.trim().toLowerCase()
  const recognizable = clean.length >= 2 && !GENERIC_NAMES.has(clean)

  // Incomplete — the garment can't really be used.
  if (!hasPreview) issues.push('No usable preview')
  if (!recognizable) issues.push('No recognizable garment name')
  if (!hasPreview || !recognizable) return { status: 'incomplete', issues }

  // Warning — usable but imperfect.
  if (!files.some((f) => EDITABLE_FORMATS.has(f.ext.toLowerCase()))) issues.push('No editable source (AI/SVG/PDF/DXF)')
  if (!files.some((f) => PREVIEW_IMAGE_FORMATS.has(f.ext.toLowerCase()))) issues.push('No exported preview image')
  return { status: issues.length ? 'warning' : 'ready', issues }
}
