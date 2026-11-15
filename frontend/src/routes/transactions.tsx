import { createFileRoute } from '@tanstack/react-router'
import { Transactions } from '@/features/transactions/page'
import {
  transactionOptions,
  summaryOptions,
  categoryOptions,
} from '@/features/transactions/queries'

export const Route = createFileRoute('/transactions')({
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    context.session
      ? Promise.all([
          context.queryClient.ensureQueryData(transactionOptions(deps)),
          context.queryClient.ensureQueryData(summaryOptions(deps)),
          context.queryClient.ensureQueryData(categoryOptions),
        ])
      : undefined,
  component: Transactions,
})
