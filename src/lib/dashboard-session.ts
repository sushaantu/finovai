import { DASHBOARD_SECRET_HEADER, type SessionStore } from '@finovai/core'

export { DASHBOARD_SECRET_HEADER }

export const DASHBOARD_EMAIL_STORAGE_KEY = 'finovai_signup_email'
export const DASHBOARD_SECRET_STORAGE_KEY = 'finovai_dashboard_secret'
const LOCAL_DASHBOARD_SECRET = 'local-dev-session'

export function getStoredDashboardEmail() {
  if (typeof window === 'undefined') return null
  const email = window.localStorage.getItem(DASHBOARD_EMAIL_STORAGE_KEY)
  const secret = window.localStorage.getItem(DASHBOARD_SECRET_STORAGE_KEY)
  return email && secret ? email : null
}

export function getStoredDashboardSecret() {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(DASHBOARD_SECRET_STORAGE_KEY)
}

export function getDashboardAuthHeaders(): Record<string, string> {
  const secret = getStoredDashboardSecret()
  return secret ? { [DASHBOARD_SECRET_HEADER]: secret } : {}
}

export function setDashboardSession(email: string, clientSecret?: string | null) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(DASHBOARD_EMAIL_STORAGE_KEY, email)
  if (clientSecret) {
    window.localStorage.setItem(DASHBOARD_SECRET_STORAGE_KEY, clientSecret)
  } else if (import.meta.env.DEV) {
    window.localStorage.setItem(DASHBOARD_SECRET_STORAGE_KEY, LOCAL_DASHBOARD_SECRET)
  }
}

export function clearDashboardSession() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(DASHBOARD_EMAIL_STORAGE_KEY)
  window.localStorage.removeItem(DASHBOARD_SECRET_STORAGE_KEY)
}

export const webSessionStore: SessionStore = {
  getEmail: getStoredDashboardEmail,
  getSecret: getStoredDashboardSecret,
  set: setDashboardSession,
  clear: clearDashboardSession,
}
