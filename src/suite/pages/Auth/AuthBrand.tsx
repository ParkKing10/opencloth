import { useT } from '@/i18n'
import loomLogo from '../../../assets/loom-logo.png'

/** Left-hand brand panel shared by the login and signup screens. */
export function AuthBrand() {
  const t = useT()
  return (
    <aside className="auth__brand">
      <div className="auth__brand-top">
        <img className="auth__logo" src={loomLogo} alt="loom studios" />
      </div>

      <div className="auth__pitch">
        <h2>
          {t('auth.brand.headline1')}
          <span>{t('auth.brand.headline2')}</span>
        </h2>
        <p>{t('auth.brand.pitch')}</p>
      </div>

      <div className="auth__stats">
        <div className="auth__stat">
          <b>10k+</b>
          <span>{t('auth.brand.creators')}</span>
        </div>
        <div className="auth__stat">
          <b>250k+</b>
          <span>{t('auth.brand.designs')}</span>
        </div>
        <div className="auth__stat">
          <b>1k+</b>
          <span>{t('auth.brand.manufacturers')}</span>
        </div>
      </div>
    </aside>
  )
}
