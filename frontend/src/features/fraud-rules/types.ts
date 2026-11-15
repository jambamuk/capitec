export type Rule = {
  code: string
  name: string
  type:
    | 'AMOUNT_GREATER_THAN'
    | 'MERCHANT_EQUALS'
    | 'CATEGORY_EQUALS'
    | 'VELOCITY_COUNT'
    | 'VELOCITY_AMOUNT'
    | 'NEW_BENEFICIARY_PAYMENT'
    | 'FOREIGN_ONLINE_PAYMENT'
  enabled: boolean
  direction: 'ANY' | 'DEBIT' | 'CREDIT'
  amount: string | null
  matchValue: string | null
  windowMinutes?: number | null
  countThreshold?: number | null
  severity?: 'LOW' | 'MEDIUM' | 'HIGH'
}
export const amountTypes = [
  'AMOUNT_GREATER_THAN',
  'VELOCITY_AMOUNT',
  'NEW_BENEFICIARY_PAYMENT',
  'FOREIGN_ONLINE_PAYMENT',
]
export const windowTypes = [
  'VELOCITY_COUNT',
  'VELOCITY_AMOUNT',
  'NEW_BENEFICIARY_PAYMENT',
]
export const descriptions: Record<Rule['type'], string> = {
  AMOUNT_GREATER_THAN:
    'Compare this transaction with a fixed amount threshold.',
  MERCHANT_EQUALS: 'Match a merchant name exactly, ignoring letter case.',
  CATEGORY_EQUALS: 'Match a categorized transaction.',
  VELOCITY_COUNT:
    'Review when the account has more than the configured number of transactions in a rolling window, including this transaction.',
  VELOCITY_AMOUNT:
    'Review when the combined account amount in a rolling window exceeds the threshold.',
  NEW_BENEFICIARY_PAYMENT:
    'Both must match: an outgoing transfer exceeds the amount and the beneficiary was created within the configured window.',
  FOREIGN_ONLINE_PAYMENT:
    'All must match: an online card purchase, a merchant outside the home country, and an amount above the threshold.',
}
export type Configuration = {
  version: number
  rules: Rule[]
  createdBy: string
  createdAt: string
}
