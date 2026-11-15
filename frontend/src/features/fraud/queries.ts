import { queryOptions } from '@tanstack/react-query'
import { api, params } from '@/lib/api'
import type { Page, Transaction } from '@/lib/types'
import type { AppSearch } from '@/lib/search'

export type CheckedPayment = {
  transaction: Transaction
  status: string
  severity: string
  reviewStatus: string
}

export const fraudOptions = (search: AppSearch) =>
  queryOptions({
    queryKey: [
      'fraud',
      search.accountId || '',
      search.reviewStatus || 'ALL',
      search.cursor || null,
      search.from,
      search.toExclusive,
      search.severity,
    ],
    queryFn: ({ signal }) =>
      api<Page<CheckedPayment>>(
        '/api/v1/fraud-evaluations?' +
          params({
            accountId: search.accountId,
            reviewStatus: search.reviewStatus || 'ALL',
            cursor: search.cursor,
            from: search.from,
            toExclusive: search.toExclusive,
            severity: search.severity,
          }),
        { signal },
      ),
    refetchInterval: search.cursor ? false : 3000,
  })
