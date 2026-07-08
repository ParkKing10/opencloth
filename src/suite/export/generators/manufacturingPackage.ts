import JSZip from 'jszip'
import type { ManufacturingProject, PackageProgress, PackageSelection } from '../types'
import { generateTechPackPdf } from './techpack'
import {
  generateColorReferencesPdf,
  generatePackagingGuidePdf,
  generateProductionNotesPdf,
  generateReadmePdf,
  generateSizeChartPdf,
} from './docs'
import { generateBomXlsx } from './bom'
import { generatePatternDxf, generatePatternPdf } from './pattern'
import { generateBrandAi, generateBrandSvg } from './logo'
import { generatePrintAsset, printViews } from './printAssets'
import { generateDesignPng, generateProjectJson } from './design'

type BuildTask = { key: keyof PackageSelection; label: string; run: (zip: JSZip) => void | Promise<void> }

/** Ordered build plan; only tasks whose selection flag is true are executed. */
function plan(p: ManufacturingProject): BuildTask[] {
  return [
    { key: 'readme', label: 'Writing README', run: (z) => void z.file('README.pdf', generateReadmePdf(p)) },
    { key: 'techPack', label: 'Rendering tech pack', run: (z) => void z.file('TechPack.pdf', generateTechPackPdf(p)) },
    { key: 'sizeChart', label: 'Grading size chart', run: (z) => void z.file('SizeChart.pdf', generateSizeChartPdf(p)) },
    {
      key: 'bom',
      label: 'Compiling bill of materials',
      run: async (z) => {
        z.file('BOM.xlsx', await generateBomXlsx(p))
      },
    },
    {
      key: 'productionNotes',
      label: 'Assembling production notes',
      run: (z) => void z.file('ProductionNotes.pdf', generateProductionNotesPdf(p)),
    },
    {
      key: 'colorReferences',
      label: 'Building color references',
      run: (z) => void z.file('ColorReferences.pdf', generateColorReferencesPdf(p)),
    },
    {
      key: 'packaging',
      label: 'Drafting packaging guide',
      run: (z) => void z.folder('Packaging')!.file('PackagingGuide.pdf', generatePackagingGuidePdf(p)),
    },
    {
      key: 'printAssets',
      label: 'Exporting print assets (300 DPI)',
      run: async (z) => {
        const folder = z.folder('PrintAssets')!
        for (const view of printViews(p)) {
          const name = view.charAt(0).toUpperCase() + view.slice(1)
          folder.file(`${name}.png`, await generatePrintAsset(p, view))
        }
      },
    },
    {
      key: 'logos',
      label: 'Packing brand logos',
      run: (z) => {
        const folder = z.folder('Logos')!
        folder.file('Brand.svg', generateBrandSvg(p))
        folder.file('Brand.ai', generateBrandAi(p))
      },
    },
    {
      key: 'patterns',
      label: 'Cutting pattern files',
      run: (z) => {
        const folder = z.folder('Patterns')!
        folder.file('Pattern.dxf', generatePatternDxf(p))
        folder.file('Pattern.pdf', generatePatternPdf(p))
      },
    },
  ]
}

/**
 * Assemble the full manufacturing package as a real .zip Blob, generating every
 * file dynamically from the project. Emits progress so the modal can animate.
 */
export async function buildManufacturingPackage(
  p: ManufacturingProject,
  selection: PackageSelection,
  onProgress?: (e: PackageProgress) => void,
): Promise<Blob> {
  const zip = new JSZip()
  const tasks = plan(p).filter((t) => selection[t.key])
  // always include the machine-readable source of truth
  const total = tasks.length + 2 // + design manifest + zip compression
  let done = 0
  const tick = (step: string) => onProgress?.({ step, done: ++done, total })

  for (const task of tasks) {
    onProgress?.({ step: task.label, done, total })
    await task.run(zip)
    tick(task.label)
  }

  // design source (json + render) — the re-importable design record
  onProgress?.({ step: 'Saving design source', done, total })
  const design = zip.folder('Design')!
  design.file('project.json', generateProjectJson(p))
  design.file('design.png', await generateDesignPng(p))
  tick('Saving design source')

  onProgress?.({ step: 'Compressing package', done, total })
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
  tick('Compressing package')
  return blob
}
