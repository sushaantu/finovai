import { useQueryClient } from '@tanstack/react-query'
import type { DashboardResponse, SyncfyCredential } from '@finovai/core'
import { queryKeys } from '@finovai/core/react'

import { SyncfyConnect } from '@/components/SyncfyConnect'
import { useDashboardModel, type DashboardModelOptions } from '../lib/use-dashboard-model'

interface ConnectPageProps {
  email: string
  modelOptions: DashboardModelOptions
  onStatus: (message: string) => void
}

export function ConnectPage({ email, modelOptions, onStatus }: ConnectPageProps) {
  const queryClient = useQueryClient()
  const { syncfyCredentials, isLoadingCredentials } = useDashboardModel(email, modelOptions)

  const setSyncfyCredentialsCache = (credentials: SyncfyCredential[]) => {
    queryClient.setQueryData(queryKeys.syncfyCredentials(email), { credentials })
  }

  return (
    <SyncfyConnect
      email={email}
      initialCredentials={syncfyCredentials}
      isLoadingCredentials={isLoadingCredentials}
      onStatus={onStatus}
      onCredentialsChange={setSyncfyCredentialsCache}
      onSynced={(response) => {
        const nextData = response as DashboardResponse & { credentials?: SyncfyCredential[] }
        if (Array.isArray(nextData.credentials)) {
          setSyncfyCredentialsCache(nextData.credentials)
        }
        if (Array.isArray(nextData.transactions)) {
          queryClient.setQueryData(queryKeys.transactions(email), nextData)
        }
      }}
    />
  )
}
