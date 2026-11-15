import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, dateTime, money } from '@/lib/api'
import type { Page, Transaction } from '@/lib/types'
import { TransactionDetail } from '@/components/transaction-detail'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table'
import { ErrorMessage, Loading, NoData } from '@/components/feedback'

export function LiveTransactions() {
  const [paused, setPaused] = useState(false)
  const list = useQuery({
    queryKey: ['test-live-transactions'],
    queryFn: () => api<Page<Transaction>>('/api/v1/transactions?limit=10'),
    refetchInterval: paused ? false : 2000,
    refetchOnWindowFocus: false,
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle>Latest transactions</CardTitle>
        <CardDescription>
          Pause this view to inspect a stable list. The source controls stop
          incoming events.
        </CardDescription>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setPaused((value) => !value)}
          >
            {paused ? 'Resume list' : 'Pause list'}
          </Button>
          <Button
            variant="ghost"
            onClick={() => list.refetch()}
            disabled={list.isFetching}
          >
            Refresh list
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ErrorMessage error={list.error} />
        {list.isPending ? (
          <Loading />
        ) : !list.data?.items.length ? (
          <NoData
            title="No transactions"
            description="Send test events or start the sources."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.data.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{dateTime(item.occurredAt)}</TableCell>
                  <TableCell>
                    <TransactionDetail transaction={item} />
                  </TableCell>
                  <TableCell>{item.category}</TableCell>
                  <TableCell>{money(item.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
