import { QueryClient } from '@tanstack/react-query'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, gcTime: 7 * 86400_000, retry: 1, refetchOnWindowFocus: true },
  },
})
export const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'feetwork-query-v1',
  throttleTime: 0,
})
