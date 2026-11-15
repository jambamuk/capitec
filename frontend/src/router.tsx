import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { queryClient } from '@/lib/query-client'
import { PageSkeleton } from '@/components/page-skeleton'
import { RouteError } from '@/components/route-error'

export const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
  defaultPendingMs: 150,
  defaultPendingMinMs: 200,
  defaultPendingComponent: PageSkeleton,
  defaultErrorComponent: RouteError,
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
