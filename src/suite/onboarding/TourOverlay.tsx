/* ============================================================
   App tour — the guided walkthrough overlay.
   Spotlights the most important areas of the suite with a moving
   cut-out and a step card. Auto-starts ONCE per user on their first
   dashboard visit (i.e. right after registration); restartable any
   time from Settings → App tour or the topbar "?" button.
   Mounted once in SuiteApp so it survives route changes; on compact
   viewports it opens the nav drawer itself for sidebar steps.
   ============================================================ */

import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/auth'
import { useT } from '@/i18n'
import { TOURS, tourForPath, type TourId } from './steps'
import { TOUR_START_EVENT } from './tourBus'
import { AiDemo } from './AiDemo'
import { isUsableRect, placeCard, type Box } from './geometry'
import './tour.css'

/* The app tour keeps its historic key so nobody sees it twice after this update. */
const seenKeyFor = (tourId: TourId, userId: string) =>
  tourId === 'app' ? `threados-tour-v1-${userId}` : `threados-tour-v1-${tourId}-${userId}`
const POST_SIGNUP_KEY = 'threados-post-signup' // trial modal runs first right after signup
const HOLE_PAD = 6
const COMPACT = 1024 // sidebar becomes an off-canvas drawer at/below this width
const SHEET = 640 // card becomes a bottom sheet at/below this width

