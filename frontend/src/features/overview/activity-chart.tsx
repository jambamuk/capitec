import { useState } from 'react'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from '@/components/ui/table'
import { money } from '@/lib/api'
import { ChartCard } from './chart-card'
import { activitySeries, compactNumber } from './chart-data'
import type { OverviewReport } from './queries'
import type { ReactNode } from 'react'

export function ActivityChart({
  report,
  footer,
}: {
  report: OverviewReport
  footer: ReactNode
}) {
  const [measure, setMeasure] = useState('count')
  const rows = activitySeries(report)
  const value = measure === 'value'
  const config = {
    credits: { label: 'Money in', color: 'var(--chart-1)' },
    debits: { label: 'Money out', color: 'var(--chart-3)' },
    creditValue: { label: 'Money in', color: 'var(--chart-1)' },
    debitValue: { label: 'Money out', color: 'var(--chart-3)' },
  }
  return (
    <ChartCard
      title="Transaction activity"
      description={`${value ? 'Rand value' : 'Number of transactions'} by ${report.bucket === 'hour' ? 'hour' : 'day'} · SAST`}
      footer={footer}
      action={
        <ToggleGroup
          type="single"
          variant="outline"
          value={measure}
          onValueChange={(next) => next && setMeasure(next)}
          aria-label="Activity measure"
        >
          <ToggleGroupItem value="count">Count</ToggleGroupItem>
          <ToggleGroupItem value="value">Value</ToggleGroupItem>
        </ToggleGroup>
      }
      table={
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead>Credits</TableHead>
              <TableHead>Debits</TableHead>
              <TableHead>Money in</TableHead>
              <TableHead>Money out</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.at}>
                <TableCell>{row.label}</TableCell>
                <TableCell>{row.credits}</TableCell>
                <TableCell>{row.debits}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {money(row.moneyIn)}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {money(row.moneyOut)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      }
    >
      <ChartContainer
        config={config}
        className="h-64 w-full"
        aria-label="Transaction activity chart"
      >
        <LineChart
          accessibilityLayer
          data={rows}
          margin={{ left: 0, right: 12, top: 12 }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            allowDecimals={value}
            tickFormatter={compactNumber}
            width={46}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(amount, name, item) => (
                  <div className="flex w-full justify-between gap-4">
                    <span>
                      {String(name) === 'creditValue' ||
                      String(name) === 'credits'
                        ? 'Money in'
                        : 'Money out'}
                    </span>
                    <span className="font-mono">
                      {value
                        ? money(
                            item.payload[
                              String(name) === 'creditValue'
                                ? 'moneyIn'
                                : 'moneyOut'
                            ],
                          )
                        : String(amount)}
                    </span>
                  </div>
                )}
              />
            }
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Line
            type="linear"
            dataKey={value ? 'creditValue' : 'credits'}
            stroke="var(--chart-1)"
            strokeWidth={2.5}
            dot={rows.length === 1}
            isAnimationActive={false}
          />
          <Line
            type="linear"
            dataKey={value ? 'debitValue' : 'debits'}
            stroke="var(--chart-3)"
            strokeWidth={2.5}
            strokeDasharray="5 4"
            dot={rows.length === 1}
            isAnimationActive={false}
          />
        </LineChart>
      </ChartContainer>
    </ChartCard>
  )
}
