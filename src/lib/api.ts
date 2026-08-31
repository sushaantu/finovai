import { createApiClient, buildAuthHeaders } from '@finovai/core'
import { webSessionStore, clearDashboardSession } from './dashboard-session'

export const apiClient = createApiClient({
  baseUrl: '',
  getAuthHeaders: () => buildAuthHeaders(webSessionStore),
  onUnauthorized: () => {
    clearDashboardSession()
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('finovai:session-expired'))
    }
  },
})
