import { createFileRoute } from '@tanstack/react-router'
import { FraudRuleSettings } from '@/features/fraud-rules/page'
import { ruleOptions } from '@/features/fraud-rules/queries'
import { categoryOptions } from '@/features/transactions/queries'
export const Route = createFileRoute('/fraud-rules')({
  loader: ({ context }) =>
    context.session?.fraudEnabled && context.session.operator
      ? Promise.all([
          context.queryClient.ensureQueryData(ruleOptions),
          context.queryClient.ensureQueryData(categoryOptions),
        ])
      : undefined,
  component: FraudRuleSettings,
})
