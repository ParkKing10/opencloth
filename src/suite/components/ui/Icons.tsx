import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>

const s = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export const IcoDashboard = (p: P) => (
  <svg {...s} {...p}>
    <rect x="3" y="3" width="7.5" height="8.5" rx="2" />
    <rect x="13.5" y="3" width="7.5" height="5.5" rx="2" />
    <rect x="3" y="15.5" width="7.5" height="5.5" rx="2" />
    <rect x="13.5" y="12.5" width="7.5" height="8.5" rx="2" />
  </svg>
)

export const IcoDesign = (p: P) => (
  <svg {...s} {...p}>
    <path d="M12 3a9 9 0 1 0 0 18c1.2 0 2-.9 2-2 0-.5-.2-1-.6-1.4-.3-.4-.5-.8-.5-1.3 0-1 .8-1.8 1.8-1.8H16a5 5 0 0 0 5-5c0-3.6-4-6.5-9-6.5Z" />
    <circle cx="7.5" cy="11" r="1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="8" r="1" fill="currentColor" stroke="none" />
    <circle cx="16.5" cy="11" r="1" fill="currentColor" stroke="none" />
  </svg>
)

export const IcoPattern = (p: P) => (
  <svg {...s} {...p}>
    <circle cx="6" cy="6" r="2.4" />
    <circle cx="6" cy="18" r="2.4" />
    <path d="M8.2 7.6 20 19M8.2 16.4 20 5" />
    <path d="M18.5 4.5 20 5l-.5 1.5M18.5 19.5 20 19l-.5-1.5" />
  </svg>
)

export const IcoAI = (p: P) => (
  <svg {...s} {...p}>
    <path d="M12 3.2 13.4 8 18.2 9.4 13.4 10.8 12 15.6 10.6 10.8 5.8 9.4 10.6 8 12 3.2Z" />
    <path d="M18.5 15.5 19.2 17.6 21.3 18.3 19.2 19 18.5 21.1 17.8 19 15.7 18.3 17.8 17.6 18.5 15.5Z" />
  </svg>
)

export const IcoTechPack = (p: P) => (
  <svg {...s} {...p}>
    <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
    <path d="M14 3v4h4M9 12h6M9 16h4" />
  </svg>
)

export const IcoFactory = (p: P) => (
  <svg {...s} {...p}>
    <path d="M3 21h18M4 21V11l6 3.5V11l6 3.5V7l4 2v12" />
    <path d="M7.5 21v-3M12 21v-3M16.5 21v-3" />
  </svg>
)

export const IcoProduction = (p: P) => (
  <svg {...s} {...p}>
    <path d="M12 2.7 20 7v10l-8 4.3L4 17V7l8-4.3Z" />
    <path d="M4 7l8 4.5L20 7M12 11.5V21.3" />
  </svg>
)

export const IcoCollections = (p: P) => (
  <svg {...s} {...p}>
    <path d="M3 7.5a2 2 0 0 1 2-2h3.4a2 2 0 0 1 1.5.7l1 1.1H19a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9Z" />
  </svg>
)

export const IcoCommunity = (p: P) => (
  <svg {...s} {...p}>
    <circle cx="9" cy="8.5" r="2.7" />
    <path d="M3.8 19.5c0-3 2.3-5 5.2-5s5.2 2 5.2 5" />
    <path d="M16 6.2a2.7 2.7 0 0 1 0 5.1m1 3.4c2.2.4 3.8 2.2 3.8 4.8" />
  </svg>
)

export const IcoMarketplace = (p: P) => (
  <svg {...s} {...p}>
    <path d="M4 4h2l1.2 11.2a1.5 1.5 0 0 0 1.5 1.3h8.1a1.5 1.5 0 0 0 1.5-1.2L20 8H6.2" />
    <circle cx="9.5" cy="20" r="1.3" />
    <circle cx="17.5" cy="20" r="1.3" />
  </svg>
)

export const IcoAnalytics = (p: P) => (
  <svg {...s} {...p}>
    <path d="M4 20V4M4 20h16" />
    <path d="M8 16l3.5-4 3 2.5L20 8" />
  </svg>
)

export const IcoSettings = (p: P) => (
  <svg {...s} {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 13.5a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1A2 2 0 1 1 4.2 17l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1A2 2 0 1 1 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 1 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </svg>
)

export const IcoSearch = (p: P) => (
  <svg {...s} {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
)

export const IcoBell = (p: P) => (
  <svg {...s} {...p}>
    <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
    <path d="M10 19a2 2 0 0 0 4 0" />
  </svg>
)

export const IcoHelp = (p: P) => (
  <svg {...s} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.2a2.5 2.5 0 0 1 4.8.9c0 1.7-2.3 2.2-2.3 3.9" />
    <circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" />
  </svg>
)

export const IcoPlus = (p: P) => (
  <svg {...s} {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const IcoUpload = (p: P) => (
  <svg {...s} {...p}>
    <path d="M12 16V4M8 8l4-4 4 4" />
    <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </svg>
)

export const IcoCoins = (p: P) => (
  <svg {...s} {...p}>
    <ellipse cx="9" cy="7" rx="5.5" ry="2.6" />
    <path d="M3.5 7v5c0 1.4 2.5 2.6 5.5 2.6M14.5 10.4c3-.1 5-1.3 5-2.6" />
    <ellipse cx="15" cy="14.5" rx="5.5" ry="2.6" />
    <path d="M9.5 14.4v2.6c0 1.4 2.5 2.6 5.5 2.6s5.5-1.2 5.5-2.6v-5" />
  </svg>
)

export const IcoChevron = (p: P) => (
  <svg {...s} {...p}>
    <path d="m6 9 6 6 6-6" />
  </svg>
)

export const IcoArrowRight = (p: P) => (
  <svg {...s} {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)

export const IcoBolt = (p: P) => (
  <svg {...s} {...p}>
    <path d="M13 2 4.5 13.5H11l-1 8.5L18.5 10.5H12l1-8.5Z" />
  </svg>
)

export const IcoSparkle = (p: P) => (
  <svg {...s} {...p}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
  </svg>
)

export const IcoCheck = (p: P) => (
  <svg {...s} {...p}>
    <path d="m4 12 5 5L20 6" />
  </svg>
)

export const IcoCommand = (p: P) => (
  <svg {...s} {...p}>
    <path d="M9 6a2 2 0 1 0-2 2h10a2 2 0 1 0-2-2v10a2 2 0 1 0 2-2H7a2 2 0 1 0 2 2V6Z" />
  </svg>
)

export const IcoGrid = (p: P) => (
  <svg {...s} {...p}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
  </svg>
)

export const IcoEye = (p: P) => (
  <svg {...s} {...p}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="2.6" />
  </svg>
)

export const IcoDots = (p: P) => (
  <svg {...s} {...p}>
    <circle cx="5" cy="12" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.3" fill="currentColor" stroke="none" />
  </svg>
)

export const IcoStar = (p: P) => (
  <svg {...s} {...p}>
    <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9L12 3.5Z" />
  </svg>
)

export const IcoTrend = (p: P) => (
  <svg {...s} {...p}>
    <path d="M4 15l5-5 3 3 8-8" />
    <path d="M16 5h4v4" />
  </svg>
)

export const IcoLogout = (p: P) => (
  <svg {...s} {...p}>
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
    <path d="M10 12h9M16 9l3 3-3 3" />
  </svg>
)
