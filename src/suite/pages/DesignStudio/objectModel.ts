/**
 * Canvas objects — the editable elements a designer places on the garment
 * (text, uploaded images, starter graphics). Every object is stored ON its
 * Layer, so the Layers panel, undo/redo and selection all work for free.
 */
import type { Layer } from './LayersPanel'

export type CanvasObjectType = 'text' | 'image' | 'graphic'

/** Transform + content, in normalized print-area coordinates (0..1, center-based). */
export type CanvasObject = {
  type: CanvasObjectType
  x: number
  y: number
  /** Fraction of the print-area width the object spans (before rotation). */
  width: number
  rotation: number
  opacity: number
  // text
  text?: string
  color?: string
  font?: string
  weight?: number
  italic?: boolean
  underline?: boolean
  letterSpacing?: number
  lineHeight?: number
  align?: 'left' | 'center' | 'right'
  // image / graphic
  src?: string // data URL (uploaded image)
  glyph?: string // built-in graphic id
  /** Mirror the object horizontally / vertically (images + graphics). */
  flipH?: boolean
  flipV?: boolean
}

let seq = 0
const nid = (p: string) => `${p}-${Date.now().toString(36)}${(seq++).toString(36)}`

export const FONT_OPTIONS = ['Inter', 'Space Grotesk', 'Archivo', 'Georgia', 'Courier New'] as const

/** Built-in starter graphics — id → inline SVG (drawn with currentColor). */
export const GRAPHIC_MARKS: Record<string, string> = {
  'Box Logo': '<rect x="8" y="24" width="84" height="52" rx="10" fill="none" stroke="currentColor" stroke-width="6"/><text x="50" y="60" font-family="Archivo, Arial" font-size="34" font-weight="800" fill="currentColor" text-anchor="middle">T</text>',
  Star: '<path d="M50 8 61 38 93 38 67 58 77 90 50 70 23 90 33 58 7 38 39 38Z" fill="currentColor"/>',
  Flame: '<path d="M50 8c8 16-4 22-4 34 0-8-8-10-8-10-6 10-14 16-14 30a26 26 0 0 0 52 0c0-18-14-26-22-44Z" fill="currentColor"/>',
  Smiley: '<circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" stroke-width="6"/><circle cx="37" cy="42" r="5" fill="currentColor"/><circle cx="63" cy="42" r="5" fill="currentColor"/><path d="M34 60c8 10 24 10 32 0" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>',
  Lightning: '<path d="M56 6 26 54h20l-8 40 34-52H50Z" fill="currentColor"/>',
  Globe: '<circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" stroke-width="5"/><path d="M50 10v80M10 50h80M22 28c16 12 40 12 56 0M22 72c16-12 40-12 56 0" fill="none" stroke="currentColor" stroke-width="5"/>',
  Barcode: '<g fill="currentColor"><rect x="14" y="24" width="5" height="52"/><rect x="24" y="24" width="9" height="52"/><rect x="38" y="24" width="4" height="52"/><rect x="47" y="24" width="8" height="52"/><rect x="60" y="24" width="4" height="52"/><rect x="69" y="24" width="10" height="52"/><rect x="83" y="24" width="4" height="52"/></g>',
  'Arch Text': '<path d="M14 66a44 44 0 0 1 72 0" fill="none" stroke="currentColor" stroke-width="6"/><path d="M20 78a40 40 0 0 1 60 0" fill="none" stroke="currentColor" stroke-width="4"/>',
}

/** Create a text layer placed at the chest. Dark by default so it's visible on light blanks. */
export function makeTextLayer(text = 'Your text', color = '#1A1A20'): Layer {
  return {
    id: nid('t'),
    name: text.slice(0, 22) || 'Text',
    type: 'Text',
    obj: { type: 'text', x: 0.5, y: 0.42, width: 0.6, rotation: 0, opacity: 1, text, color, font: 'Archivo', weight: 800, letterSpacing: 2, lineHeight: 1.1, align: 'center' },
  }
}

/** Create an image layer from an uploaded data URL. */
export function makeImageLayer(name: string, src: string): Layer {
  return {
    id: nid('img'),
    name: name.replace(/\.[^.]+$/, '').slice(0, 22) || 'Image',
    type: 'Image',
    obj: { type: 'image', x: 0.5, y: 0.45, width: 0.45, rotation: 0, opacity: 1, src },
  }
}

/** Create a graphic layer from a built-in mark. */
export function makeGraphicLayer(glyph: string): Layer {
  return {
    id: nid('gfx'),
    name: glyph,
    type: 'Graphic',
    obj: { type: 'graphic', x: 0.5, y: 0.44, width: 0.4, rotation: 0, opacity: 1, glyph, color: '#1A1A20' },
  }
}

/** Immutably patch an object's transform/content on its layer. */
export function patchObject(layers: Layer[], id: string, patch: Partial<CanvasObject>): Layer[] {
  return layers.map((l) => (l.id === id && l.obj ? { ...l, obj: { ...l.obj, ...patch } } : l))
}
