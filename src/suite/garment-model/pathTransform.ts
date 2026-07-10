/**
 * Pure SVG-path coordinate transforms, used by the AI garment editor for geometric edits
 * (wider sleeves, cropped/oversized fit). Only absolute commands whose args are all (x,y)
 * pairs are supported — M L Q C T S and Z. If a path uses anything else (relative commands,
 * H/V, or A arcs), transform returns null and the caller keeps the original path untouched.
 * That keeps every transform exact and honest rather than silently corrupting geometry.
 */
const PAIR_COMMANDS = new Set(['M', 'L', 'Q', 'C', 'T', 'S'])
const SUPPORTED = /^[MLQCTSZ\s,\-0-9.eE]+$/

export type Point = { x: number; y: number }

const round = (n: number) => Math.round(n * 100) / 100

/** Map every coordinate pair in an absolute path through `fn`. Returns null if unsupported. */
export function transformPath(d: string, fn: (p: Point) => Point): string | null {
  if (!SUPPORTED.test(d)) return null
  const tokens = d.match(/[MLQCTSZ]|-?\d*\.?\d+(?:[eE][-+]?\d+)?/g)
  if (!tokens) return null

  const out: string[] = []
  let i = 0
  while (i < tokens.length) {
    const cmd = tokens[i]
    if (!/[MLQCTSZ]/.test(cmd)) return null // numbers must follow a command
    i += 1
    if (cmd === 'Z') {
      out.push('Z')
      continue
    }
    const nums: number[] = []
    while (i < tokens.length && !/[MLQCTSZ]/.test(tokens[i])) {
      nums.push(parseFloat(tokens[i]))
      i += 1
    }
    // Reject zero-coordinate or odd-count commands (e.g. a lone "M" or a path ending in "L")
    // rather than emitting a malformed path — the contract is "return null when not exact".
    if (!PAIR_COMMANDS.has(cmd) || nums.length === 0 || nums.length % 2 !== 0) return null
    const parts: string[] = []
    for (let k = 0; k < nums.length; k += 2) {
      const p = fn({ x: nums[k], y: nums[k + 1] })
      parts.push(`${round(p.x)},${round(p.y)}`)
    }
    out.push(cmd + parts.join(' '))
  }
  return out.join(' ')
}

/** Scale a path about a pivot by (sx, sy). Returns null if the path can't be transformed exactly. */
export function scalePath(d: string, sx: number, sy: number, pivot: Point): string | null {
  return transformPath(d, (p) => ({ x: pivot.x + (p.x - pivot.x) * sx, y: pivot.y + (p.y - pivot.y) * sy }))
}

/** Translate a path by (dx, dy). */
export function translatePath(d: string, dx: number, dy: number): string | null {
  return transformPath(d, (p) => ({ x: p.x + dx, y: p.y + dy }))
}

const roundN = (n: number) => Math.round(n * 100) / 100

/**
 * Translate ANY SVG path by (dx, dy) for moving a region. Shifts only ABSOLUTE coordinates
 * (uppercase commands); relative segments (lowercase, e.g. button arcs) ride along because their
 * absolute anchor moves. Used by drag-to-move, so it must never break a path.
 */
export function translateD(d: string, dx: number, dy: number): string {
  return d.replace(/([A-Za-z])([^A-Za-z]*)/g, (whole, cmd: string, args: string) => {
    if (cmd === cmd.toLowerCase()) return whole // relative — leave it (its absolute anchor moves)
    if (cmd === 'Z') return cmd
    const nums = (args.match(/-?\d*\.?\d+(?:[eE][-+]?\d+)?/g) || []).map(Number)
    let out: number[]
    if (cmd === 'H') out = nums.map((x) => x + dx)
    else if (cmd === 'V') out = nums.map((y) => y + dy)
    else if (cmd === 'A') out = nums.map((n, i) => (i % 7 === 5 ? n + dx : i % 7 === 6 ? n + dy : n))
    else out = nums.map((n, i) => (i % 2 === 0 ? n + dx : n + dy)) // M L T Q C S — coordinate pairs
    return cmd + out.map(roundN).join(' ')
  })
}
