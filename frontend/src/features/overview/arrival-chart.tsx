import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart'
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from '@/components/ui/table'
import { dateTime } from '@/lib/api'
import { ChartCard } from './chart-card'
import { arrivalSeries } from './chart-data'
import type { OverviewReport } from './queries'

export function ArrivalChart({ report }: { report: OverviewReport }) {
  const rows = arrivalSeries(report)
  const config = {
    BANK: { label: 'Bank', color: 'var(--chart-1)' },
    CARD: { label: 'Card', color: 'var(--chart-3)' },
    WALLET: { label: 'Wallet', color: 'var(--chart-4)' },
  }
  return (
    <ChartCard
      title="Incoming transactions"
      description="Received per minute · last 15 minutes · SAST"
      footer={
        <p className="text-sm text-muted-foreground">
          {report.transactions.lastReceivedAt
            ? `Last received ${dateTime(report.transactions.lastReceivedAt)}`
            : 'No transactions received yet'}
        </p>
      }
      table={
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Received at</TableHead>
              <TableHead>Bank</TableHead>
              <TableHead>Card</TableHead>
              <TableHead>Wallet</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.at}>
                <TableCell>{row.label}</TableCell>
                <TableCell>{row.BANK}</TableCell>
                <TableCell>{row.CARD}</TableCell>
                <TableCell>{row.WALLET}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      }
    >
      <ChartContainer
        config={config}
        className="h-64 w-full"
        aria-label="Incoming transactions chart"
      >
        <BarChart
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
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          {Object.keys(config).map((source) => (
            <Bar
              key={source}
              dataKey={source}
              stackId="sources"
              fill={`var(--color-${source})`}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ChartContainer>
    </ChartCard>
  )
}
