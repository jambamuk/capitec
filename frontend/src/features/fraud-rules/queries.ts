import { queryOptions } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Configuration } from './types'

export const ruleOptions = queryOptions({
  queryKey: ['fraud-rules'],
  queryFn: ({ signal }) =>
    api<Configuration>('/api/v1/fraud-rules', { signal }),
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  staleTime: Infinity,
})
