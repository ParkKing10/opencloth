/** Left-hand brand panel shared by the login and signup screens. */
export function AuthBrand() {
  return (
    <aside className="auth__brand">
      <div className="auth__brand-top">
        <span className="auth__mark">
          <svg viewBox="0 0 32 32" width="20" height="20">
            <path d="M5 6h22v5h-8v15h-6V11H5V6Z" fill="currentColor" />
          </svg>
        </span>
        <span className="auth__wordmark">THREADOS</span>
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
