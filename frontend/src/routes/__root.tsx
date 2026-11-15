import { createRootRouteWithContext } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { AppShell } from '@/components/app-shell'
import { PageSkeleton } from '@/components/page-skeleton'
import { RouteError } from '@/components/route-error'
import { readSearch } from '@/lib/search'
import { sessionOptions, accountOptions } from '@/lib/session-queries'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    validateSearch: readSearch,
    beforeLoad: async ({ context }) => ({
      session: await context.queryClient.ensureQueryData(sessionOptions),
    }),
    loader: ({ context }) =>
      context.session
        ? context.queryClient.ensureQueryData(
            accountOptions(context.session.username),
          )
        : undefined,
    pendingComponent: PageSkeleton,
    errorComponent: RouteError,
    component: AppShell,
  },
)
