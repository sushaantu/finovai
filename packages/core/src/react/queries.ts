import { useQuery } from '@tanstack/react-query'
import { useApiClient } from './context'
import { queryKeys } from './keys'

interface QueryOpts { enabled?: boolean }

export function useTransactions(email: string | null, opts: QueryOpts = {}) {
  const client = useApiClient()
  return useQuery({
    queryKey: queryKeys.transactions(email ?? ''),
    queryFn: () => client.getTransactions(email!),
    enabled: Boolean(email) && (opts.enabled ?? true),
    staleTime: 30_000,
    retry: 1,
  })
}

export function useSyncfyCredentials(email: string | null, opts: QueryOpts = {}) {
  const client = useApiClient()
  return useQuery({
    queryKey: queryKeys.syncfyCredentials(email ?? ''),
    queryFn: () => client.getSyncfyCredentials(email!),
    enabled: Boolean(email) && (opts.enabled ?? true),
    staleTime: 30_000,
    retry: 1,
  })
}

export function useHousehold(email: string | null, opts: QueryOpts = {}) {
  const client = useApiClient()
  return useQuery({
    queryKey: queryKeys.household(email ?? ''),
    queryFn: () => client.getHousehold(email!),
    enabled: Boolean(email) && (opts.enabled ?? true),
    staleTime: 30_000,
    retry: 1,
  })
}
