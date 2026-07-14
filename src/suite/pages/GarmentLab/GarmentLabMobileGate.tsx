import { useT } from '@/i18n'
import { useIsPhone } from '../../lib/useMediaQuery'
import { DesktopOnly } from '../../components/DesktopOnly'
import { GarmentLab } from './GarmentLab'

/**
 * Route guard for the full-screen Garment Lab (region editor + AI generation). Same story as the
 * Design Studio: too dense for a phone, so we gate it to desktop and never mount the heavy editor.
 */
export function GarmentLabMobileGate() {
  const t = useT()
  const isPhone = useIsPhone()

  if (isPhone) {
    return (
      <DesktopOnly
        title={t('labMain.mobileTitle')}
        message={t('labMain.mobileMessage')}
        backTo="/suite/garments"
        backLabel={t('labMain.mobileBack')}
      />
    )
  }

  return <GarmentLab />
}
