import { useState } from 'react'
import { TransactionSearch } from './search-form'
import { ExportButton } from './export-button'
import { FilterPanel } from '@/components/filter-panel'
import { LiveUpdates } from '@/components/live-updates'
import { useSuspenseQueries } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useAccount } from '@/components/app-shell'
import { AccountFilter } from '@/components/account-filter'
import { TransactionDetail } from '@/components/transaction-detail'
import { money, dateTime } from '@/lib/api'
import { transactionOptions, summaryOptions, categoryOptions } from './queries'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from '@/components/ui/table'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from '@/components/ui/pagination'
import { ErrorMessage, NoData } from '@/components/feedback'

export function Transactions() {
  const { accountId, accounts } = useAccount()
  const search = useSearch({ strict: false })
  const navigate = useNavigate()
  const [paused, setPaused] = useState(false)
  const polling = {
    refetchInterval: paused || search.cursor ? (false as const) : 3000,
    refetchOnWindowFocus: !paused,
    refetchOnReconnect: !paused,
  }
  const [list, summary, categories] = useSuspenseQueries({
    queries: [
      { ...transactionOptions(search), ...polling },
      { ...summaryOptions(search), ...polling },
      categoryOptions,
    ],
  })
  const update = (
    key: 'from' | 'toExclusive' | 'category' | 'source' | 'direction',
    value: string,
  ) =>
    navigate({
      to: '/transactions',
      search: (old) => ({
        ...old,
        [key]: value || undefined,
        cursor: undefined,
      }),
    })
  return (
    <main className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold">Transactions</h2>
        <div className="flex flex-wrap items-center gap-3">
          {!search.cursor && (
            <LiveUpdates
              paused={paused}
              onPauseChange={setPaused}
              updatedAt={list.data.asOf}
              fetching={list.isFetching}
              failed={list.isError || summary.isError}
              onRefresh={() => {
                void list.refetch()
                void summary.refetch()
              }}
            />
          )}
          <ExportButton search={search} />
        </div>
      </div>
      {summary.data && (
        <div
          className="grid gap-4 sm:grid-cols-3"
          aria-label="Transaction totals"
        >
          {[
            ['Transactions', String(summary.data.transactionCount)],
            ['Money in', money(summary.data.moneyIn)],
            ['Money out', money(summary.data.moneyOut)],
          ].map(([label, value]) => (
            <Card key={label}>
              <CardHeader>
                <CardTitle>{label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <FilterPanel>
        <TransactionSearch
          key={[search.q, search.minAmount, search.maxAmount].join('|')}
          search={search}
        />
        <FieldGroup className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <AccountFilter to="/transactions" />
          <Field>
            <FieldLabel htmlFor="from">From</FieldLabel>
            <Input
              id="from"
              type="date"
              value={search.from ?? ''}
              onChange={(e) => update('from', e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="to">To</FieldLabel>
            <Input
              id="to"
              type="date"
              value={
                search.toExclusive ? shiftDate(search.toExclusive, -1) : ''
              }
              onChange={(e) =>
                update(
                  'toExclusive',
                  e.target.value ? shiftDate(e.target.value, 1) : '',
                )
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="category">Category</FieldLabel>
            <NativeSelect
              id="category"
              value={search.category ?? ''}
              onChange={(e) => update('category', e.target.value)}
            >
              <NativeSelectOption value="">All categories</NativeSelectOption>
              {categories.data?.items.map((c) => (
                <NativeSelectOption key={c.code} value={c.code}>
                  {c.display_name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="source-filter">Source</FieldLabel>
            <NativeSelect
              id="source-filter"
              value={search.source ?? ''}
              onChange={(event) => update('source', event.target.value)}
            >
              <NativeSelectOption value="">All sources</NativeSelectOption>
              <NativeSelectOption value="CORE_BANK">Bank</NativeSelectOption>
              <NativeSelectOption value="CARD_PROCESSOR">
                Card
              </NativeSelectOption>
              <NativeSelectOption value="WALLET_PROVIDER">
                Wallet
              </NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="direction-filter">Direction</FieldLabel>
            <NativeSelect
              id="direction-filter"
              value={search.direction ?? ''}
              onChange={(event) => update('direction', event.target.value)}
            >
              <NativeSelectOption value="">Money in and out</NativeSelectOption>
              <NativeSelectOption value="CREDIT">Money in</NativeSelectOption>
              <NativeSelectOption value="DEBIT">Money out</NativeSelectOption>
            </NativeSelect>
          </Field>
          <div className="flex items-end gap-2">
            <Button
              variant="ghost"
              onClick={() =>
                navigate({ to: '/transactions', search: { accountId } })
              }
            >
              Reset
            </Button>
          </div>
        </FieldGroup>
      </FilterPanel>
      <ErrorMessage error={list.error ?? summary.error} />
      {!list.data.items.length ? (
        <NoData
          title="No matching transactions"
          description="Try a different account, date range or category."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.data.items.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="whitespace-nowrap">
                  {dateTime(t.occurredAt)}
                </TableCell>
                <TableCell>
                  {accounts.find((a) => a.id === t.accountId)?.customerName} ·{' '}
                  {accounts.find((a) => a.id === t.accountId)?.maskedNumber}
                </TableCell>
                <TableCell>
                  <TransactionDetail transaction={t} />
                  {t.payment?.paymentReference && (
                    <p
                      className="max-w-64 truncate text-xs text-muted-foreground"
                      title={t.payment.paymentReference}
                    >
                      Ref: {t.payment.paymentReference}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{t.category.toLowerCase()}</Badge>
                </TableCell>
                <TableCell className="text-right font-mono whitespace-nowrap">
                  {t.direction === 'DEBIT' ? '−' : '+'}
                  {money(t.amount)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {(search.cursor || list.data?.nextCursor) && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <Button
                variant="outline"
                disabled={!search.cursor}
                onClick={() =>
                  navigate({
                    to: '/transactions',
                    search: (old) => ({ ...old, cursor: undefined }),
                  })
                }
              >
                First page
              </Button>
            </PaginationItem>
            <PaginationItem>
              <Button
                variant="outline"
                disabled={!list.data?.nextCursor}
                onClick={() =>
                  navigate({
                    to: '/transactions',
                    search: (old) => ({
                      ...old,
                      cursor: list.data?.nextCursor ?? undefined,
                    }),
                  })
                }
              >
                Next page
              </Button>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </main>
  )
}

function shiftDate(value: string, days: number) {
  const date = new Date(value + 'T12:00:00Z')
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
