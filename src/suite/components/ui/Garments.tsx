import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>

const g = {
  viewBox: '0 0 48 48',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinejoin: 'round' as const,
  strokeLinecap: 'round' as const,
}

export const GHoodie = (p: P) => (
  <svg {...g} {...p}>
    <path d="M18 8c0 3 2.5 5 6 5s6-2 6-5" />
    <path d="M18 8c-2 .6-4 1.6-5.5 3L8 15l3.5 5 3-2v18a2 2 0 0 0 2 2h15a2 2 0 0 0 2-2V18l3 2 3.5-5-4.5-4c-1.5-1.4-3.5-2.4-5.5-3" />
    <path d="M24 13v9M21 26h6" />
  </svg>
)

export const GTee = (p: P) => (
  <svg {...g} {...p}>
    <path d="M18 8c0 2.5 2.5 4 6 4s6-1.5 6-4" />
    <path d="M18 8l-9 5 3.5 6 2.5-1.6V38a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V17.4l2.5 1.6L39 13l-9-5" />
  </svg>
)

export const GJacket = (p: P) => (
  <svg {...g} {...p}>
    <path d="M17 8l7 5 7-5" />
    <path d="M17 8c-2 .5-6 2-7.5 3.5L7 14l3 5 2-1.2V38a2 2 0 0 0 2 2h20a2 2 0 0 0 2-2V17.8l2 1.2 3-5-2.5-2.5C37 10 33 8.5 31 8" />
    <path d="M24 13v27M20 20h2M20 25h2" />
  </svg>
)

export const GPants = (p: P) => (
  <svg {...g} {...p}>
    <path d="M15 7h18l-1 14-1.5 20h-6L24 24l-1.5 17h-6L14 21 15 7Z" />
    <path d="M15 7h18M24 8v13M30 13h4l1 6-3 1" />
  </svg>
)

export const GCap = (p: P) => (
  <svg {...g} {...p}>
    <path d="M11 30c0-8 6-14 13-14s13 6 13 14" />
    <path d="M11 30h26M37 30c5 0 8 1.5 8 4s-3 3.5-9 3.5" />
    <path d="M24 16v14" />
  </svg>
)

export const GARMENT_GLYPHS = {
  hoodie: GHoodie,
  tee: GTee,
  jacket: GJacket,
  pants: GPants,
  cap: GCap,
} as const

export type GarmentKind = keyof typeof GARMENT_GLYPHS
