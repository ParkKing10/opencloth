import loomLogo from '../../../assets/loom-logo.png'

/** Left-hand brand panel shared by the login and signup screens. */
export function AuthBrand() {
  return (
    <aside className="auth__brand">
      <div className="auth__brand-top">
        <img className="auth__logo" src={loomLogo} alt="loom studios" />
      </div>

      <div className="auth__pitch">
        <h2>
          The operating system for <span>fashion brands.</span>
        </h2>
        <p>Design, produce and launch your collection — from first idea to production, all in one place.</p>
      </div>

      <div className="auth__stats">
        <div className="auth__stat">
          <b>10k+</b>
          <span>Creators</span>
        </div>
        <div className="auth__stat">
          <b>250k+</b>
          <span>Designs</span>
        </div>
        <div className="auth__stat">
          <b>1k+</b>
          <span>Manufacturers</span>
        </div>
      </div>
    </aside>
  )
}
