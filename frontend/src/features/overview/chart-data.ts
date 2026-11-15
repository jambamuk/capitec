import type { OverviewReport } from './queries'

const hour = 60 * 60 * 1000
const minute = 60 * 1000
const time = new Intl.DateTimeFormat('en-ZA', {
  timeZone: 'Africa/Johannesburg',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
const day = new Intl.DateTimeFormat('en-ZA', {
  timeZone: 'Africa/Johannesburg',
  day: 'numeric',
  month: 'short',
})

// Fill quiet periods explicitly. Missing observations must not look like uninterrupted activity.
export function activitySeries(report: OverviewReport) {
  const step = report.bucket === 'hour' ? hour : 24 * hour
  // Keep every returned bucket, including an accepted payment dated later today.
  const lastObservation = Math.max(
    Date.parse(report.asOf),
    ...report.transactions.activity.map((row) => Date.parse(row.at)),
  )
  const end = Math.min(
    Date.parse(report.toExclusive + 'T00:00:00+02:00') - 1,
    lastObservation,
  )
  const recorded = new Map(
    report.transactions.activity.map((row) => [Date.parse(row.at), row]),
  )
  const rows = []
  for (
    let at = Date.parse(report.from + 'T00:00:00+02:00');
    at <= end;
    at += step
  ) {
    const values = recorded.get(at) ?? {
      credits: 0,
      debits: 0,
      moneyIn: '0.00',
      moneyOut: '0.00',
    }
    rows.push({
      ...values,
      at: new Date(at).toISOString(),
      label: (report.bucket === 'hour' ? time : day).format(at),
      // Numbers are only used for chart geometry; labels and tables retain exact decimal strings.
      creditValue: Number(values.moneyIn),
      debitValue: Number(values.moneyOut),
    })
  }
  return rows
}

export function arrivalSeries(report: OverviewReport) {
  const rows = []
  for (
    let at = Date.parse(report.receivedFrom);
    at <= Date.parse(report.asOf);
    at += minute
  ) {
    const arrivals = report.transactions.arrivals.filter(
      (row) => Date.parse(row.at) === at,
    )
    rows.push({
      at: new Date(at).toISOString(),
      label: time.format(at),
      BANK: arrivals.find((row) => row.source === 'CORE_BANK')?.count ?? 0,
      CARD: arrivals.find((row) => row.source === 'CARD_PROCESSOR')?.count ?? 0,
      WALLET:
        arrivals.find((row) => row.source === 'WALLET_PROVIDER')?.count ?? 0,
    })
  }
  return rows
}

export const compactNumber = (value: number) =>
  new Intl.NumberFormat('en-ZA', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
