import { createContext, useContext, type ReactNode, createElement } from 'react'
import type { ApiClient } from '../api-client'

const ApiClientContext = createContext<ApiClient | null>(null)

export function FinovaiCoreProvider({ client, children }: { client: ApiClient; children: ReactNode }) {
  return createElement(ApiClientContext.Provider, { value: client }, children)
}

export function useApiClient(): ApiClient {
  const client = useContext(ApiClientContext)
  if (!client) throw new Error('FinovaiCoreProvider missing above this component')
  return client
}
