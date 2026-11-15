export type SourceState = {
  source: string
  paused: boolean | null
  intervalMs: number | null
  error: string | null
}
export type EventRequest = {
  requestId: string
  accountId: string
  source: 'CORE_BANK' | 'CARD_PROCESSOR' | 'WALLET_PROVIDER'
  amount: string
  description: string
  direction: 'DEBIT' | 'CREDIT'
  type: 'CARD_PURCHASE' | 'TRANSFER'
  channel: 'POS' | 'ECOMMERCE' | 'MOBILE' | 'ONLINE' | 'ATM' | 'BRANCH'
  occurredAt: string
  count: number
  spacingSeconds: number
  merchant: string
  merchantCategory: string
  country: string
  beneficiary: string
  beneficiaryAgeMinutes: number
}
export type Receipt = {
  requestId: string
  requested: number
  accepted: {
    reference: string
    topic: string
    partition: number
    offset: number
    event: unknown
  }[]
  error: string | null
}
export type TestResult = {
  id: string
  reference: string
  description: string
  amount: string
  category: string
  status: string
  severity: string
}
export const sourceNames: Record<string, string> = {
  CORE_BANK: 'Bank',
  CARD_PROCESSOR: 'Card processor',
  WALLET_PROVIDER: 'Wallet',
}
