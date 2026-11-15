import { humanize } from '@/lib/labels'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, dateTime, money } from '@/lib/api'
import type { Transaction } from '@/lib/types'
import { useAccount } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Table, TableBody, TableRow, TableCell } from '@/components/ui/table'
import { ErrorMessage, Loading } from './feedback'

export function PaymentFacts({ transaction }: { transaction: Transaction }) {
  const { accounts } = useAccount()
  const account = accounts.find((item) => item.id === transaction.accountId)
  const payment = transaction.payment
  const country = payment?.merchant?.country
  const rows = [
    ['Customer', account?.customerName],
    ['Account', account?.maskedNumber],
    ['Date', dateTime(transaction.occurredAt)],
    ['Category', humanize(transaction.category)],
    ['Payment method', payment ? humanize(payment.channel) : undefined],
    ['Merchant', payment?.merchant?.name],
    [
      'Country',
      country
        ? new Intl.DisplayNames(['en'], { type: 'region' }).of(country)
        : undefined,
    ],
    ['Recipient', payment?.counterparty?.name],
    [
      'Card',
      payment?.instrument ? '•••• ' + payment.instrument.lastFour : undefined,
    ],
  ].filter(([, value]) => value)
  return (
    <Table>
      <TableBody>
        {rows.map(([label, value]) => (
          <TableRow key={label}>
            <TableCell>{label}</TableCell>
            <TableCell className="whitespace-normal [overflow-wrap:anywhere]">
              {value}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function TransactionDetail({
  transaction,
}: {
  transaction: Transaction
}) {
  const [open, setOpen] = useState(false)
  const query = useQuery({
    queryKey: ['transaction-detail', transaction.id],
    queryFn: () => api<Transaction>('/api/v1/transactions/' + transaction.id),
    enabled: open,
  })
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="link"
          className="px-0"
          aria-label={'View transaction ' + transaction.description}
        >
          {transaction.description}
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{transaction.description}</SheetTitle>
          <SheetDescription>
            {transaction.direction === 'DEBIT' ? 'Money out' : 'Money in'} ·{' '}
            {money(transaction.amount)}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-5 p-6">
          <ErrorMessage error={query.error} />
          {query.isPending ? (
            <Loading />
          ) : (
            query.data && <PaymentFacts transaction={query.data} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
