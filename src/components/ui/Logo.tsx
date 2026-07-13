export function Logo() {
  return (
    <a className="brand" href="/" aria-label="loom studios Startseite">
      <span className="brand__mark" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="26" height="26">
          <path
            d="M16 4 L28 11 L16 18 L4 11 Z M4 15 L16 22 L28 15 L28 18 L16 25 L4 18 Z"
            fill="var(--accent)"
          />
        </svg>
      </span>
      <span className="brand__text">
        <span className="brand__name">loom studios</span>
        <span className="brand__tag">DESIGN. PRODUCE. SCALE.</span>
      </span>
    </a>
  )
}
