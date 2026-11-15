import { queryOptions } from '@tanstack/react-query'
import { api, params } from '@/lib/api'
import type { AppSearch } from '@/lib/search'

export type OverviewReport = {
  asOf: string
  from: string
  toExclusive: string
  bucket: 'hour' | 'day'
  receivedFrom: string
  transactions: {
    totals: { transactionCount: number; moneyIn: string; moneyOut: string }
    activity: {
      at: string
      credits: number
      debits: number
      moneyIn: string
      moneyOut: string
    }[]
    spending: { category: string; amount: string }[]
    arrivals: { at: string; source: string; count: number }[]
    lastReceivedAt: string | null
  }
  fraud: {
    notFlagged: number
    needsReview: number
    reviewed: number
    pending: number
    highPriority: number
  } | null
}

export const overviewOptions = (search: AppSearch) => {
  const filters = {
    accountId: search.accountId,
    days: String(search.days ?? 7),
  }
  return queryOptions({
    queryKey: ['overview', filters],
    queryFn: ({ signal }) =>
      api<OverviewReport>('/api/v1/overview?' + params(filters), { signal }),
    staleTime: 3000,
    refetchInterval: 3000,
  })
}
