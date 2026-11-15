import { createFileRoute } from '@tanstack/react-router'
import { Overview } from '@/features/overview/page'
import { overviewOptions } from '@/features/overview/queries'
import { OverviewSkeleton } from '@/features/overview/skeleton'

export const Route = createFileRoute('/overview')({
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    context.session
      ? context.queryClient.ensureQueryData(overviewOptions(deps))
      : undefined,
  component: Overview,
  pendingComponent: OverviewSkeleton,
})
