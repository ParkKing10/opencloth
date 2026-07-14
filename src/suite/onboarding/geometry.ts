/* ============================================================
   App tour — pure spotlight geometry.
   Deciding whether a target rect is usable and where the step card
   goes (right → left → below → above → centred) is plain math, so
   it lives here and is unit-tested.
   ============================================================ */

export type Box = { left: number; top: number; width: number; height: number; right: number; bottom: number }
export type Pt = { left: number; top: number }

/** A target rect we can spotlight: has real size and is at least partly on screen. */
export function isUsableRect(r: Box, vw: number, vh: number): boolean {
  return r.width > 2 && r.height > 2 && r.right > 4 && r.bottom > 4 && r.left < vw - 4 && r.top < vh - 4
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi))

/**
 * Place the step card next to the target: prefer beside it (right, then
 * left — sidebar items read best that way), then below, then above,
 * else centred. Always clamped fully inside the viewport.
 */
export function placeCard(target: Box | null, cw: number, ch: number, vw: number, vh: number, gap = 16): Pt {
  const pad = 10
  const centred: Pt = { left: Math.max(pad, (vw - cw) / 2), top: Math.max(pad, (vh - ch) / 2) }
  if (!target) return centred
  const midY = clamp(target.top + target.height / 2 - ch / 2, pad, vh - ch - pad)
  const midX = clamp(target.left + target.width / 2 - cw / 2, pad, vw - cw - pad)
  if (target.right + gap + cw <= vw - pad) return { left: target.right + gap, top: midY }
  if (target.left - gap - cw >= pad) return { left: target.left - gap - cw, top: midY }
  if (target.bottom + gap + ch <= vh - pad) return { left: midX, top: target.bottom + gap }
  if (target.top - gap - ch >= pad) return { left: midX, top: target.top - gap - ch }
  return centred
}
