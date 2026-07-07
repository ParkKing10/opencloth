import { Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { Sidebar } from './components/Sidebar'
import { Topbar } from './components/Topbar'
import './suite.css'

export function SuiteApp() {
  const { pathname } = useLocation()

  // Reset scroll on route change
  useEffect(() => {
    const el = document.querySelector('.suite__content')
    el?.scrollTo({ top: 0 })
    window.scrollTo({ top: 0 })
  }, [pathname])

  return (
    <div className="suite">
      <div className="suite__body">
        <Sidebar />
        <div className="suite__main">
          <Topbar />
          <div className="suite__content">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  )
}
