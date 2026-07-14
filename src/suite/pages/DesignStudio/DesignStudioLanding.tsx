import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../data/store'
import { useAuth } from '../../auth/auth'
import { useToast } from '../../components/ui/Toast'
import { useIsPhone } from '../../lib/useMediaQuery'
import { loadDesignThumb } from '../../data/designThumbs'
import { useT } from '@/i18n'
import { DesignLauncher, type LauncherDesign } from './DesignLauncher'
import { StudioMobile } from './StudioMobile'

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
  const t = useT()
  const isPhone = useIsPhone()

  const designs = useMemo<LauncherDesign[]>(() => {
    if (!user) return []
    return data.designs
      .filter((d) => d.ownerId === user.id)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 24)
      .map((d) => ({ id: d.id, name: d.name, thumb: loadDesignThumb(d.id) ?? undefined, updatedAt: d.updatedAt }))
  }, [data.designs, user])

  // Phones can't run the canvas editor — the launcher would only lead to a dead-end gate. Give them
  // the AI-first Studio instead (design a graphic / create a garment / edit a garment).
  if (isPhone) return <StudioMobile />

  return (
    <DesignLauncher
      inline
      designs={designs}
      onOpen={(id) => navigate(`/studio?garment=${encodeURIComponent(id)}`)}
      onNew={() => navigate('/studio')}
      onGetApp={() => toast(t('studioLanding.toast.comingSoon'), 'info')}
    />
  )
}
