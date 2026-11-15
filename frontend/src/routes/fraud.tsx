import { createFileRoute } from '@tanstack/react-router'
import { Fraud } from '@/features/fraud/page'
import { fraudOptions } from '@/features/fraud/queries'
export const Route = createFileRoute('/fraud')({
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    context.session?.fraudEnabled
      ? context.queryClient.ensureQueryData(fraudOptions(deps))
      : undefined,
  component: Fraud,
})
