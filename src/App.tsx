import { useEffect, useState } from 'react'
import Navbar from './components/Navbar'
import DashboardApp from './dashboard/DashboardApp'
import LandingPage from './components/LandingPage'
import AuthPage, { type AuthMode } from './components/AuthPage'
import ToolPage, { type ToolSlug } from './components/ToolPage'
import StaticPage, { getStaticPage } from './components/StaticPage'
import Footer from './components/Footer'
import SyncfyAdminPage from './components/SyncfyAdminPage'
import {
  clearDashboardSession,
  getStoredDashboardEmail,
  setDashboardSession,
} from './lib/dashboard-session'
import { apiClient } from './lib/api'

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
    apiClient.verifyLoginToken(email, token)
      .then((data) => {
        if (cancelled) return
        if (!data.clientSecret) {
          setAuthNotice('No pudimos validar el enlace. Pide un nuevo código.')
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
      .catch((error) => {
        if (cancelled) return
        setAuthNotice(error instanceof Error && error.message
          ? error.message
          : 'No pudimos validar el enlace. Pide un nuevo código.')
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
  // AuthPage has already persisted the session with the real client secret, so
  // this only syncs React state. Reusing handleSignupSuccess here would call
  // setDashboardSession without a secret, which in dev builds replaces that
  // real secret with the local placeholder.
  const handleAuthenticated = (email: string) => {
    setAuthNotice(null)
    setSignupEmail(email)
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
  const authMode: AuthMode | null =
    pathname === '/login' ? 'login' : pathname === '/signup' ? 'signup' : null
  const isAuthPage = authMode !== null
  const isHome = !isDashboard && !isSyncfyAdmin && !isAuthPage && page === 'home'
  const isStaticPage = Boolean(staticPage)

  return (
    <div className={isDashboard || isSyncfyAdmin || isStaticPage || isHome || isAuthPage ? 'min-h-screen' : 'min-h-screen bg-[--color-bg]'}>
      {!isDashboard && !isSyncfyAdmin && !isHome && !isStaticPage && !isAuthPage ? (
        <Navbar
          email={signupEmail}
          onDashboard={() => navigate('/dashboard')}
          onLoginSuccess={handleSignupSuccess}
          onLogout={handleLogout}
        />
      ) : null}

      {authMode ? (
        <AuthPage
          mode={authMode}
          initialEmail={signupEmail ?? ''}
          onAuthenticated={handleAuthenticated}
          onNavigate={navigate}
        />
      ) : isDashboard ? (
        <DashboardApp
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
          onLogin={() => navigate('/login')}
          onSignup={() => navigate('/signup')}
          onLogout={handleLogout}
        />
      ) : (
        <ToolPage tool={page} />
      )}

      {!isDashboard && !isSyncfyAdmin && !isHome && !isStaticPage && !isAuthPage ? <Footer /> : null}
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
