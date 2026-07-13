import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../data/store'
import { useAuth } from '../../auth/auth'
import { useToast } from '../../components/ui/Toast'
import { loadDesignThumb } from '../../data/designThumbs'
import { DesignLauncher, type LauncherDesign } from './DesignLauncher'

/**
 * Design Studio landing — the launcher rendered INSIDE the suite shell (with the sidebar), so it's a
 * normal navigable page, not a full-screen dead-end. Picking a design (or "Start new") opens the
 * full-screen editor at /suite/studio. No back button: the sidebar already provides navigation.
 */
export function DesignStudioLanding() {
  const navigate = useNavigate()
  const { data } = useStore()
  const { user } = useAuth()
  const toast = useToast()

  const designs = useMemo<LauncherDesign[]>(() => {
    if (!user) return []
    return data.designs
      .filter((d) => d.ownerId === user.id)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 24)
      .map((d) => ({ id: d.id, name: d.name, thumb: loadDesignThumb(d.id) ?? undefined, updatedAt: d.updatedAt }))
  }, [data.designs, user])

  return (
    <DesignLauncher
      inline
      designs={designs}
      onOpen={(id) => navigate(`/suite/studio?garment=${encodeURIComponent(id)}`)}
      onNew={() => navigate('/suite/studio')}
      onGetApp={() => toast('The THREADOS mobile app is coming soon — design your clothes on the go.', 'info')}
    />
  )
}
