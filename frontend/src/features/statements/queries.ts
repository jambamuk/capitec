import { queryOptions } from '@tanstack/react-query'
import { api, params } from '@/lib/api'
import type { Page, Statement } from '@/lib/types'
import type { AppSearch } from '@/lib/search'

export const statementOptions = (search: AppSearch) =>
  queryOptions({
    queryKey: ['statements', search.accountId || '', search.cursor],
    queryFn: ({ signal }) =>
      api<Page<Statement>>(
        '/api/v1/statements?' +
          params({ accountId: search.accountId, cursor: search.cursor }),
        { signal },
      ),
  })
