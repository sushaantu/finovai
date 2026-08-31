import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApiClient } from './context'
import { queryKeys } from './keys'
import type { ManualTransactionInput, ProfilePatch } from '../api-types'

// The worker's finance mutations return the full fresh DashboardResponse,
// so we write it into the cache instead of refetching.
export function useSaveManualTransaction(email: string) {
  const client = useApiClient()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ManualTransactionInput) => client.saveManualTransaction(email, input),
    onSuccess: (response) => queryClient.setQueryData(queryKeys.transactions(email), response),
    retry: 0,
  })
}

export function useUpdateTransactionCategory(email: string) {
  const client = useApiClient()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: { transactionId: string; category: string }) =>
      client.updateTransactionCategory(email, vars.transactionId, vars.category),
    onSuccess: (response) => queryClient.setQueryData(queryKeys.transactions(email), response),
    retry: 0,
  })
}

export function useSaveProfile(email: string) {
  const client = useApiClient()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (profile: ProfilePatch) => client.saveProfile(email, profile),
    onSuccess: (response) => queryClient.setQueryData(queryKeys.transactions(email), response),
    retry: 0,
  })
}

export function useInviteSpouse(email: string) {
  const client = useApiClient()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (spouseEmail: string) => client.inviteSpouse(email, spouseEmail),
    onSuccess: (response) => queryClient.setQueryData(queryKeys.household(email), response),
    retry: 0,
  })
}

export function useSendChatMessage(email: string) {
  const client = useApiClient()
  return useMutation({
    mutationFn: (question: string) => client.sendDashboardChat(email, question),
    retry: 0,
  })
}
