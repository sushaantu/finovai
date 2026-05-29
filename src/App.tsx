import { useEffect, useState } from 'react'
import Navbar from './components/Navbar'
import Dashboard from './components/Dashboard'
import LandingPage from './components/LandingPage'
import ToolPage, { type ToolSlug } from './components/ToolPage'
import StaticPage, { getStaticPage } from './components/StaticPage'
import Footer from './components/Footer'
import {
  clearDashboardSession,
  getStoredDashboardEmail,
  setDashboardSession,
} from './lib/dashboard-session'

function App() {
  const [pathname, setPathname] = useState(() => getPathname())
  const [signupEmail, setSignupEmail] = useState<string | null>(() => getStoredDashboardEmail())

  useEffect(() => {
    const handlePopState = () => setPathname(getPathname())
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = (path: string) => {
    window.history.pushState({}, '', path)
    setPathname(getPathname())
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const handleSignupSuccess = (email: string) => {
    setDashboardSession(email)
    setSignupEmail(email)
    navigate('/dashboard')
  }
  const handleLogout = () => {
    clearDashboardSession()
    setSignupEmail(null)
    navigate('/')
  }

  let page: 'home' | ToolSlug = 'home'

  if (pathname === '/tools/interes-compuesto') {
    page = 'compound'
  } else if (pathname === '/tools/regla-72') {
    page = 'rule72'
  } else if (pathname === '/tools/costo-oportunidad') {
    page = 'opportunity'
  }

  const isDashboard = pathname === '/dashboard'
  const staticPage = getStaticPage(pathname)
  const isHome = !isDashboard && page === 'home'
  const isStaticPage = Boolean(staticPage)

  return (
    <div className={isDashboard || isStaticPage || isHome ? 'min-h-screen' : 'min-h-screen bg-[--color-bg]'}>
      {!isDashboard && !isHome && !isStaticPage ? (
        <Navbar
          email={signupEmail}
          onDashboard={() => navigate('/dashboard')}
          onLoginSuccess={handleSignupSuccess}
          onLogout={handleLogout}
        />
      ) : null}

      {isDashboard ? (
        <Dashboard email={signupEmail} onBackHome={() => navigate('/')} onLogout={handleLogout} />
      ) : staticPage ? (
        <StaticPage slug={staticPage} />
      ) : page === 'home' ? (
        <LandingPage
          email={signupEmail}
          onConnect={() => navigate('/dashboard')}
          onLogout={handleLogout}
          onSignupSuccess={handleSignupSuccess}
        />
      ) : (
        <ToolPage tool={page} />
      )}

      {!isDashboard && !isHome && !isStaticPage ? <Footer /> : null}
    </div>
  )
}

function getPathname() {
  if (typeof window === 'undefined') return '/'
  return window.location.pathname.replace(/\/+$/, '') || '/'
}

export default App
