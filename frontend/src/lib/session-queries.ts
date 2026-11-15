import { queryOptions } from '@tanstack/react-query'
import { api, ApiError } from './api'
import type { Account, Session } from './types'

export const sessionOptions = queryOptions({
  queryKey: ['session'],
  queryFn: ({ signal }): Promise<Session | null> =>
    api<Session>('/api/me', { signal }).catch((error) => {
      if (error instanceof ApiError && error.status === 401) return null
      throw error
    }),
  retry: false,
})

export const accountOptions = (username: string) =>
  queryOptions({
    queryKey: ['accounts', username],
    queryFn: ({ signal }) =>
      api<{ items: Account[] }>('/api/v1/accounts', { signal }),
  })
