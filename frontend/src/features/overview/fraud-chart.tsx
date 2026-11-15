import { Link } from '@tanstack/react-router'
import { Cell, Pie, PieChart, Label } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from '@/components/ui/table'
import { NoData } from '@/components/feedback'
import type { AppSearch } from '@/lib/search'
import { ChartCard } from './chart-card'
import type { OverviewReport } from './queries'

export function FraudChart({
  report,
  filters,
}: {
  report: OverviewReport
  filters: AppSearch
}) {
  if (!report.fraud) return null
  const config = {
    notFlagged: { label: 'Not flagged', color: 'var(--chart-1)' },
    needsReview: { label: 'Needs review', color: 'var(--destructive)' },
    reviewed: { label: 'Reviewed', color: 'var(--chart-3)' },
    pending: { label: 'Awaiting check', color: 'var(--muted-foreground)' },
  }
  const rows = (Object.keys(config) as (keyof typeof config)[]).map((key) => ({
    name: key,
    count: report.fraud![key],
    fill: config[key].color,
  }))
  const total = rows.reduce((sum, row) => sum + row.count, 0)
  return (
    <ChartCard
      title="Fraud review status"
      description="Checks for transactions in this period"
      footer={
        <Button asChild variant="outline" className="self-start">
          <Link
            to="/fraud"
            search={{ ...filters, reviewStatus: 'NEEDS_REVIEW' }}
          >
            Review flagged transactions
          </Link>
        </Button>
      }
      table={
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Transactions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.name}>
                <TableCell>{config[row.name].label}</TableCell>
                <TableCell className="text-right">
                  {row.count.toLocaleString('en-ZA')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      }
    >
      <div className="flex min-h-64 flex-wrap items-center justify-center gap-4">
        {total ? (
          <ChartContainer
            config={config}
            className="h-52 w-52 shrink-0"
            aria-label="Fraud review status chart"
          >
            <PieChart accessibilityLayer>
              <ChartTooltip
                content={<ChartTooltipContent nameKey="name" hideLabel />}
              />
              <Pie
                data={rows}
                dataKey="count"
                nameKey="name"
                innerRadius={66}
                outerRadius={90}
                strokeWidth={3}
                isAnimationActive={false}
              >
                {rows.map((row) => (
                  <Cell key={row.name} fill={row.fill} />
                ))}
                <Label
                  content={({ viewBox }) =>
                    viewBox && 'cx' in viewBox && 'cy' in viewBox ? (
                      <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle">
                        <tspan
                          x={viewBox.cx}
                          className="fill-foreground text-2xl font-semibold"
                        >
                          {total.toLocaleString('en-ZA')}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          dy="22"
                          className="fill-muted-foreground text-xs"
                        >
                          transactions
                        </tspan>
                      </text>
                    ) : null
                  }
                />
              </Pie>
            </PieChart>
          </ChartContainer>
        ) : (
          <NoData
            title="No transactions to check"
            description="Choose another period or account."
          />
        )}
        <dl className="grid min-w-40 gap-3 text-sm">
          {rows.map((row) => (
            <div
              key={row.name}
              className="flex items-center justify-between gap-6"
            >
              <dt className="flex items-center gap-2">
                <span
                  className="size-2.5 rounded-sm"
                  style={{ backgroundColor: row.fill }}
                />
                {config[row.name].label}
              </dt>
              <dd className="font-semibold tabular-nums">
                {row.count.toLocaleString('en-ZA')}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </ChartCard>
  )
}
