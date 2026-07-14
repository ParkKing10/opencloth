import { useIsPhone } from '../../lib/useMediaQuery'
import { DesktopOnly } from '../../components/DesktopOnly'
import { GarmentLab } from './GarmentLab'

/**
 * Route guard for the full-screen Garment Lab (region editor + AI generation). Same story as the
 * Design Studio: too dense for a phone, so we gate it to desktop and never mount the heavy editor.
 */
export function GarmentLabMobileGate() {
  const isPhone = useIsPhone()

  if (isPhone) {
    return (
      <DesktopOnly
        title="The Garment Lab needs a bigger screen"
        message="Creating and editing garments works best on a laptop or desktop. Open loom studios there to keep going."
        backTo="/suite/garments"
        backLabel="Back to Garments Studio"
      />
    )
  }

  return <GarmentLab />
}
