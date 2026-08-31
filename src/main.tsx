import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FinovaiCoreProvider } from '@finovai/core/react'
import './polyfills'
import './index.css'
import 'streamdown/styles.css'
import App from './App'
import { apiClient } from './lib/api'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <FinovaiCoreProvider client={apiClient}>
        <App />
      </FinovaiCoreProvider>
    </QueryClientProvider>
  </StrictMode>,
)
