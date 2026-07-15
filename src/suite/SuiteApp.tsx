import { Outlet, useLocation } from 'react-router-dom'
import { useEffect, useState, type MouseEvent } from 'react'
import { Sidebar } from './components/Sidebar'
import { Topbar } from './components/Topbar'
import { PaywallProvider } from './economy/PaywallProvider'
import { TourOverlay } from './onboarding/TourOverlay'
import { TrialModal } from './components/TrialModal'
import { AuthGate } from './components/AuthGate'
import { GuestWall } from './components/GuestWall'
import { requestTour } from './onboarding/tourBus'
import { useAuth } from './auth/auth'
import { useToast } from './components/ui/Toast'
import { useT } from '@/i18n'
import './suite.css'

const POST_SIGNUP_KEY = 'threados-post-signup'

export function SuiteApp() {
  const { pathname } = useLocation()
  const { user, initializing } = useAuth()
  const toast = useToast()
  const t = useT()
  // Off-canvas nav drawer state (only visible on compact/phone viewports).
  const [navOpen, setNavOpen] = useState(false)
  // Guest auth gate — opened when a visitor without an account clicks anything real.
  const [gateOpen, setGateOpen] = useState(false)
  // Right after signup: pitch the plans first, then run the app tour.
  const [postSignup, setPostSignup] = useState(false)

  // Reset scroll + close the mobile nav on route change.
  useEffect(() => {
    const el = document.querySelector('.suite__content')
    el?.scrollTo({ top: 0 })
    window.scrollTo({ top: 0 })
    setNavOpen(false)
  }, [pathname])

  // The post-signup chain starts once the fresh account is resolved.
  useEffect(() => {
    if (user && localStorage.getItem(POST_SIGNUP_KEY)) setPostSignup(true)
  }, [user])

  // Persistence failures (cloud reconcile / local quota) surface as a toast — they used to be
  // console-only while the UI kept claiming success. Throttled so bursts don't spam.
  useEffect(() => {
    let last = 0
    const h = (e: Event) => {
      const now = Date.now()
      if (now - last < 30_000) return
      last = now
      const kind = (e as CustomEvent).detail
      toast(t(kind === 'local' ? 'sync.localFull' : 'sync.cloudFail'), 'info')
    }
    window.addEventListener('loom:sync-error', h)
    return () => window.removeEventListener('loom:sync-error', h)
  }, [toast, t])
  const finishPostSignup = () => {
    localStorage.removeItem(POST_SIGNUP_KEY)
    setPostSignup(false)
    requestTour('app') // "alles erklären" — the walkthrough follows the plans
  }

  /* Guests may browse everything, but any real interaction opens the auth gate.
     Allowed without an account: sidebar navigation, drawer/scrim, language,
     and the gate itself (its buttons must work). Capture-phase so page
     handlers (cards, buys, generators) never fire for guests. */
  // Registration is MANDATORY beyond the dashboard: guests only ever see
  // the storefront (/) — every other page renders the wall instead.
  const walled = !initializing && !user && pathname !== '/'

  const guestGate = (e: MouseEvent) => {
    if (user || initializing) return
    const el = e.target as HTMLElement
    if (el.closest('.shm, .gwall, .sb__nav, .sb__scrim, .tb__menu, .lang-toggle, .lang-menu')) return
    if (el.closest('button, a, input, textarea, select, canvas, article, [role="button"]')) {
      e.preventDefault()
      e.stopPropagation()
      setGateOpen(true)
    }
  }

  return (
    <PaywallProvider>
      <div className="suite" onClickCapture={guestGate}>
        <div className="suite__body">
          <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
          <div className="suite__main">
            <Topbar onMenu={() => setNavOpen(true)} />
            <div className="suite__content">
              {walled ? <GuestWall /> : <Outlet />}
            </div>
          </div>
        </div>
        {/* Guided app tour — auto-starts once per user, restartable from Settings. */}
        <TourOverlay onNavDrawer={setNavOpen} />
        {/* Guest gate + the post-signup plans-then-tour chain. */}
        <AuthGate open={gateOpen} onClose={() => setGateOpen(false)} />
        <TrialModal open={postSignup} onClose={finishPostSignup} />
      </div>
    </PaywallProvider>
  )
}
