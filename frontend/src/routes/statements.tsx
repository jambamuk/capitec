import { createFileRoute } from '@tanstack/react-router'
import { Statements } from '@/features/statements/page'
import { statementOptions } from '@/features/statements/queries'
export const Route = createFileRoute('/statements')({
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    context.session?.statementsEnabled
      ? context.queryClient.ensureQueryData(statementOptions(deps))
      : undefined,
  component: Statements,
})
