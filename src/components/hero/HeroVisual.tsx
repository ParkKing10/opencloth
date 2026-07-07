/**
 * Editorial product composition — spotlit black streetwear on a reflective
 * platform. Rendered as inline SVG so it stays crisp, themeable and light.
 * A photoreal render can be swapped into `.hero-visual__stage` later.
 */
export function HeroVisual() {
  return (
    <div className="hero-visual" aria-label="THREADOS Kollektion: Hoodie, T-Shirt, Cargohose und Cap">
      <div className="hero-visual__stage">
        <svg
          className="hero-visual__svg"
          viewBox="0 0 660 700"
          role="img"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="spot" cx="50%" cy="38%" r="55%">
              <stop offset="0%" stopColor="#cfd6e6" stopOpacity="0.5" />
              <stop offset="42%" stopColor="#8b93a8" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#8b93a8" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="floorGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#e9edf6" stopOpacity="0.9" />
              <stop offset="55%" stopColor="#aeb6c9" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#aeb6c9" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="fabric" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1c1e23" />
              <stop offset="52%" stopColor="#141519" />
              <stop offset="100%" stopColor="#0a0b0d" />
            </linearGradient>
            <linearGradient id="fabricDark" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#141518" />
              <stop offset="100%" stopColor="#08090b" />
            </linearGradient>
            <linearGradient id="fabricPants" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#191a1e" />
              <stop offset="100%" stopColor="#0b0c0e" />
            </linearGradient>
            <linearGradient id="rimLight" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#cdd6ea" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#cdd6ea" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Ambient spotlight */}
          <ellipse cx="330" cy="270" rx="330" ry="290" fill="url(#spot)" />

          {/* Reflective platform */}
          <g className="hv-platform">
            <ellipse cx="332" cy="612" rx="252" ry="34" fill="url(#floorGlow)" />
            <path
              d="M128 606 L536 606 L604 650 L60 650 Z"
              fill="#0e0f12"
              stroke="rgba(205,214,234,0.28)"
              strokeWidth="1"
            />
            <path d="M128 606 L536 606 L534 612 L130 612 Z" fill="rgba(220,228,244,0.35)" />
          </g>

          {/* --- Cargo pants (far right, behind) --- */}
          <g opacity="0.92">
            <path
              d="M486 250 L560 250 C566 250 570 255 570 262 L566 360 L556 520 C556 528 550 532 542 532 L520 532 C513 532 508 527 507 520 L500 380 L488 520 C487 527 482 532 475 532 L454 532 C446 532 441 527 442 519 L452 360 L450 262 C450 255 454 250 460 250 Z"
              fill="url(#fabricPants)"
              stroke="rgba(0,0,0,0.5)"
              strokeWidth="1"
            />
            {/* cargo pocket */}
            <rect x="536" y="330" width="30" height="42" rx="5" fill="#0a0b0d" stroke="rgba(120,128,145,0.18)" />
            <rect x="452" y="330" width="26" height="40" rx="5" fill="#0a0b0d" stroke="rgba(120,128,145,0.14)" />
            <path d="M486 252 L486 300" stroke="rgba(120,128,145,0.18)" strokeWidth="1.5" />
            <path d="M566 258 C562 300 560 420 556 515" stroke="url(#rimLight)" strokeWidth="2.5" fill="none" />
          </g>

          {/* --- T-shirt (center-right, behind) --- */}
          <g opacity="0.96">
            <path
              d="M398 232 C410 224 426 220 440 220 C454 220 470 224 482 232 L520 262 C526 267 526 275 521 281 L505 300 C501 305 494 305 489 301 L478 292 L474 430 C474 439 468 444 459 444 L421 444 C412 444 406 439 406 430 L402 292 L391 301 C386 305 379 305 375 300 L359 281 C354 275 354 267 360 262 Z"
              fill="url(#fabricDark)"
              stroke="rgba(0,0,0,0.5)"
              strokeWidth="1"
            />
            {/* collar */}
            <path d="M418 224 C428 240 452 240 462 224 C462 236 448 244 440 244 C432 244 418 236 418 224 Z" fill="#08090b" />
            <path d="M482 234 L520 262" stroke="url(#rimLight)" strokeWidth="2.5" fill="none" />
            <text x="440" y="330" className="hv-tee-print" textAnchor="middle">
              THREADOS
            </text>
          </g>

          {/* --- Hoodie (center, main) --- */}
          <g className="hv-hoodie">
            {/* left sleeve */}
            <path
              d="M214 296 C196 302 184 318 178 340 L146 452 C141 470 150 484 168 489 L206 500 C223 505 237 495 240 477 L256 330 Z"
              fill="url(#fabricDark)"
              stroke="rgba(0,0,0,0.55)"
              strokeWidth="1"
            />
            {/* right sleeve */}
            <path
              d="M446 296 C464 302 476 318 482 340 L514 452 C519 470 510 484 492 489 L454 500 C437 505 423 495 420 477 L404 330 Z"
              fill="url(#fabricDark)"
              stroke="rgba(0,0,0,0.55)"
              strokeWidth="1"
            />
            {/* body */}
            <path
              d="M244 268 L416 268 C430 268 440 279 442 296 L462 540 C464 561 450 574 428 574 L232 574 C210 574 196 561 198 540 L218 296 C220 279 230 268 244 268 Z"
              fill="url(#fabric)"
              stroke="rgba(0,0,0,0.5)"
              strokeWidth="1"
            />
            {/* hood */}
            <path
              d="M262 236 C276 196 306 172 330 172 C354 172 384 196 398 236 C402 250 396 262 382 262 L278 262 C264 262 258 250 262 236 Z"
              fill="url(#fabricDark)"
              stroke="rgba(0,0,0,0.45)"
              strokeWidth="1"
            />
            {/* inner hood shadow */}
            <path d="M286 250 C300 282 360 282 374 250 C374 274 356 288 330 288 C304 288 286 274 286 250 Z" fill="#050506" />
            {/* collar ribbing */}
            <path d="M282 252 L378 252 L374 266 L286 266 Z" fill="#101115" opacity="0.9" />
            {/* drawstrings */}
            <path d="M314 262 L311 320" stroke="#2a2c31" strokeWidth="4" strokeLinecap="round" />
            <path d="M330 262 L332 322" stroke="#2a2c31" strokeWidth="4" strokeLinecap="round" />
            <circle cx="311" cy="322" r="4" fill="#1a1b1f" />
            <circle cx="332" cy="324" r="4" fill="#1a1b1f" />
            {/* kangaroo pocket */}
            <path
              d="M256 442 L404 442 C412 442 417 449 415 458 L408 496 C406 504 400 508 392 508 L268 508 C260 508 254 504 252 496 L245 458 C243 449 248 442 256 442 Z"
              fill="#0c0d10"
              stroke="rgba(120,128,145,0.14)"
              strokeWidth="1"
            />
            <path d="M256 452 L270 448 M404 452 L390 448" stroke="rgba(0,0,0,0.6)" strokeWidth="2" />
            {/* seams / hem */}
            <path d="M330 288 L330 442" stroke="rgba(0,0,0,0.35)" strokeWidth="1.5" />
            <path d="M226 560 L436 560" stroke="rgba(0,0,0,0.5)" strokeWidth="6" strokeLinecap="round" />
            {/* rim light */}
            <path d="M244 274 C230 300 216 460 226 556" stroke="url(#rimLight)" strokeWidth="3" fill="none" />
            <path d="M266 232 C288 200 310 184 330 182" stroke="url(#rimLight)" strokeWidth="2.5" fill="none" />
            {/* chest print */}
            <text x="330" y="392" className="hv-hoodie-print" textAnchor="middle">
              THREADOS
            </text>
            {/* logo patch */}
            <g transform="translate(322 522)">
              <rect x="0" y="0" width="16" height="16" rx="3" fill="#0a0b0d" stroke="rgba(209,249,79,0.35)" />
              <path d="M3 4h10v2.2h-3.9V13H6.9V6.2H3Z" fill="var(--accent)" opacity="0.85" />
            </g>
          </g>

          {/* --- Cap (front) --- */}
          <g className="hv-cap">
            <ellipse cx="356" cy="632" rx="86" ry="14" fill="rgba(0,0,0,0.5)" />
            <path
              d="M300 604 C300 576 326 560 356 560 C386 560 412 576 412 604 C412 612 406 616 398 616 L314 616 C306 616 300 612 300 604 Z"
              fill="url(#fabricDark)"
              stroke="rgba(120,128,145,0.16)"
              strokeWidth="1"
            />
            {/* brim */}
            <path
              d="M396 612 C430 612 452 620 452 628 C452 636 430 640 402 638 C392 637 388 630 390 622 Z"
              fill="#0b0c0e"
              stroke="rgba(120,128,145,0.14)"
              strokeWidth="1"
            />
            <path d="M356 566 L356 612 M330 570 C334 588 334 600 332 612 M382 570 C378 588 378 600 380 612" stroke="rgba(0,0,0,0.5)" strokeWidth="1.5" fill="none" />
            {/* cap logo */}
            <g transform="translate(348 582)">
              <path d="M2 2h14v3.1h-5.5V15H8V5.1H2Z" fill="var(--accent)" />
            </g>
            <path d="M302 596 C304 580 324 566 352 564" stroke="url(#rimLight)" strokeWidth="2" fill="none" />
          </g>
        </svg>
      </div>
    </div>
  )
}
