/** Left-hand brand panel shared by the login and signup screens. */
export function AuthBrand() {
  return (
    <aside className="auth__brand">
      <div className="auth__brand-top">
        <span className="auth__mark">
          <svg viewBox="0 0 32 32" width="20" height="20">
            <path d="M16 4 L28 11 L16 18 L4 11 Z M4 15 L16 22 L28 15 L28 18 L16 25 L4 18 Z" fill="currentColor" />
          </svg>
        </span>
        <span className="auth__wordmark">loom studios</span>
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
