import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useAccount } from '@/components/app-shell'
import { params } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import { ErrorMessage } from '@/components/feedback'
import { sourceNames } from './types'
import { categoryOptions } from '@/features/transactions/queries'

export function ApiExplorer() {
  const { accounts } = useAccount()
  const [endpoint, setEndpoint] = useState('transaction-summary')
  const [filters, setFilters] = useState<Record<string, string>>({
    accountId: '',
    customerId: '',
    from: '',
    toExclusive: '',
    category: '',
    source: '',
    direction: '',
    q: '',
    minAmount: '',
    maxAmount: '',
    groupBy: 'CATEGORY',
    limit: '25',
    cursor: '',
  })
  const update = (key: string, value: string) =>
    setFilters((previous) => ({
      ...previous,
      [key]: value,
      ...(key !== 'cursor' ? { cursor: '' } : {}),
    }))
  const categories = useQuery(categoryOptions)
  const { groupBy, limit, cursor, ...common } = filters
  const path =
    '/api/v1/' +
    endpoint +
    '?' +
    params({
      ...common,
      ...(endpoint === 'breakdowns' ? { groupBy } : {}),
      ...(endpoint === 'transactions' ? { limit, cursor } : {}),
    })
  const query = useMutation({
    mutationFn: async (url: string) => {
      const started = performance.now()
      const response = await fetch(url, { credentials: 'same-origin' })
      const body = await response.json()
      if (response.status === 401)
        window.dispatchEvent(new Event('session-expired'))
      return {
        path: url,
        status: response.status,
        durationMs: Math.round(performance.now() - started),
        body,
      }
    },
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle>Aggregation API explorer</CardTitle>
        <CardDescription>
          Run requests against the same APIs used by the application.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <form
          id="explore-api"
          onSubmit={(event) => {
            event.preventDefault()
            query.mutate(path)
          }}
        >
          <FieldGroup className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="api-search">
                Description or reference
              </FieldLabel>
              <Input
                id="api-search"
                value={filters.q}
                maxLength={120}
                onChange={(event) => update('q', event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="api-minimum">Minimum amount (R)</FieldLabel>
              <Input
                id="api-minimum"
                type="number"
                min="0"
                step="0.01"
                value={filters.minAmount}
                onChange={(event) => update('minAmount', event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="api-maximum">Maximum amount (R)</FieldLabel>
              <Input
                id="api-maximum"
                type="number"
                min="0"
                step="0.01"
                value={filters.maxAmount}
                onChange={(event) => update('maxAmount', event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="api-endpoint">Endpoint</FieldLabel>
              <NativeSelect
                id="api-endpoint"
                value={endpoint}
                onChange={(event) => setEndpoint(event.target.value)}
              >
                <NativeSelectOption value="transaction-summary">
                  Transaction summary
                </NativeSelectOption>
                <NativeSelectOption value="breakdowns">
                  Grouped breakdown
                </NativeSelectOption>
                <NativeSelectOption value="transactions">
                  Transactions
                </NativeSelectOption>
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="api-account">Account</FieldLabel>
              <NativeSelect
                id="api-account"
                value={filters.accountId}
                onChange={(event) => update('accountId', event.target.value)}
              >
                <NativeSelectOption value="">All accounts</NativeSelectOption>
                {accounts.map((account) => (
                  <NativeSelectOption key={account.id} value={account.id}>
                    {account.customerName} · {account.maskedNumber}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="api-customer">Customer</FieldLabel>
              <NativeSelect
                id="api-customer"
                value={filters.customerId}
                onChange={(event) => update('customerId', event.target.value)}
              >
                <NativeSelectOption value="">All customers</NativeSelectOption>
                {[
                  ...new Map(
                    accounts.map((account) => [account.customerId, account]),
                  ).values(),
                ].map((account) => (
                  <NativeSelectOption
                    key={account.customerId}
                    value={account.customerId}
                  >
                    {account.customerName}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="api-from">From</FieldLabel>
              <Input
                id="api-from"
                type="date"
                value={filters.from}
                onChange={(event) => update('from', event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="api-until">To (exclusive)</FieldLabel>
              <Input
                id="api-until"
                type="date"
                value={filters.toExclusive}
                onChange={(event) => update('toExclusive', event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="api-category">Category</FieldLabel>
              <NativeSelect
                id="api-category"
                value={filters.category}
                onChange={(event) => update('category', event.target.value)}
              >
                <NativeSelectOption value="">All categories</NativeSelectOption>
                {categories.data?.items.map((category) => (
                  <NativeSelectOption key={category.code} value={category.code}>
                    {category.display_name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="api-source">Source</FieldLabel>
              <NativeSelect
                id="api-source"
                value={filters.source}
                onChange={(event) => update('source', event.target.value)}
              >
                <NativeSelectOption value="">All sources</NativeSelectOption>
                {Object.entries(sourceNames).map(([value, label]) => (
                  <NativeSelectOption key={value} value={value}>
                    {label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="api-direction">Direction</FieldLabel>
              <NativeSelect
                id="api-direction"
                value={filters.direction}
                onChange={(event) => update('direction', event.target.value)}
              >
                <NativeSelectOption value="">
                  Both directions
                </NativeSelectOption>
                <NativeSelectOption value="DEBIT">Money out</NativeSelectOption>
                <NativeSelectOption value="CREDIT">Money in</NativeSelectOption>
              </NativeSelect>
            </Field>
            {endpoint === 'breakdowns' && (
              <Field>
                <FieldLabel htmlFor="api-group">Group by</FieldLabel>
                <NativeSelect
                  id="api-group"
                  value={groupBy}
                  onChange={(event) => update('groupBy', event.target.value)}
                >
                  {[
                    'CATEGORY',
                    'MERCHANT',
                    'SOURCE',
                    'ACCOUNT',
                    'DAY',
                    'MONTH',
                  ].map((value) => (
                    <NativeSelectOption key={value} value={value}>
                      {value}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            )}
            {endpoint === 'transactions' && (
              <>
                <Field>
                  <FieldLabel htmlFor="api-limit">Page size</FieldLabel>
                  <Input
                    id="api-limit"
                    type="number"
                    min={1}
                    max={100}
                    value={limit}
                    onChange={(event) => update('limit', event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="api-cursor">Cursor</FieldLabel>
                  <Input
                    id="api-cursor"
                    value={cursor}
                    onChange={(event) => update('cursor', event.target.value)}
                  />
                </Field>
              </>
            )}
          </FieldGroup>
        </form>
        <Button
          type="submit"
          form="explore-api"
          className="w-fit"
          disabled={query.isPending}
        >
          {query.isPending ? 'Running…' : 'Run query'}
        </Button>
        <Field>
          <FieldLabel htmlFor="api-request">Request URL</FieldLabel>
          <Input id="api-request" readOnly value={path} />
        </Field>
        <ErrorMessage error={query.error ?? categories.error} />
        {query.data && (
          <>
            <Badge
              variant={query.data.status < 400 ? 'secondary' : 'destructive'}
              className="w-fit"
            >
              HTTP {query.data.status} · {query.data.durationMs} ms
            </Badge>
            <Field>
              <FieldLabel htmlFor="api-response">
                Response for GET {query.data.path}
              </FieldLabel>
              <Textarea
                id="api-response"
                readOnly
                className="h-80 field-sizing-fixed font-mono"
                value={JSON.stringify(query.data.body, null, 2)}
              />
            </Field>
            {endpoint === 'transactions' && query.data.body.nextCursor && (
              <Button
                variant="outline"
                className="w-fit"
                onClick={() => {
                  const next = new URL(query.data.path, window.location.origin)
                  next.searchParams.set('cursor', query.data.body.nextCursor)
                  update('cursor', query.data.body.nextCursor)
                  query.mutate(next.pathname + next.search)
                }}
              >
                Next result page
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
