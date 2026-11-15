export type Account = {
  id: string
  customerId: string
  customerName: string
  maskedNumber: string
  currency: string
}
export type Transaction = {
  id: string
  accountId: string
  description: string
  source: string
  amount: string
  direction: 'CREDIT' | 'DEBIT'
  category: string
  occurredAt: string
  sourceTransactionId: string
  currency: string
  recordedAt: string
  categorizerVersion: string
  payment: {
    status: string
    type: string
    channel: string
    bookedAt: string
    valueDate: string
    paymentReference: string
    merchant: {
      id: string
      name: string
      categoryCode: string
      country: string
    } | null
    counterparty: {
      id: string
      name: string
      beneficiaryCreatedAt: string | null
    } | null
    instrument: { lastFour: string; authentication: string } | null
  } | null
}
export type Page<T> = { items: T[]; nextCursor: string | null; asOf?: string }
export type Summary = {
  transactionCount: number
  moneyIn: string
  moneyOut: string
  netFlow: string
  asOf: string
  lastProcessedAt: string | null
}
export type Session = {
  username: string
  operator: boolean
  fraudEnabled: boolean
  statementsEnabled: boolean
}
export type Statement = {
  id: string
  accountId: string
  filename: string
  status: string
  createdAt: string
  sizeBytes: number
}
