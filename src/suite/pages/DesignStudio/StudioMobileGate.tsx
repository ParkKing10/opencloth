import { Navigate } from 'react-router-dom'
import { useIsPhone } from '../../lib/useMediaQuery'
import { DesignStudio } from './DesignStudio'

/**
 * Route guard for the full-screen Design Studio editor. On phones the canvas editor is impractical, so
 * we never mount it — instead of a dead-end we send the user to the Studio landing, which on phones is
 * the AI-first mobile Studio (design a graphic / create a garment / edit a garment). Tablet/desktop get
 * the real editor unchanged.
 */
export function StudioMobileGate() {
  const isPhone = useIsPhone()

  if (isPhone) return <Navigate to="/design" replace />

  return <DesignStudio />
}
