import { money } from '@/lib/api'
import { humanize } from '@/lib/labels'
import type { Rule } from './types'

export function ruleSummary(rule: Rule): string {
  const amount = rule.amount ? money(rule.amount) : 'an amount'
  const window = `${rule.windowMinutes ?? 5} minutes`
  switch (rule.type) {
    case 'AMOUNT_GREATER_THAN':
      return `Amount above ${amount}`
    case 'VELOCITY_COUNT':
      return `More than ${rule.countThreshold ?? 0} transactions in ${window}`
    case 'VELOCITY_AMOUNT':
      return `Combined amount above ${amount} in ${window}`
    case 'NEW_BENEFICIARY_PAYMENT':
      return `Transfer above ${amount} to a beneficiary added within ${window}`
    case 'FOREIGN_ONLINE_PAYMENT':
      return `Online card purchase above ${amount}, outside ${rule.matchValue || 'ZA'}`
    case 'MERCHANT_EQUALS':
      return `Merchant is ${rule.matchValue || 'not selected'}`
    case 'CATEGORY_EQUALS':
      return `Category is ${rule.matchValue ? humanize(rule.matchValue) : 'not selected'}`
  }
}
