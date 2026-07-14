import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../auth/auth'
import { useStore } from '../data/store'
import {
  loadRewards,
  referralCodeFor,
  referralLink,
  rid,
  saveRewards,
  taskAvailable,
  type RewardsState,
  type ViralTask,
} from './economy'

/**
 * The current user's coin economy: balance (from the user record), plus earn/spend actions that
 * bump the balance (via the store) AND record history in the localStorage ledger.
 */
export function useRewards() {
  const { user } = useAuth()
  const { mutate } = useStore()
  const uid = user?.id ?? 'anon'
  const [state, setState] = useState<RewardsState>(() => loadRewards(uid))
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    setState(loadRewards(uid))
  }, [uid])

  const persist = useCallback(
    (fn: (s: RewardsState) => RewardsState) => {
      setState((prev) => {
        const next = fn(prev)
        saveRewards(uid, next)
        return next
      })
    },
    [uid],
  )

  const addCoins = useCallback(
    (amount: number) => {
      if (!user) return
      mutate((d) => ({ ...d, users: d.users.map((u) => (u.id === user.id ? { ...u, coins: Math.max(0, u.coins + amount) } : u)) }))
    },
    [user, mutate],
  )

  const grant = useCallback(
    (amount: number, reason: string) => {
      addCoins(amount)
      persist((s) => ({ ...s, ledger: [{ ts: Date.now(), delta: amount, reason }, ...s.ledger].slice(0, 100) }))
    },
    [addCoins, persist],
  )

  /** Buy a coin pack (mock checkout — grants coins immediately). */
  const buyPack = useCallback(
    (pack: { coins: number; bonus: number; price: string }) => {
      const total = pack.coins + pack.bonus
      grant(total, `Bought ${total.toLocaleString()} coins (${pack.price})`)
    },
    [grant],
  )

  /** Claim a viral task — grants coins, records the submission link, starts the cooldown. */
  const claimTask = useCallback(
    (task: ViralTask, url?: string): boolean => {
      const now = Date.now()
      // Availability is checked synchronously against the latest state — never a batched updater flag.
      if (!taskAvailable(task, stateRef.current, now)) return false
      addCoins(task.reward)
      persist((s) => ({
        ...s,
        lastClaim: { ...s.lastClaim, [task.id]: now },
        submissions: url ? [{ id: rid(), taskId: task.id, url, ts: now, status: 'approved' as const }, ...s.submissions].slice(0, 50) : s.submissions,
        ledger: [{ ts: now, delta: task.reward, reason: `Task: ${task.id}` }, ...s.ledger].slice(0, 100),
      }))
      return true
    },
    [persist, addCoins],
  )

  const code = useMemo(() => (user ? referralCodeFor(user) : 'LOOM'), [user])
  const link = useMemo(() => referralLink(code), [code])

  return {
    balance: user?.coins ?? 0,
    plan: user?.plan ?? 'Free',
    state,
    referral: { code, link, invited: state.referrals.invited, subscribed: state.referrals.subscribed, freeMonths: state.freeMonths },
    buyPack,
    claimTask,
    grant,
    taskReady: (task: ViralTask) => taskAvailable(task, state, Date.now()),
  }
}
