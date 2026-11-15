import { Link } from '@tanstack/react-router'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { NoData } from '@/components/feedback'
import { money } from '@/lib/api'
import { humanize } from '@/lib/labels'
import type { AppSearch } from '@/lib/search'
import { ChartCard } from './chart-card'
import { compactNumber } from './chart-data'
import type { OverviewReport } from './queries'

export function SpendingChart({
  report,
  filters,
}: {
  report: OverviewReport
  filters: AppSearch
}) {
  const rows = report.transactions.spending.map((row) => ({
    ...row,
    label: humanize(row.category),
    value: Number(row.amount),
  }))
  return (
    <ChartCard
      title="Spending by category"
      description="Money out · ranked by total value"
      table={
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Money out</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.category}>
                <TableCell>
                  <Button asChild variant="link" className="px-0">
                    <Link
                      to="/transactions"
                      search={{
                        ...filters,
                        category: row.category,
                        direction: 'DEBIT',
                      }}
                    >
                      {row.label}
                    </Link>
                  </Button>
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {money(row.amount)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      }
    >
      {rows.length ? (
        <ChartContainer
          config={{ value: { label: 'Money out', color: 'var(--chart-1)' } }}
          className="w-full"
          style={{ height: Math.max(256, rows.length * 38) }}
          aria-label="Spending by category chart"
        >
          <BarChart
            accessibilityLayer
            data={rows}
            layout="vertical"
            margin={{ left: 0, right: 16 }}
          >
            <CartesianGrid horizontal={false} />
            <YAxis
              type="category"
              dataKey="label"
              tickLine={false}
              axisLine={false}
              width={100}
            />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tickFormatter={(amount) => 'R ' + compactNumber(amount)}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(_, __, item) => (
                    <span className="font-mono">
                      {money(item.payload.amount)}
                    </span>
                  )}
                />
              }
            />
            <Bar
              dataKey="value"
              fill="var(--color-value)"
              radius={[0, 4, 4, 0]}
              maxBarSize={24}
              isAnimationActive={false}
            />
          </BarChart>
        </ChartContainer>
      ) : (
        <div className="flex h-64 items-center justify-center">
          <NoData
            title="No spending in this period"
            description="Choose another period or account."
          />
        </div>
      )}
    </ChartCard>
  )
}
