import { useEffect } from 'react'
import { useQueryErrorResetBoundary } from '@tanstack/react-query'
import { useRouter, type ErrorComponentProps } from '@tanstack/react-router'
import { ErrorMessage } from './feedback'
import { Button } from './ui/button'

export function RouteError({ error }: ErrorComponentProps) {
  const router = useRouter()
  const { reset } = useQueryErrorResetBoundary()
  useEffect(() => reset(), [reset])
  return (
    <div className="flex flex-col gap-4 p-6">
      <ErrorMessage
        error={
          error instanceof Error
            ? error
            : new Error('Unable to load this page.')
        }
      />
      <div className="flex gap-3">
        <Button
          onClick={() => {
            reset()
            void router.invalidate()
          }}
        >
          Retry
        </Button>
        <Button
          variant="outline"
          onClick={() => router.navigate({ to: '.', search: {} })}
        >
          Clear filters
        </Button>
      </div>
    </div>
  )
}
