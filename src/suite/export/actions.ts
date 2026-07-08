import type { ManufacturingProject } from './types'
import { generateTechPackPdf } from './generators/techpack'
import { generateSizeChartPdf } from './generators/docs'
import { generateBomXlsx } from './generators/bom'
import { generatePatternDxf, generatePatternPdf } from './generators/pattern'
import { generateBrandAi, generateBrandSvg } from './generators/logo'
import { generatePrintAsset, printViews } from './generators/printAssets'
import { generateDesignPng, generateProjectJson } from './generators/design'
import { zipEntries } from './generators/zip'
import { slugify } from '../lib/download'

export type ExportItemId =
  | 'package'
  | 'techPack'
  | 'sizeChart'
  | 'bom'
  | 'printAssets'
  | 'patterns'
  | 'logos'
  | 'design'

export type ExportItem = {
  id: ExportItemId
  title: string
  desc: string
  badge: string
  /** The flagship package opens the modal; every other item builds a file directly. */
  kind: 'package' | 'file'
  build?: (p: ManufacturingProject) => Promise<{ blob: Blob; filename: string }>
}

/** The eight Export menu entries, in display order. */
export const EXPORT_ITEMS: ExportItem[] = [
  {
    id: 'package',
    title: 'Manufacturing Package',
    desc: 'Everything a factory needs, in one .zip',
    badge: '.ZIP',
    kind: 'package',
  },
  {
    id: 'techPack',
    title: 'Tech Pack',
    desc: 'Full production specification',
    badge: 'PDF',
    kind: 'file',
    build: async (p) => ({ blob: generateTechPackPdf(p), filename: `${slugify(p.meta.styleName)}-techpack.pdf` }),
  },
  {
    id: 'sizeChart',
    title: 'Size Chart',
    desc: 'Graded measurements, all sizes',
    badge: 'PDF',
    kind: 'file',
    build: async (p) => ({ blob: generateSizeChartPdf(p), filename: `${slugify(p.meta.styleName)}-sizechart.pdf` }),
  },
  {
    id: 'bom',
    title: 'Bill of Materials',
    desc: 'Editable materials workbook',
    badge: 'XLSX',
    kind: 'file',
    build: async (p) => ({ blob: await generateBomXlsx(p), filename: `${slugify(p.meta.styleName)}-bom.xlsx` }),
  },
  {
    id: 'printAssets',
    title: 'Print Assets',
    desc: 'Front, back & sleeve placement (300 DPI)',
    badge: 'PNG',
    kind: 'file',
    build: async (p) => {
      const entries = await Promise.all(
        printViews(p).map(async (view) => ({
          name: `${view.charAt(0).toUpperCase() + view.slice(1)}.png`,
          data: await generatePrintAsset(p, view),
        })),
      )
      return { blob: await zipEntries(entries), filename: `${slugify(p.meta.styleName)}-print-assets.zip` }
    },
  },
  {
    id: 'patterns',
    title: 'Pattern Files',
    desc: 'CAD-ready DXF + reference PDF',
    badge: 'DXF',
    kind: 'file',
    build: async (p) => {
      const blob = await zipEntries([
        { name: 'Pattern.dxf', data: generatePatternDxf(p) },
        { name: 'Pattern.pdf', data: generatePatternPdf(p) },
      ])
      return { blob, filename: `${slugify(p.meta.styleName)}-patterns.zip` }
    },
  },
  {
    id: 'logos',
    title: 'Logo Pack',
    desc: 'Vector brand lockup (SVG + AI)',
    badge: 'SVG',
    kind: 'file',
    build: async (p) => {
      const blob = await zipEntries([
        { name: 'Brand.svg', data: generateBrandSvg(p) },
        { name: 'Brand.ai', data: generateBrandAi(p) },
      ])
      return { blob, filename: `${slugify(p.meta.styleName)}-logos.zip` }
    },
  },
  {
    id: 'design',
    title: 'Design Export',
    desc: 'Render + re-importable project file',
    badge: 'PNG',
    kind: 'file',
    build: async (p) => {
      const blob = await zipEntries([
        { name: 'design.png', data: await generateDesignPng(p) },
        { name: 'project.json', data: generateProjectJson(p) },
      ])
      return { blob, filename: `${slugify(p.meta.styleName)}-design.zip` }
    },
  },
]
