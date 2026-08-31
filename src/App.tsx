import { useEffect, useState } from 'react'
import Navbar from './components/Navbar'
import Dashboard from './components/Dashboard'
import LandingPage from './components/LandingPage'
import ToolPage, { type ToolSlug } from './components/ToolPage'
import StaticPage, { getStaticPage } from './components/StaticPage'
import Footer from './components/Footer'
import SyncfyAdminPage from './components/SyncfyAdminPage'
import {
  clearDashboardSession,
  getStoredDashboardEmail,
  setDashboardSession,
} from './lib/dashboard-session'

const DASHBOARD_APP_PATHS = new Set([
  '/dashboard',
  '/connect',
  '/movements',
  '/movement',
  '/categories',
  '/category',
  '/analysis',
  '/settings',
])

function App() {
  const [pathname, setPathname] = useState(() => getPathname())
  const [signupEmail, setSignupEmail] = useState<string | null>(() => getStoredDashboardEmail())
  const [authNotice, setAuthNotice] = useState<string | null>(null)

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

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const email = params.get('email')
    const token = params.get('login_token')
    if (!email || !token) return

    let cancelled = false
    fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, token, source: 'magic-link' }),
    })
      .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return
        if (!ok || !data.clientSecret) {
          setAuthNotice(typeof data.error === 'string'
            ? data.error
            : 'No pudimos validar el enlace. Pide un nuevo código.')
          window.history.replaceState({}, '', '/dashboard')
          setPathname('/dashboard')
          return
        }
        setAuthNotice(null)
        setDashboardSession(data.email || email, data.clientSecret)
        setSignupEmail(data.email || email)
        window.history.replaceState({}, '', '/dashboard')
        setPathname('/dashboard')
      })
      .catch(() => {
        if (cancelled) return
        setAuthNotice('No pudimos validar el enlace. Pide un nuevo código.')
        window.history.replaceState({}, '', '/dashboard')
        setPathname('/dashboard')
      })

    return () => {
      cancelled = true
    }
  }, [])

  const handleSignupSuccess = (email: string) => {
    setAuthNotice(null)
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

  const isDashboard = isDashboardPath(pathname)
  const isSyncfyAdmin = pathname === '/admin/syncfy'
  const staticPage = getStaticPage(pathname)
  const isHome = !isDashboard && !isSyncfyAdmin && page === 'home'
  const isStaticPage = Boolean(staticPage)

  return (
    <div className={isDashboard || isSyncfyAdmin || isStaticPage || isHome ? 'min-h-screen' : 'min-h-screen bg-[--color-bg]'}>
      {!isDashboard && !isSyncfyAdmin && !isHome && !isStaticPage ? (
        <Navbar
          email={signupEmail}
          onDashboard={() => navigate('/dashboard')}
          onLoginSuccess={handleSignupSuccess}
          onLogout={handleLogout}
        />
      ) : null}

      {isDashboard ? (
        <Dashboard
          email={signupEmail}
          initialNotice={authNotice}
          initialPath={pathname}
          onBackHome={() => navigate('/')}
          onLogout={handleLogout}
        />
      ) : isSyncfyAdmin ? (
        <SyncfyAdminPage />
      ) : staticPage ? (
        <StaticPage slug={staticPage} />
      ) : page === 'home' ? (
        <LandingPage
          email={signupEmail}
          onConnect={() => navigate('/dashboard')}
          onLogout={handleLogout}
        />
      ) : (
        <ToolPage tool={page} />
      )}

      {!isDashboard && !isSyncfyAdmin && !isHome && !isStaticPage ? <Footer /> : null}
    </div>
  )
}

function getPathname() {
  if (typeof window === 'undefined') return '/'
  return window.location.pathname.replace(/\/+$/, '') || '/'
}

function isDashboardPath(pathname: string) {
  return DASHBOARD_APP_PATHS.has(pathname) || pathname.startsWith('/dashboard/')
}

export default App
