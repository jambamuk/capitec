import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'

export function ErrorMessage({ error }: { error: Error | null }) {
  return error ? (
    <Alert variant="destructive" role="alert">
      <AlertTitle>Something needs attention</AlertTitle>
      <AlertDescription>{error.message}</AlertDescription>
    </Alert>
  ) : null
}
export function Loading() {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-3">
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  )
}
export function NoData({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
