/** Small, dependency-free helpers for the client data layer. */

let counter = 0

/**
 * A UUID for new records. Owner-scoped tables use a `uuid` primary key, so client
 * ids must be valid UUIDs to insert with their own id (no server round-trip).
 * `prefix` is accepted for call-site readability but no longer changes the format.
 */
export function uid(prefix = 'id'): string {
  void prefix
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  // Fallback (older/non-secure contexts): RFC-4122-shaped v4 from getRandomValues/Math.random
  counter += 1
  const rnd = () =>
    c && typeof c.getRandomValues === 'function'
      ? c.getRandomValues(new Uint8Array(1))[0] / 255
      : Math.random()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (rnd() * 16) | 0
    const v = ch === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/** SHA-256 hex — used so we never persist plaintext passwords in localStorage. */
export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Timing-safe-ish string compare (client side; real safety belongs on a server). */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}
