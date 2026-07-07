export function Logo() {
  return (
    <a className="brand" href="/" aria-label="THREADOS Startseite">
      <span className="brand__mark" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="26" height="26">
          <path
            d="M4 5h24v5.4h-8.6V27h-6.8V10.4H4V5Z"
            fill="var(--accent)"
          />
        </svg>
      </span>
      <span className="brand__text">
        <span className="brand__name">THREADOS</span>
        <span className="brand__tag">DESIGN. PRODUCE. SCALE.</span>
      </span>
    </a>
  )
}
