import { useState } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { AccountFilter } from '@/components/account-filter'
import { LiveUpdates } from '@/components/live-updates'
import { ErrorMessage } from '@/components/feedback'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel, FieldGroup } from '@/components/ui/field'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { money } from '@/lib/api'
import { overviewOptions } from './queries'
import { ActivityChart } from './activity-chart'
import { ArrivalChart } from './arrival-chart'
import { SpendingChart } from './spending-chart'
import { FraudChart } from './fraud-chart'

export function Overview() {
  const search = useSearch({ from: '/overview' })
  const navigate = useNavigate({ from: '/overview' })
  const [paused, setPaused] = useState(false)
  const query = useSuspenseQuery({
    ...overviewOptions(search),
    refetchInterval: paused ? false : 3000,
    refetchOnWindowFocus: !paused,
    refetchOnReconnect: !paused,
  })
  const report = query.data
  const filters = {
    accountId: search.accountId,
    from: report.from,
    toExclusive: report.toExclusive,
  }
  const totals = report.transactions.totals
  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Overview</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Transactions and review activity
          </p>
        </div>
        <LiveUpdates
          paused={paused}
          onPauseChange={setPaused}
          updatedAt={report.asOf}
          fetching={query.isFetching}
          failed={query.isError}
          onRefresh={() => void query.refetch()}
        />
      </div>
      <FieldGroup className="grid max-w-xl gap-4 sm:grid-cols-2">
        <AccountFilter to="/overview" />
        <Field>
          <FieldLabel>Period</FieldLabel>
          <ToggleGroup
            type="single"
            variant="outline"
            value={String(search.days ?? 7)}
            onValueChange={(days) =>
              days &&
              navigate({ search: (old) => ({ ...old, days: Number(days) }) })
            }
            aria-label="Overview period"
          >
            <ToggleGroupItem value="1">Today</ToggleGroupItem>
            <ToggleGroupItem value="7">7 days</ToggleGroupItem>
            <ToggleGroupItem value="30">30 days</ToggleGroupItem>
          </ToggleGroup>
        </Field>
      </FieldGroup>
      <ErrorMessage error={query.error} />
      <div
        className={`grid gap-4 sm:grid-cols-2 ${report.fraud ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}
        aria-label="Overview totals"
      >
        {[
          ['Transactions', totals.transactionCount.toLocaleString('en-ZA')],
          ['Money in', money(totals.moneyIn)],
          ['Money out', money(totals.moneyOut)],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">{value}</p>
            </CardContent>
          </Card>
        ))}
        {report.fraud && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">
                Needs review
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Link
                to="/fraud"
                search={{ ...filters, reviewStatus: 'NEEDS_REVIEW' }}
                className="text-2xl font-semibold text-primary underline-offset-4 hover:underline"
              >
                {report.fraud.needsReview.toLocaleString('en-ZA')}
              </Link>
              <p className="mt-1 text-xs text-muted-foreground">
                {report.fraud.highPriority} high priority
              </p>
            </CardContent>
          </Card>
        )}
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <ActivityChart
          report={report}
          footer={
            <Button asChild variant="outline" className="self-start">
              <Link to="/transactions" search={filters}>
                View transactions
              </Link>
            </Button>
          }
        />
        <FraudChart report={report} filters={filters} />
        <SpendingChart report={report} filters={filters} />
        <ArrivalChart report={report} />
      </div>
    </main>
  )
}
