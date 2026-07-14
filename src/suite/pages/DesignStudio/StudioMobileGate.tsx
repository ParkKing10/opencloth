import { useSearchParams } from 'react-router-dom'
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

  if (isPhone) {
    const name = params.get('name')
    return (
      <DesktopOnly
        title="The Design Studio needs a bigger canvas"
        message={
          name
            ? `“${name}” is ready — open loom studios on a laptop or desktop to design, place graphics and export it.`
            : 'The editor is built for a larger screen. Open loom studios on a laptop or desktop to design, place graphics and export your piece.'
        }
        backTo="/suite/design"
        backLabel="Back to Design Studio"
      />
    )
  }

  return <DesignStudio />
}
