import { Outlet, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { Topbar } from './components/Topbar'
import './suite.css'

export function SuiteApp() {
  const { pathname } = useLocation()
  // Off-canvas nav drawer state (only visible on compact/phone viewports).
  const [navOpen, setNavOpen] = useState(false)

  // Reset scroll + close the mobile nav on route change.
  useEffect(() => {
    const el = document.querySelector('.suite__content')
    el?.scrollTo({ top: 0 })
    window.scrollTo({ top: 0 })
    setNavOpen(false)
  }, [pathname])

  return (
    <div className="suite">
      <div className="suite__body">
        <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
        <div className="suite__main">
          <Topbar onMenu={() => setNavOpen(true)} />
          <div className="suite__content">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  )
}
