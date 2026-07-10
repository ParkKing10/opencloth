import { describe, it, expect } from 'vitest'
import {
  classifyExt,
  isJunk,
  slugify,
  prettyName,
  inferCategory,
  garmentStem,
  groupIntoGarments,
  pickPreviewSource,
  isFormatFolder,
  detectViews,
  viewList,
  viewsSummary,
  garmentHealth,
} from './detect'
import type { ExtractedFile } from '../types'

const f = (path: string, bytes = 10): ExtractedFile => {
  const name = path.split('/').pop() ?? path
  const ext = name.includes('.') ? (name.split('.').pop() ?? '').toLowerCase() : ''
  return { path, name, ext, bytes, blob: new Blob(['x']) }
}

describe('classifyExt', () => {
  it('maps known extensions to classes', () => {
    expect(classifyExt('ai')).toBe('document')
    expect(classifyExt('PDF')).toBe('document')
    expect(classifyExt('svg')).toBe('vector')
    expect(classifyExt('png')).toBe('raster')
    expect(classifyExt('jpg')).toBe('raster')
    expect(classifyExt('dxf')).toBe('pattern')
    expect(classifyExt('ttf')).toBe('font')
    expect(classifyExt('xyz')).toBe('other')
  })
})

describe('isJunk', () => {
  it('flags archive cruft', () => {
    expect(isJunk('.DS_Store', '.DS_Store')).toBe(true)
    expect(isJunk('__MACOSX/x.png', 'x.png')).toBe(true)
    expect(isJunk('._front.ai', '._front.ai')).toBe(true)
    expect(isJunk('Thumbs.db', 'Thumbs.db')).toBe(true)
    expect(isJunk('Hoodie/front.png', 'front.png')).toBe(false)
  })
})

describe('slugify', () => {
  it('produces url-safe slugs', () => {
    expect(slugify('Oversized Hoodie 01')).toBe('oversized-hoodie-01')
    expect(slugify('Café_Tee!')).toBe('cafe-tee')
    expect(slugify('  --Weird__Name--  ')).toBe('weird-name')
  })
})

describe('prettyName', () => {
  it('titles folder/archive names', () => {
    expect(prettyName('oversized_hoodie-01')).toBe('Oversized Hoodie 01')
    expect(prettyName('CargoPants')).toBe('Cargo Pants')
    expect(prettyName('hoodie.ai')).toBe('Hoodie')
    expect(prettyName('')).toBe('Untitled Garment')
  })
})

describe('inferCategory', () => {
  it('infers category from text, specific-first', () => {
    expect(inferCategory('Oversized Hoodie')).toBe('hoodie')
    expect(inferCategory('Bomber Jacket')).toBe('bomber') // bomber before jacket
    expect(inferCategory('Cargo Pants')).toBe('pants')
    expect(inferCategory('Classic Tee')).toBe('tee')
    expect(inferCategory('Crewneck Sweatshirt')).toBe('sweatshirt')
    expect(inferCategory('Merino Wool Sweater')).toBe('knitwear')
    expect(inferCategory('Snapback Cap')).toBe('cap')
    expect(inferCategory('mysterious object')).toBe('other')
  })
})

describe('garmentStem', () => {
  it('strips trailing view/variant + numeric tokens, keeps garment identity', () => {
    expect(garmentStem('Double Breasted Blazer front.png')).toBe('double breasted blazer')
    expect(garmentStem('front.png')).toBe('')
    expect(garmentStem('blazer-back-02.jpg')).toBe('blazer')
    expect(garmentStem('Casual Blazer.ai')).toBe('casual blazer')
    expect(garmentStem('mockup.png')).toBe('')
  })
})

