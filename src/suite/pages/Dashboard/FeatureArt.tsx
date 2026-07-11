/**
 * Bespoke per-card artwork for the dashboard feature cards.
 * Photo cards (Design Studio, AI Designer) use real product renders;
 * these three are crisp technical illustrations drawn as inline SVG.
 */

/** Tech Pack — flat spec sketches on a light document sheet. */
export function TechPackFlats() {
  return (
    <svg viewBox="0 0 240 300" className="feat-art__svg feat-art__svg--doc" aria-hidden="true">
      <defs>
        <linearGradient id="tpSheet" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f6f6f4" />
          <stop offset="100%" stopColor="#e4e4e2" />
        </linearGradient>
      </defs>
      <g transform="translate(28 44)">
        <rect x="0" y="0" width="184" height="230" rx="8" fill="url(#tpSheet)" />
        <rect x="0.5" y="0.5" width="183" height="229" rx="8" fill="none" stroke="rgba(0,0,0,0.08)" />
        {/* header */}
        <text x="14" y="22" fontFamily="Inter, sans-serif" fontSize="8" fontWeight="700" letterSpacing="1.5" fill="#2a2a30">
          TECH PACK · HOODIE
        </text>
        <line x1="14" y1="30" x2="170" y2="30" stroke="rgba(0,0,0,0.12)" />
        {/* flats */}
        <g stroke="#3a3a42" strokeWidth="1.1" fill="none" strokeLinejoin="round">
          {/* front */}
          <g transform="translate(24 44)">
            <path d="M20 4c-4 0-8 2-10 4L0 16l4 8 6-3v42h20V21l6 3 4-8-10-8c-2-2-6-4-10-4Z" />
            <path d="M12 6c1 4 4 7 8 7s7-3 8-7" />
            <path d="M12 42h16" />
          </g>
          {/* back */}
          <g transform="translate(76 44)">
            <path d="M20 4c-4 0-8 2-10 4L0 16l4 8 6-3v42h20V21l6 3 4-8-10-8c-2-2-6-4-10-4Z" />
            <path d="M20 4v14" />
          </g>
          {/* detail: sleeve */}
          <g transform="translate(128 46)" opacity="0.9">
            <path d="M2 2l14 4-2 34-10-2 2-30" />
          </g>
        </g>
        {/* dimension lines */}
        <g stroke="rgba(0,0,0,0.28)" strokeWidth="0.8">
          <path d="M24 40h40M24 38v4M64 38v4" />
        </g>
        <text x="40" y="36" fontFamily="Inter, sans-serif" fontSize="6" fill="rgba(0,0,0,0.45)">58</text>
        {/* spec rows */}
        <g stroke="rgba(0,0,0,0.1)">
          <line x1="14" y1="150" x2="170" y2="150" />
          <line x1="14" y1="168" x2="170" y2="168" />
          <line x1="14" y1="186" x2="170" y2="186" />
          <line x1="14" y1="204" x2="170" y2="204" />
        </g>
        <g fill="rgba(0,0,0,0.35)">
          <rect x="14" y="142" width="46" height="4" rx="2" />
          <rect x="14" y="160" width="60" height="4" rx="2" />
          <rect x="14" y="178" width="52" height="4" rx="2" />
          <rect x="14" y="196" width="64" height="4" rx="2" />
          <rect x="130" y="142" width="30" height="4" rx="2" opacity="0.7" />
          <rect x="134" y="160" width="26" height="4" rx="2" opacity="0.7" />
          <rect x="132" y="178" width="28" height="4" rx="2" opacity="0.7" />
        </g>
      </g>
    </svg>
  )
}

/** Manufacturer Hub — a wireframe globe with location pins. */
export function GlobePins() {
  return (
    <svg viewBox="0 0 240 300" fill="none" className="feat-art__svg" aria-hidden="true">
      <g transform="translate(120 168)">
        <g stroke="currentColor" strokeWidth="1" opacity="0.5">
          <circle cx="0" cy="0" r="78" />
          <ellipse cx="0" cy="0" rx="30" ry="78" />
          <ellipse cx="0" cy="0" rx="58" ry="78" />
          <line x1="-78" y1="0" x2="78" y2="0" />
          <path d="M-74 -28q74 22 148 0M-78 0q78 24 156 0M-74 28q74 -22 148 0" />
          <path d="M0 -78v156" />
        </g>
        {/* pins */}
        <g className="feat-globe__pins">
          <g transform="translate(-26 -30)">
            <path d="M0 0c-7 0-12 5-12 12 0 8 12 20 12 20s12-12 12-20c0-7-5-12-12-12Z" fill="var(--s-warn)" />
            <circle cx="0" cy="12" r="4.5" fill="rgba(0,0,0,0.35)" />
          </g>
          <g transform="translate(34 8)">
            <path d="M0 0c-6 0-10 4-10 10 0 7 10 17 10 17s10-10 10-17c0-6-4-10-10-10Z" fill="var(--s-warn)" opacity="0.9" />
            <circle cx="0" cy="10" r="3.6" fill="rgba(0,0,0,0.35)" />
          </g>
          <g transform="translate(6 -2)">
            <circle cx="0" cy="0" r="3" fill="var(--s-warn)" opacity="0.7" />
          </g>
        </g>
      </g>
    </svg>
  )
}
