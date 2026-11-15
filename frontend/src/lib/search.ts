export type AppSearch = {
  accountId?: string
  from?: string
  toExclusive?: string
  category?: string
  cursor?: string
  reviewStatus?: string
  days?: number
  source?: string
  direction?: string
  q?: string
  minAmount?: string
  maxAmount?: string
  severity?: string
}

export function readSearch(raw: Record<string, unknown>): AppSearch {
  const keys = [
    'accountId',
    'from',
    'toExclusive',
    'category',
    'cursor',
    'reviewStatus',
    'source',
    'direction',
    'q',
    'severity',
  ] as const
  const filters = Object.fromEntries(
    keys
      .filter((key) => typeof raw[key] === 'string')
      .map((key) => [key, raw[key]]),
  )
  return {
    ...filters,
    ...(raw.minAmount === undefined
      ? {}
      : { minAmount: String(raw.minAmount) }),
    ...(raw.maxAmount === undefined
      ? {}
      : { maxAmount: String(raw.maxAmount) }),
    ...(raw.days === undefined ? {} : { days: Number(raw.days) }),
  }
}
