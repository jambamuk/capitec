import { useState } from 'react'
import { FilterPanel } from '@/components/filter-panel'
import { LiveUpdates } from '@/components/live-updates'
import { Input } from '@/components/ui/input'
import { shiftDate, todayInSouthAfrica } from '@/lib/dates'
import { useSearch, useNavigate } from '@tanstack/react-router'
import { fraudOptions } from './queries'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useAccount } from '@/components/app-shell'
import { AccountFilter } from '@/components/account-filter'
import { money, dateTime } from '@/lib/api'
import type { Transaction } from '@/lib/types'
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from '@/components/ui/pagination'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { ErrorMessage, NoData } from '@/components/feedback'
import { humanize } from '@/lib/labels'
import { FraudReviewSheet } from './review-sheet'

export function Fraud() {
  const { session } = useAccount()
  if (!session.fraudEnabled)
    return (
      <NoData
        title="This service is unavailable"
        description="Choose another page from the menu."
      />
    )
  return <FraudContent />
}

function FraudContent() {
  const { accounts } = useAccount()
  const [selected, setSelected] = useState<Transaction | null>(null)
  const search = useSearch({ from: '/fraud' })
  const navigate = useNavigate({ from: '/fraud' })
  const reviewStatus = search.reviewStatus || 'ALL'
  const cursor = search.cursor
  const setCursor = (value: string | null) =>
    navigate({ search: (old) => ({ ...old, cursor: value || undefined }) })
  const [paused, setPaused] = useState(false)
  const list = useSuspenseQuery({
    ...fraudOptions(search),
    refetchInterval: paused || cursor ? false : 3000,
    refetchOnWindowFocus: !paused,
    refetchOnReconnect: !paused,
  })
  const updateDate = (key: 'from' | 'toExclusive', value: string) =>
    navigate({
      search: (old) => ({
        ...old,
        cursor: undefined,
        from: value
          ? old.from || shiftDate(todayInSouthAfrica(), -29)
          : undefined,
        toExclusive: value
          ? old.toExclusive || shiftDate(todayInSouthAfrica(), 1)
          : undefined,
        [key]: value || undefined,
      }),
    })
  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold">Fraud checks</h2>
        {!cursor && (
          <LiveUpdates
            paused={paused}
            onPauseChange={setPaused}
            updatedAt={list.data.asOf}
            fetching={list.isFetching}
            failed={list.isError}
            onRefresh={() => void list.refetch()}
          />
        )}
      </div>
      <FilterPanel>
        <FieldGroup className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <AccountFilter to="/fraud" />
          <Field>
            <FieldLabel htmlFor="review-status">Review status</FieldLabel>
            <NativeSelect
              id="review-status"
              value={reviewStatus}
              onChange={(event) => {
                void navigate({
                  search: (old) => ({
                    ...old,
                    reviewStatus: event.target.value,
                    cursor: undefined,
                  }),
                })
              }}
            >
              <NativeSelectOption value="ALL">All checks</NativeSelectOption>
              <NativeSelectOption value="NEEDS_REVIEW">
                Needs review
              </NativeSelectOption>
              <NativeSelectOption value="REVIEWED">Reviewed</NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="fraud-priority">Priority</FieldLabel>
            <NativeSelect
              id="fraud-priority"
              value={search.severity || 'ALL'}
              onChange={(event) => {
                void navigate({
                  search: (old) => ({
                    ...old,
                    severity: event.target.value,
                    cursor: undefined,
                  }),
                })
              }}
            >
              <NativeSelectOption value="ALL">
                All priorities
              </NativeSelectOption>
              <NativeSelectOption value="HIGH">High</NativeSelectOption>
              <NativeSelectOption value="MEDIUM">Medium</NativeSelectOption>
              <NativeSelectOption value="LOW">Low</NativeSelectOption>
              <NativeSelectOption value="NONE">Not flagged</NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="fraud-from">From</FieldLabel>
            <Input
              id="fraud-from"
              type="date"
              value={search.from || ''}
              onChange={(e) => updateDate('from', e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="fraud-to">To</FieldLabel>
            <Input
              id="fraud-to"
              type="date"
              value={
                search.toExclusive ? shiftDate(search.toExclusive, -1) : ''
              }
              onChange={(e) =>
                updateDate(
                  'toExclusive',
                  e.target.value ? shiftDate(e.target.value, 1) : '',
                )
              }
            />
          </Field>
          <div className="flex items-end">
            <Button
              variant="ghost"
              onClick={() =>
                navigate({ search: (old) => ({ accountId: old.accountId }) })
              }
            >
              Clear filters
            </Button>
          </div>
        </FieldGroup>
      </FilterPanel>
      <ErrorMessage error={list.error} />
      {!list.data.items.length ? (
        <NoData
          title="No matching checks"
          description="Try a different account or review status."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Transaction</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.data.items.map(({ transaction, severity, reviewStatus }) => (
              <TableRow
                key={transaction.id}
                className="cursor-pointer"
                data-state={
                  selected?.id === transaction.id ? 'selected' : undefined
                }
                onClick={() => setSelected(transaction)}
              >
                <TableCell>{dateTime(transaction.occurredAt)}</TableCell>
                <TableCell>
                  {
                    accounts.find(
                      (account) => account.id === transaction.accountId,
                    )?.customerName
                  }
                </TableCell>
                <TableCell>
                  <Button
                    variant="link"
                    className="px-0"
                    aria-label={'Review ' + transaction.description}
                    onClick={(event) => {
                      event.stopPropagation()
                      setSelected(transaction)
                    }}
                  >
                    {transaction.description}
                  </Button>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {money(transaction.amount)}
                </TableCell>
                <TableCell>
                  {severity === 'NONE' ? (
                    '—'
                  ) : (
                    <Badge
                      variant={severity === 'HIGH' ? 'destructive' : 'outline'}
                    >
                      {humanize(severity)}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      reviewStatus === 'NEEDS_REVIEW'
                        ? 'destructive'
                        : 'secondary'
                    }
                  >
                    {reviewStatus === 'NEEDS_REVIEW'
                      ? 'Needs review'
                      : reviewStatus === 'REVIEWED'
                        ? 'Reviewed'
                        : 'Not flagged'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {(cursor || list.data?.nextCursor) && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <Button
                variant="outline"
                disabled={!cursor}
                onClick={() => setCursor(null)}
              >
                First page
              </Button>
            </PaginationItem>
            <PaginationItem>
              <Button
                variant="outline"
                disabled={!list.data?.nextCursor}
                onClick={() => setCursor(list.data?.nextCursor ?? null)}
              >
                Next page
              </Button>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
      {selected && (
        <FraudReviewSheet
          key={selected.id}
          transaction={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </main>
  )
}
