/**
 * Turn a free-text prompt ("Chrome tribal star", "vintage skull with roses") into a structured
 * brief the concept engine can build from: a subject motif, one or more style treatments, a colour
 * palette, and human-readable tags. Everything is keyword-driven and deterministic — no guessing,
 * no network.
 */

export type StyleKey = 'chrome' | 'neon' | 'vintage' | 'gothic' | 'metallic' | 'graffiti' | 'flat'

export type ParsedPrompt = {
  /** Motif key resolved from the subject noun (falls back to 'emblem'). */
  motif: string
  /** Style treatments found, most-specific first (may be empty → engine picks a sensible default). */
  styles: StyleKey[]
  /** Extra modifiers detected (e.g. 'glow', 'sharp', 'distressed') — surfaced as tags. */
  modifiers: string[]
  /** Short capitalised tags for the modal header. */
  tags: string[]
  /** Uppercase initials for monogram/emblem lettering. */
  initials: string
}

/** Subject nouns → motif key. First match wins; order matters (specific before generic). */
const MOTIF_WORDS: { key: string; words: string[] }[] = [
  { key: 'tribalStar', words: ['tribal star', 'tribal'] },
  { key: 'star', words: ['star', 'compass', 'north star', 'sparkle'] },
  { key: 'skull', words: ['skull', 'skeleton', 'death', 'reaper'] },
  { key: 'rose', words: ['rose', 'roses', 'flower', 'floral', 'peony'] },
  { key: 'butterfly', words: ['butterfly', 'moth', 'wings insect'] },
  { key: 'serpent', words: ['dragon', 'serpent', 'snake', 'koi', 'fish', 'hydra'] },
  { key: 'gothicCross', words: ['gothic cross', 'crucifix'] },
  { key: 'cross', words: ['cross'] },
  { key: 'lightning', words: ['lightning', 'thunder', 'bolt', 'electric', 'volt'] },
  { key: 'flame', words: ['flame', 'flames', 'fire', 'blaze', 'burn'] },
  { key: 'wings', words: ['wings', 'wing', 'angel', 'feathers'] },
  { key: 'crown', words: ['crown', 'king', 'queen', 'royal', 'royalty'] },
  { key: 'barbedWire', words: ['barbed wire', 'barbed', 'wire', 'thorns', 'thorn'] },
  { key: 'heart', words: ['heart', 'love', 'y2k heart'] },
  // Deliberately NOT 'logo'/'letter' — too ambiguous with edit commands ("move the logo…").
  { key: 'monogram', words: ['monogram', 'initials', 'lettermark', 'wordmark'] },
]

const STYLE_WORDS: { key: StyleKey; words: string[] }[] = [
  { key: 'chrome', words: ['chrome', 'liquid metal', 'y2k', 'mirror'] },
  { key: 'neon', words: ['neon', 'glow', 'cyber', 'cyberpunk', 'electric', 'synthwave'] },
  { key: 'vintage', words: ['vintage', 'distressed', 'washed', 'retro', 'faded', 'worn', 'grunge'] },
  { key: 'gothic', words: ['gothic', 'goth', 'dark', 'occult', 'medieval', 'blackletter'] },
  { key: 'metallic', words: ['metallic', 'silver', 'steel', 'iron', 'gold', 'foil'] },
  { key: 'graffiti', words: ['graffiti', 'spray', 'street', 'tag', 'bombing'] },
]

const MODIFIER_WORDS = ['sharp', 'aggressive', 'clean', 'minimal', 'luxury', 'premium', 'bold', 'smoke', 'glow', 'distressed', 'high detail']

function title(word: string): string {
  return word.length ? word[0].toUpperCase() + word.slice(1) : word
}

/** Whole-word match so "tag" never fires inside "vin·tag·e" (and phrases match at their edges). */
function wordIn(text: string, word: string): boolean {
  const esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z])${esc}([^a-z]|$)`, 'i').test(text)
}

export function parsePrompt(prompt: string): ParsedPrompt {
  const text = prompt.toLowerCase().trim()

  const motifHit = MOTIF_WORDS.find((m) => m.words.some((w) => wordIn(text, w)))
  const motif = motifHit?.key ?? 'emblem'

  const styles = STYLE_WORDS.filter((s) => s.words.some((w) => wordIn(text, w))).map((s) => s.key)

  const modifiers = MODIFIER_WORDS.filter((m) => wordIn(text, m))

  // Tags: the leading subject word + detected styles + up to two modifiers, capitalised.
  const subjectWord = (prompt.trim().split(/\s+/).pop() ?? '').replace(/[^a-z]/gi, '')
  const tagSet: string[] = []
  styles.forEach((s) => tagSet.push(title(s)))
  if (subjectWord) tagSet.push(title(subjectWord))
  modifiers.slice(0, 2).forEach((m) => tagSet.push(title(m)))
  const tags = [...new Set(tagSet)].slice(0, 5)

  const initials =
    prompt
      .trim()
      .split(/\s+/)
      .map((w) => w.replace(/[^a-z]/gi, '')[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'TX'

  return { motif, styles, modifiers, tags, initials }
}

/** Verbs that begin an edit command ("make it oversized", "add a wash", "move the logo"). */
const EDIT_VERB = /^(make|add|move|use|turn|set|change|give|remove|delete|scale|rotate|align|cent(?:er|re)|apply|shrink|enlarge|flip)\b/i

/**
 * Should this prompt generate a graphic (vs. run as an edit command)? True when it names a known
 * subject and doesn't open with an edit verb — so "vintage skull with roses" generates while
 * "add a vintage wash" edits, even though both contain "vintage".
 */
export function describesGraphic(prompt: string): boolean {
  const text = prompt.trim()
  if (!text) return false
  if (EDIT_VERB.test(text)) return false
  return parsePrompt(text).motif !== 'emblem'
}

// Garment nouns (EN + DE, streetwear) and fabric-destruction words that signal "edit the garment".
const GARMENT_NOUNS = ['garment', 'jacket', 'jacke', 'hoodie', 'hoody', 'sweater', 'pullover', 'shirt', 'tee', 'tshirt', 'pants', 'hose', 'trousers', 'jeans', 'dress', 'kleid', 'skirt', 'rock', 'coat', 'mantel', 'klamotte', 'klamotten', 'cardigan', 'vest', 'parka', 'blazer', 'trui']
const FABRIC_EDITS = ['hole', 'holes', 'loch', 'löcher', 'rip', 'ripped', 'distress', 'distressed', 'washed', 'acid', 'bleach', 'bleached', 'faded', 'patchwork', 'dyed', 'frayed', 'shredded', 'stonewash']

/**
 * Should this prompt EDIT the garment itself (add holes, wash, distress) rather than make a graphic?
 * True when it references a garment or a fabric transformation. The modal also lets the user toggle,
 * so this only picks the initial mode.
 */
export function describesGarmentEdit(prompt: string): boolean {
  const text = prompt.toLowerCase().trim()
  if (!text) return false
  return GARMENT_NOUNS.some((w) => wordIn(text, w)) || FABRIC_EDITS.some((w) => wordIn(text, w))
}
