/* ============================================================
   Motion engine — local command parser.
   Turns common edit phrases (German + English) into patch ops
   WITHOUT an API round-trip. Runs first: instant + free for the
   frequent asks ("make it bigger", "accent blue", "9:16", "snap
   to the beat", "0.8s longer"). Anything it doesn't recognise
   falls through to the full AI director.
   ============================================================ */

import type { Patch, PatchOp } from './patch'
import type { BgKey, MotionAspect, Project, Scene } from '../types'

const SIZE_UP: Record<string, 'sm' | 'md' | 'lg' | 'xl'> = { sm: 'md', md: 'lg', lg: 'xl', xl: 'xl' }
const SIZE_DOWN: Record<string, 'sm' | 'md' | 'lg' | 'xl'> = { xl: 'lg', lg: 'md', md: 'sm', sm: 'sm' }

const COLOR_WORDS: Record<string, string> = {
  blue: '#7ab8ff', blau: '#7ab8ff',
  red: '#ff6b6b', rot: '#ff6b6b',
  green: '#d1f94f', grün: '#d1f94f', gruen: '#d1f94f', lime: '#d1f94f',
  pink: '#ff7ab8', rosa: '#ff7ab8',
  orange: '#ffb26b',
  purple: '#8f7aff', lila: '#8f7aff', violett: '#8f7aff', violet: '#8f7aff',
  white: '#ffffff', weiß: '#ffffff', weiss: '#ffffff',
  yellow: '#ffe66b', gelb: '#ffe66b',
}

const num = (m: RegExpMatchArray | null): number | null => (m ? parseFloat(m[1].replace(',', '.')) : null)

/** Parse an instruction into a patch. Returns null when nothing is recognised (→ use the AI). */
export function localDirect(project: Project, instruction: string, focusSceneId?: string | null): Patch | null {
  const t = instruction.toLowerCase().trim()
  const ops: PatchOp[] = []
  const focus: Scene | undefined = project.scenes.find((s) => s.id === focusSceneId) ?? project.scenes[0]

  // ---- aspect ----
  if (/\b(9:16|hochkant|vertical|portrait|tiktok|reel|story)\b/.test(t)) ops.push({ op: 'setAspect', aspect: '9:16' as MotionAspect })
  else if (/\b(16:9|quer|landscape|widescreen|youtube)\b/.test(t)) ops.push({ op: 'setAspect', aspect: '16:9' as MotionAspect })
  else if (/\b(1:1|quadrat|square)\b/.test(t)) ops.push({ op: 'setAspect', aspect: '1:1' as MotionAspect })

  // ---- brand: accent + background ----
  const hex = t.match(/#([0-9a-f]{6}|[0-9a-f]{3})/)
  const accentWanted = /\b(accent|akzent|colou?r|farbe)\b/.test(t) || /\b(blau|blue|rot|red|grün|gruen|green|pink|rosa|orange|lila|purple|violett|violet|gelb|yellow|weiß|weiss|white)\b/.test(t)
  if (hex) ops.push({ op: 'setBrand', accent: '#' + hex[1] })
  else if (accentWanted) {
    const word = Object.keys(COLOR_WORDS).find((w) => new RegExp(`\\b${w}\\b`).test(t))
    if (word) ops.push({ op: 'setBrand', accent: COLOR_WORDS[word] })
  }
  const bg = (['midnight', 'aurora', 'sunset', 'mono'] as BgKey[]).find((b) => new RegExp(`\\b${b}\\b`).test(t))
  if (bg) ops.push({ op: 'setBrand', bg })

  // ---- text size on the focused custom scene ----
  const wantsBigger = /(bigger|larger|größer|grös?ser|groesser|mehr text|riesig|huge)/.test(t)
  const wantsSmaller = /(smaller|kleiner|tiny|winzig)/.test(t)
  if ((wantsBigger || wantsSmaller) && focus?.type === 'custom' && /(text|headline|titel|title|überschrift|schrift|word|wort)/.test(t)) {
    const map = wantsBigger ? SIZE_UP : SIZE_DOWN
    for (const el of focus.props.elements) {
      if (el.kind === 'text') ops.push({ op: 'setElement', sceneId: focus.id, elementId: el.id, props: { size: map[el.size] } })
    }
  }

  // ---- scene duration ----
  if (focus) {
    const longer = /(länger|laenger|longer)/.test(t)
    const shorter = /(kürzer|kuerzer|shorter)/.test(t)
    if (longer || shorter) {
      const explicit = num(t.match(/([0-9]+(?:[.,][0-9]+)?)\s*(s|sec|sek|sekunden|seconds)/))
      const delta = explicit ?? 0.8
      const next = Math.min(15, Math.max(1.5, focus.duration + (longer ? delta : -delta)))
      ops.push({ op: 'setScene', sceneId: focus.id, duration: Math.round(next * 10) / 10 })
    }
    // ---- align to beat ----
    if (/(beat|takt)/.test(t) && (/(snap|align|sync|synchron|auf den|on the|to the|leg)/.test(t) || /(klick|click)/.test(t))) {
      ops.push({ op: 'alignToBeat', sceneId: focus.id, strongOnly: /(strong|stark|drop|hard|kräftig|kraeftig)/.test(t) })
    }
    // ---- remove scene ----
    if (/(remove|delete|lösch|loesch|entfern).{0,16}(scene|szene)/.test(t)) ops.push({ op: 'removeScene', sceneId: focus.id })
  }

  // ---- music mix ----
  if (project.audio) {
    const pct = num(t.match(/([0-9]{1,3})\s*%/))
    if (pct != null && /(musik|music|volume|lautstärke|lautstaerke)/.test(t)) ops.push({ op: 'setAudio', volume: Math.min(1, Math.max(0, pct / 100)) })
    else if (/(lauter|louder)/.test(t)) ops.push({ op: 'setAudio', volume: Math.min(1, project.audio.volume + 0.15) })
    else if (/(leiser|quieter|softer)/.test(t)) ops.push({ op: 'setAudio', volume: Math.max(0, project.audio.volume - 0.15) })
    const fo = num(t.match(/(?:fade[ -]?out|ausblend\w*)\D{0,8}([0-9]+(?:[.,][0-9]+)?)/))
    if (fo != null) ops.push({ op: 'setAudio', fadeOut: fo })
    const fi = num(t.match(/(?:fade[ -]?in|einblend\w*)\D{0,8}([0-9]+(?:[.,][0-9]+)?)/))
    if (fi != null) ops.push({ op: 'setAudio', fadeIn: fi })
  }

  return ops.length ? { ops, summary: 'Applied your change.' } : null
}