describe('groupIntoGarments', () => {
  it('groups by top-level folder', () => {
    const files = [f('Hoodie/front.ai'), f('Hoodie/back.png'), f('Tee/front.png')]
    const groups = groupIntoGarments(files, 'winter-drop.zip')
    expect(groups.map((g) => g.name)).toEqual(['Hoodie', 'Tee'])
    expect(groups.find((g) => g.name === 'Hoodie')?.category).toBe('hoodie')
    expect(groups.find((g) => g.name === 'Tee')?.category).toBe('tee')
    expect(groups.find((g) => g.name === 'Hoodie')?.files).toHaveLength(2)
  })
  it('treats a flat archive as one garment named after the archive', () => {
    const files = [f('front.png'), f('back.png')]
    const groups = groupIntoGarments(files, 'Oversized Hoodie.zip')
    expect(groups).toHaveLength(1)
    expect(groups[0].name).toBe('Oversized Hoodie')
    expect(groups[0].category).toBe('hoodie')
  })
  it('peels a wrapper folder then groups', () => {
    const files = [f('BrandPack/Cargo Pants/a.ai'), f('BrandPack/Bomber/b.png')]
    const groups = groupIntoGarments(files, 'brandpack.rar')
    expect(groups.map((g) => g.name).sort()).toEqual(['Bomber', 'Cargo Pants'])
  })
  it('drops junk and empty archives', () => {
    expect(groupIntoGarments([f('__MACOSX/x'), f('.DS_Store')], 'x.zip')).toHaveLength(0)
  })

  it('collapses a format-organized pack (Ai/ + Png/) into ONE garment', () => {
    const files = [f('Ai/blazer.ai'), f('Png/blazer front.png'), f('Png/blazer back.png')]
    const groups = groupIntoGarments(files, 'blazer.zip')
    expect(groups).toHaveLength(1)
    expect(groups[0].name).toBe('Blazer')
    expect(groups[0].category).toBe('blazer')
    expect(groups[0].files).toHaveLength(3)
  })

  it('collapses a wrapped format-organized pack and names it after the wrapper', () => {
    const files = [f('Bomber Pack/Ai/x.ai'), f('Bomber Pack/PNG/x.png')]
    const groups = groupIntoGarments(files, 'download.zip')
    expect(groups).toHaveLength(1)
    expect(groups[0].name).toBe('Bomber Pack')
    expect(groups[0].category).toBe('bomber')
    expect(groups[0].files).toHaveLength(2)
  })

  it('names a format-organized garment from the file basename, never the format folder', () => {
    const files = [
      f('AI/Double Breasted Blazer.ai'),
      f('SVG/Double Breasted Blazer.svg'),
      f('PNG/Double Breasted Blazer.png'),
      f('PDF/Double Breasted Blazer.pdf'),
      f('DXF/Double Breasted Blazer.dxf'),
    ]
    const groups = groupIntoGarments(files, 'export-2381.zip')
    expect(groups).toHaveLength(1)
    expect(groups[0].name).toBe('Double Breasted Blazer')
    expect(groups[0].category).toBe('blazer')
    expect(groups[0].files).toHaveLength(5)
    expect(['AI', 'PNG', 'SVG', 'PDF', 'DXF']).not.toContain(groups[0].name)
  })

  it('detects individual garments inside a category folder (nested per-garment folders)', () => {
    const files = [
      f('Blazers and Suit Jackets/Double Breasted Blazer/AI/db.ai'),
      f('Blazers and Suit Jackets/Double Breasted Blazer/PNG/db.png'),
      f('Blazers and Suit Jackets/Casual Blazer/AI/cb.ai'),
      f('Blazers and Suit Jackets/Casual Blazer/PNG/cb.png'),
    ]
    const groups = groupIntoGarments(files, 'blazers.zip')
    expect(groups.map((g) => g.name)).toEqual(['Casual Blazer', 'Double Breasted Blazer'])
    expect(groups.every((g) => g.category === 'blazer')).toBe(true)
    // each garment collects its own representations (AI + PNG)
    expect(groups.find((g) => g.name === 'Double Breasted Blazer')?.files).toHaveLength(2)
    expect(groups.find((g) => g.name === 'Casual Blazer')?.files).toHaveLength(2)
  })

  it('detects individual garments when a category buckets files by format', () => {
    const files = [
      f('Blazers/AI/Double Breasted Blazer.ai'),
      f('Blazers/AI/Casual Blazer.ai'),
      f('Blazers/PNG/Double Breasted Blazer.png'),
      f('Blazers/PNG/Casual Blazer.png'),
      f('Blazers/SVG/Slim Blazer.svg'),
    ]
    const groups = groupIntoGarments(files, 'blazers.zip')
    expect(groups.map((g) => g.name)).toEqual(['Casual Blazer', 'Double Breasted Blazer', 'Slim Blazer'])
    expect(groups.find((g) => g.name === 'Double Breasted Blazer')?.files).toHaveLength(2) // AI + PNG
    expect(groups.find((g) => g.name === 'Slim Blazer')?.files).toHaveLength(1)
  })
})

describe('isFormatFolder', () => {
  it('recognizes format buckets, not garment folders', () => {
    expect(isFormatFolder('Ai')).toBe(true)
    expect(isFormatFolder('PNG')).toBe(true)
    expect(isFormatFolder('PNG Files')).toBe(true)
    expect(isFormatFolder('Print Ready')).toBe(true)
    expect(isFormatFolder('Vector')).toBe(true)
    expect(isFormatFolder('Hoodie')).toBe(false)
    expect(isFormatFolder('Cargo Pants')).toBe(false)
  })
})

describe('pickPreviewSource', () => {
  it('favours exported images over source artwork (PNG > WEBP > SVG > JPG > AI > PDF)', () => {
    expect(pickPreviewSource([f('a.ai'), f('a.pdf'), f('a.svg'), f('a.png')])?.ext).toBe('png')
    expect(pickPreviewSource([f('a.ai'), f('a.svg'), f('a.webp')])?.ext).toBe('webp')
    expect(pickPreviewSource([f('a.ai'), f('a.jpg')])?.ext).toBe('jpg')
    expect(pickPreviewSource([f('a.ai'), f('a.pdf')])?.ext).toBe('ai') // AI only when no export image exists
    expect(pickPreviewSource([f('a.pdf')])?.ext).toBe('pdf')
    expect(pickPreviewSource([f('notes.txt')])).toBeNull()
    expect(pickPreviewSource([])).toBeNull()
  })
  it('within a format, prefers a front/preview/mockup-hinted file', () => {
    expect(pickPreviewSource([f('detail.png'), f('front.png')])?.name).toBe('front.png')
  })
})

