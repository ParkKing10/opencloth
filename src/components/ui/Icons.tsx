import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  viewBox: '0 0 24 24',
}

export const Bolt = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z" fill="currentColor" stroke="none" />
  </svg>
)

export const Chevron = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="m6 9 6 6 6-6" />
  </svg>
)

export const ArrowRight = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)

export const Play = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M8 5.5v13l11-6.5-11-6.5Z" fill="currentColor" stroke="none" />
  </svg>
)

export const Globe = (p: IconProps) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" />
  </svg>
)

export const Shield = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M12 3 5 6v5c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
)

export const Users = (p: IconProps) => (
  <svg {...base} {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 20c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5" />
    <path d="M16 5.2A3.2 3.2 0 0 1 16 11m1 3.7c2.4.5 4 2.6 4 5.3" />
  </svg>
)

export const Cube = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M12 2.6 20 7v10l-8 4.4L4 17V7l8-4.4Z" />
    <path d="M4 7l8 4.5L20 7M12 11.5V21.4" />
  </svg>
)

export const Doc = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M6 2.6h8l4 4V21a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3.6a1 1 0 0 1 1-1Z" />
    <path d="M14 2.6V7h4M8.5 12h7M8.5 16h7" />
  </svg>
)

export const Factory = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M3 21h18M4 21V10l6 4V10l6 4V6l4 2v13" />
    <path d="M7 21v-3.5M12 21v-3.5M17 21v-3.5" />
  </svg>
)