export function TourOverlay({ onNavDrawer }: { onNavDrawer?: (open: boolean) => void }) {
  const t = useT()
  const { user, initializing } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const [tourId, setTourId] = useState<TourId>('app')
  const [step, setStep] = useState(-1) // -1 = inactive
  const [rect, setRect] = useState<Box | null>(null)
  const [cardSize, setCardSize] = useState({ w: 340, h: 230 })
  const [, bump] = useReducer((x: number) => x + 1, 0) // re-render on resize
  const cardRef = useRef<HTMLDivElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)

  const steps = TOURS[tourId].steps
  const active = step >= 0
  const cur = active ? steps[step] : null
  const last = step === steps.length - 1

  const start = useCallback(
    (id: TourId) => {
      if (document.documentElement.hasAttribute('data-presentation')) return
      if (user) localStorage.setItem(seenKeyFor(id, user.id), '1')
      const route = TOURS[id].route
      if (pathname !== route) navigate(route)
      setTourId(id)
      setRect(null)
      setStep(0)
    },
    [user, pathname, navigate],
  )

  /* Auto-start: first visit of a page whose tour this user has never seen.
     Suppressed right after signup — the trial modal runs first and then
     requests the app tour itself. Guests never auto-start a tour. */
  useEffect(() => {
    if (initializing || !user || active) return
    if (localStorage.getItem(POST_SIGNUP_KEY)) return
    const id = tourForPath(pathname)
    if (!id || localStorage.getItem(seenKeyFor(id, user.id))) return
    const timer = window.setTimeout(() => start(id), 900) // let the page settle first
    return () => clearTimeout(timer)
  }, [initializing, user, active, pathname, start])

  /* Manual start (Settings card / topbar "?" / post-signup chain). */
  useEffect(() => {
    const h = (e: Event) => {
      const detail = (e as CustomEvent).detail as TourId | undefined
      start(detail && detail in TOURS ? detail : (tourForPath(pathname) ?? 'app'))
    }
    window.addEventListener(TOUR_START_EVENT, h)
    return () => window.removeEventListener(TOUR_START_EVENT, h)
  }, [start, pathname])

  const close = useCallback(() => {
    setStep(-1)
    setRect(null)
  }, [])

  /* Drawer follows the step: sidebar steps open it on compact viewports. */
  useEffect(() => {
    if (!cur) {
      onNavDrawer?.(false)
      return
    }
    onNavDrawer?.(window.innerWidth <= COMPACT && !!cur.sidebar)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  /* Find + measure the step's target (retry — the route or drawer may still be settling). */
  useEffect(() => {
    if (!cur?.target) {
      setRect(null)
      return
    }
    let cancelled = false
    let tries = 0
    const find = () => {
      if (cancelled) return
      const el = document.querySelector(`[data-tour="${cur.target}"]`) as HTMLElement | null
      const r = el?.getBoundingClientRect()
      if (el && r && isUsableRect(r, window.innerWidth, window.innerHeight)) {
        // Only page content may scroll — never the window (the suite shell
        // scrolls inside .suite__content; window scroll shifts the whole app).
        if (el.closest('.suite__content')) el.scrollIntoView({ block: 'nearest' })
        if (window.scrollY !== 0) window.scrollTo({ top: 0 })
        window.setTimeout(() => {
          if (!cancelled) setRect(el.getBoundingClientRect())
        }, 30)
      } else if (tries++ < 30) {
        window.setTimeout(find, 70)
      } else {
        setRect(null) // target missing (e.g. role-gated) — show a centred card instead
      }
    }
    find()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  /* Keep the spotlight glued to the target on resize/scroll. */
  useEffect(() => {
    if (!active) return
    const measure = () => {
      bump()
      if (!cur?.target) return
      const el = document.querySelector(`[data-tour="${cur.target}"]`) as HTMLElement | null
      const r = el?.getBoundingClientRect()
      if (el && r && isUsableRect(r, window.innerWidth, window.innerHeight)) setRect(r)
    }
    window.addEventListener('resize', measure)
    document.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      document.removeEventListener('scroll', measure, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, active])

  /* Keyboard: Esc ends, arrows navigate. */
  useEffect(() => {
    if (!active) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight') setStep((s) => (s >= steps.length - 1 ? -1 : s + 1))
      else if (e.key === 'ArrowLeft') setStep((s) => Math.max(0, s - 1))
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [active, close])

  /* Measure the card so placement can use its real size; focus the primary button. */
  useLayoutEffect(() => {
    const el = cardRef.current
    if (!el) return
    setCardSize((s) => {
      const w = el.offsetWidth
      const h = el.offsetHeight
      return Math.abs(s.w - w) > 1 || Math.abs(s.h - h) > 1 ? { w, h } : s
    })
    nextRef.current?.focus({ preventScroll: true })
  }, [step, rect])

  if (!cur) return null

  const vw = window.innerWidth
  const vh = window.innerHeight
  const sheet = vw <= SHEET
  const pos = placeCard(rect, cardSize.w, cardSize.h, vw, vh)

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {rect ? (
        <div
          className="tour__hole"
          style={{
            left: rect.left - HOLE_PAD,
            top: rect.top - HOLE_PAD,
            width: rect.width + HOLE_PAD * 2,
            height: rect.height + HOLE_PAD * 2,
          }}
        />
      ) : (
        <div className="tour__veil" />
      )}

      <div
        ref={cardRef}
        className={`tour__card${sheet ? ' tour__card--sheet' : ''}`}
        style={sheet ? undefined : { left: pos.left, top: pos.top }}
      >
        <div className="tour__meta">
          <span className="tour__kicker">loom studios</span>
          <span className="tour__count">
            {step + 1}/{steps.length}
          </span>
        </div>
        <h3 className="tour__title" id="tour-title">
          {t(cur.title)}
        </h3>
        <p className="tour__body">{t(cur.body)}</p>
        {tourId === 'app' && cur.id === 'ai' && <AiDemo key={step} />}
        <div className="tour__dots" aria-hidden="true">
          {steps.map((s, i) => (
            <span key={s.id} className={`tour__dot${i === step ? ' is-on' : ''}${i < step ? ' is-done' : ''}`} />
          ))}
        </div>
        <div className="tour__row">
          <button className="tour__skip" type="button" onClick={close}>
            {t('tour.skip')}
          </button>
          <div className="tour__nav">
            {step > 0 && (
              <button className="tour__btn" type="button" onClick={() => setStep((s) => Math.max(0, s - 1))}>
                {t('tour.back')}
              </button>
            )}
            {last ? (
              <>
                {tourId === 'app' ? (
                  <>
                    <button className="tour__btn" type="button" onClick={close}>
                      {t('tour.finish')}
                    </button>
                    <button
                      ref={nextRef}
                      className="tour__btn tour__btn--accent"
                      type="button"
                      onClick={() => {
                        close()
                        navigate('/design')
                      }}
                    >
                      {t('tour.cta')}
                    </button>
                  </>
                ) : (
                  <button ref={nextRef} className="tour__btn tour__btn--accent" type="button" onClick={close}>
                    {t('tour.finish')}
                  </button>
                )}
              </>
            ) : (
              <button ref={nextRef} className="tour__btn tour__btn--accent" type="button" onClick={() => setStep((s) => s + 1)}>
                {t('tour.next')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
