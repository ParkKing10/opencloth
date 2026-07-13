import { useNavigate } from 'react-router-dom'
import { SuitePage } from '../_shared/SuitePage'
import { useAuth } from '../../auth/auth'
import { AssetLibrary } from '../../assets/ui/AssetLibrary'
import './assets.css'

/**
 * Assets — every graphic the user has uploaded or generated with THREADOS AI (prints, patches,
 * stickers, campaign shots). Reuses the AssetLibrary panel (search, upload, favorite, delete) as a
 * full page. Placing an asset routes into the Design Studio, where it drops onto the canvas.
 */
export function Assets() {
  const { user } = useAuth()
  const navigate = useNavigate()
  return (
    <SuitePage
      eyebrow="Workspace"
      title="Assets"
      subtitle="Every graphic you've uploaded or generated with THREADOS AI — prints, patches, stickers and campaign shots."
      wide
    >
      <div className="assets-page">
        <AssetLibrary userId={user?.id} onPlace={() => navigate('/suite/design')} />
      </div>
    </SuitePage>
  )
}
