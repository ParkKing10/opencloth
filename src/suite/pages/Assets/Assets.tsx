import { useNavigate } from 'react-router-dom'
import { useT } from '@/i18n'
import { SuitePage } from '../_shared/SuitePage'
import { useAuth } from '../../auth/auth'
import { AssetLibrary } from '../../assets/ui/AssetLibrary'
import './assets.css'

/**
 * Assets — every graphic the user has uploaded or generated with loom studios AI (prints, patches,
 * stickers, campaign shots). Reuses the AssetLibrary panel (search, upload, favorite, delete) as a
 * full page. Placing an asset routes into the Design Studio, where it drops onto the canvas.
 */
export function Assets() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const t = useT()
  return (
    <SuitePage
      eyebrow={t('assets.page.eyebrow')}
      title={t('assets.page.title')}
      subtitle={t('assets.page.subtitle')}
      wide
    >
      <div className="assets-page">
        <AssetLibrary userId={user?.id} onPlace={() => navigate('/design')} page />
      </div>
    </SuitePage>
  )
}
