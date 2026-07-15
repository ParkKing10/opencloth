/* ============================================================
   Explainer Studio — now the AI Commercial Director.
   The user describes ideas; the AI directs the motion. A project
   is a list of independent AI clips (each with its own prompt and
   assets), followed by a deliberately simple project editor:
   trim, reorder, transitions, music, subtitles, export.
   The old scene/timeline workflow is gone.
   ============================================================ */

import { useT } from '@/i18n'
import { SuitePage } from '../_shared/SuitePage'
import { DirectorStudio } from './DirectorStudio'

export function Explainer() {
  const t = useT()
  return (
    <SuitePage eyebrow={t('director.page.eyebrow')} title={t('director.page.title')} subtitle={t('director.page.subtitle')} wide>
      <DirectorStudio />
    </SuitePage>
  )
}
