import { useSearchParams } from 'react-router-dom'
import { useT } from '@/i18n'
import { useIsPhone } from '../../lib/useMediaQuery'
import { DesktopOnly } from '../../components/DesktopOnly'
import { DesignStudio } from './DesignStudio'

/**
 * Route guard for the full-screen Design Studio editor. On phones the canvas editor is impractical,
 * so we never mount it — we show a friendly "open on desktop" screen (personalised with the garment
 * name when it's in the URL) instead. On tablet/desktop the real editor renders unchanged.
 */
export function StudioMobileGate() {
  const isPhone = useIsPhone()
  const [params] = useSearchParams()
  const t = useT()

  if (isPhone) {
    const name = params.get('name')
    return (
      <DesktopOnly
        title={t('dsMain.gate.title')}
        message={name ? t('dsMain.gate.messageNamed', { name }) : t('dsMain.gate.message')}
        backTo="/suite/design"
        backLabel={t('dsMain.gate.back')}
      />
    )
  }

  return <DesignStudio />
}