describe('detectViews', () => {
  it('treats a plain single flat as ONE combined front+back view', () => {
    const v = detectViews([f('Double Breasted Blazer.png'), f('Double Breasted Blazer.ai')])
    expect(v.combinedFrontBack).toBe(true)
    expect(v.front).toBe(false)
    expect(v.back).toBe(false)
  })

  it('splits into two views when separate front and back files exist', () => {
    const v = detectViews([f('blazer front.png'), f('blazer back.png')])
    expect(v.front).toBe(true)
    expect(v.back).toBe(true)
    expect(v.combinedFrontBack).toBe(false)
  })

  it('adds Side only when a real side file exists — and "inside" is not "side"', () => {
    expect(detectViews([f('front.png'), f('back.png'), f('side.png')]).side).toBe(true)
    expect(detectViews([f('front.png'), f('inside.png')]).side).toBe(false)
  })

  it('adds Details only when a real detail/sleeve/collar file exists', () => {
    expect(detectViews([f('flat.png'), f('sleeve detail.png')]).details).toBe(true)
    expect(detectViews([f('flat.png'), f('collar.png')]).details).toBe(true)
    expect(detectViews([f('flat.png')]).details).toBe(false)
  })

  it('flags 3D ONLY when a real 3D model file is present — never faked', () => {
    expect(detectViews([f('model.glb')]).has3D).toBe(true)
    expect(detectViews([f('shoe.obj')]).has3D).toBe(true)
    expect(detectViews([f('front.png'), f('back.png')]).has3D).toBe(false)
    // a PNG named "3d" is not a 3D model
    expect(detectViews([f('3d-mockup.png')]).has3D).toBe(false)
  })
})

describe('viewList / viewsSummary', () => {
  it('lists the real views in order', () => {
    const v = detectViews([f('front.png'), f('back.png'), f('side.png'), f('sleeve detail.png')])
    expect(viewList(v)).toEqual(['Front', 'Back', 'Side', 'Details'])
    expect(viewsSummary(v)).toBe('Front · Back · Side · Details')
  })
  it('summarises a combined flat as "Front + Back"', () => {
    expect(viewsSummary(detectViews([f('flat.png')]))).toBe('Front + Back')
  })
  it('falls back to "Preview" when there are no detectable views', () => {
    expect(viewsSummary({ front: false, back: false, combinedFrontBack: false, side: false, details: false, has3D: false })).toBe('Preview')
  })
  it('appends 3D to the summary when a real model exists', () => {
    expect(viewsSummary(detectViews([f('flat.png'), f('model.glb')]))).toBe('Front + Back · 3D')
  })
})

describe('garmentHealth', () => {
  it('is ready when it has a preview, a real name, an editable source and an exported image', () => {
    const h = garmentHealth('Double Breasted Blazer', [f('a.ai'), f('a.png')], true)
    expect(h.status).toBe('ready')
    expect(h.issues).toHaveLength(0)
  })
  it('warns when there is no editable source', () => {
    const h = garmentHealth('Casual Blazer', [f('a.png')], true)
    expect(h.status).toBe('warning')
    expect(h.issues.join(' ')).toMatch(/editable/i)
  })
  it('is incomplete without a usable preview', () => {
    expect(garmentHealth('Blazer', [f('notes.txt')], false).status).toBe('incomplete')
  })
  it('is incomplete when the name is generic/unrecognizable', () => {
    expect(garmentHealth('garment', [f('a.ai'), f('a.png')], true).status).toBe('incomplete')
  })
})

describe('56-garment pack grouping', () => {
  it('turns a category folder of 56 individual garment folders into 56 garments', () => {
    const files: ExtractedFile[] = []
    for (let i = 1; i <= 56; i++) {
      files.push(f(`Blazers/Blazer ${String(i).padStart(2, '0')}/AI/design.ai`))
      files.push(f(`Blazers/Blazer ${String(i).padStart(2, '0')}/PNG/front.png`))
    }
    const groups = groupIntoGarments(files, 'blazers-56.zip')
    expect(groups).toHaveLength(56)
    expect(groups.every((g) => g.category === 'blazer')).toBe(true)
    // no format folder ever becomes a garment name
    expect(groups.some((g) => g.name === 'AI' || g.name === 'PNG')).toBe(false)
    // each garment carries both its representations
    expect(groups.every((g) => g.files.length === 2)).toBe(true)
  })
})
