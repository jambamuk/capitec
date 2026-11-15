import { queryOptions } from '@tanstack/react-query'
import { api, params } from '@/lib/api'
import type { Page, Summary, Transaction } from '@/lib/types'
import type { AppSearch } from '@/lib/search'

export const categoryOptions = queryOptions({
  queryKey: ['categories'],
  queryFn: ({ signal }) =>
    api<{ items: { code: string; display_name: string }[] }>(
      '/api/v1/categories',
      { signal },
    ),
  staleTime: 5 * 60_000,
})

export function transactionFilters(search: AppSearch) {
  return {
    accountId: search.accountId || undefined,
    from: search.from,
    toExclusive: search.toExclusive,
    category: search.category,
    source: search.source,
    direction: search.direction,
    q: search.q,
    minAmount: search.minAmount,
    maxAmount: search.maxAmount,
  }
}

export const transactionOptions = (search: AppSearch) =>
  queryOptions({
    queryKey: ['transactions', transactionFilters(search), search.cursor],
    queryFn: ({ signal }) =>
      api<Page<Transaction>>(
        '/api/v1/transactions?' +
          params({ ...transactionFilters(search), cursor: search.cursor }),
        { signal },
      ),
    refetchInterval: search.cursor ? false : 3000,
  })

export const summaryOptions = (search: AppSearch) =>
  queryOptions({
    queryKey: ['summary', transactionFilters(search)],
    queryFn: ({ signal }) =>
      api<Summary>(
        '/api/v1/transaction-summary?' + params(transactionFilters(search)),
        {
          signal,
        },
      ),
    refetchInterval: search.cursor ? false : 3000,
  })
