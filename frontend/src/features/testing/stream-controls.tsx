import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { Alert, AlertTitle } from '@/components/ui/alert'
import { ErrorMessage, Loading } from '@/components/feedback'
import { sourceNames, type SourceState } from './types'

export function StreamControls({ onReset }: { onReset: () => void }) {
  const client = useQueryClient()
  const [intervalDraft, setInterval] = useState<string | null>(null)
  const [confirm, setConfirm] = useState('')
  const [open, setOpen] = useState(false)
  const state = useQuery({
    queryKey: ['test-sources'],
    queryFn: () => api<SourceState[]>('/api/v1/testing/sources'),
    refetchInterval: 3000,
  })
  const currentInterval = state.data?.find(
    (source) => !source.error && source.intervalMs,
  )?.intervalMs
  const interval = intervalDraft ?? String(currentInterval || 5000)
  const change = useMutation({
    mutationFn: (paused: boolean) =>
      api<SourceState[]>('/api/v1/testing/sources', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paused, intervalMs: Number(interval) }),
      }),
    onSettled: () => client.invalidateQueries({ queryKey: ['test-sources'] }),
  })
  const reset = useMutation({
    mutationFn: () =>
      api<{ removedTransactions: number }>('/api/v1/testing/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: 'RESET ALL TRANSACTIONS' }),
      }),
    onSuccess: () => {
      setOpen(false)
      setConfirm('')
      onReset()
      void client.invalidateQueries()
    },
    onSettled: () => client.invalidateQueries({ queryKey: ['test-sources'] }),
  })
  const busy = change.isPending || reset.isPending
  const validInterval = Number(interval) >= 500 && Number(interval) <= 60000
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mock transaction sources</CardTitle>
        <CardDescription>
          Pause the incoming stream to run a controlled scenario. Events already
          accepted can finish processing.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ErrorMessage error={state.error ?? change.error ?? reset.error} />
        {state.isPending ? (
          <Loading />
        ) : (
          <div className="flex flex-wrap gap-3">
            {state.data?.map((source) => (
              <Badge
                key={source.source}
                variant={source.error ? 'destructive' : 'secondary'}
              >
                {sourceNames[source.source]} ·{' '}
                {source.error
                  ? 'Unavailable'
                  : source.paused
                    ? 'Paused'
                    : `Running · ${source.intervalMs! / 1000}s`}
              </Badge>
            ))}
          </div>
        )}
        <FieldGroup className="max-w-xs">
          <Field>
            <FieldLabel htmlFor="stream-interval">
              Interval per source (milliseconds)
            </FieldLabel>
            <Input
              id="stream-interval"
              type="number"
              min={500}
              max={60000}
              step={500}
              value={interval}
              onChange={(event) => setInterval(event.target.value)}
            />
          </Field>
        </FieldGroup>
        {reset.isSuccess && (
          <Alert>
            <AlertTitle>
              Cleared {reset.data.removedTransactions} transactions. Sources are
              paused.
            </AlertTitle>
          </Alert>
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          disabled={busy || !validInterval}
          onClick={() => change.mutate(true)}
        >
          Pause sources
        </Button>
        <Button
          disabled={busy || !validInterval}
          onClick={() => change.mutate(false)}
        >
          Start sources
        </Button>
        <AlertDialog
          open={open}
          onOpenChange={(value) => {
            if (!reset.isPending) setOpen(value)
          }}
        >
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={busy}>
              Reset all transactions
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset all demo transactions?</AlertDialogTitle>
              <AlertDialogDescription>
                This deletes every transaction, fraud result and review note,
                and pauses the three sources. Accounts, fraud rules and
                statements are kept. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="reset-confirm">
                  Type RESET to confirm
                </FieldLabel>
                <Input
                  id="reset-confirm"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  disabled={reset.isPending}
                />
              </Field>
            </FieldGroup>
            <ErrorMessage error={reset.error} />
            <AlertDialogFooter>
              <AlertDialogCancel disabled={reset.isPending}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={confirm !== 'RESET' || reset.isPending}
                onClick={(event) => {
                  event.preventDefault()
                  reset.mutate()
                }}
              >
                {reset.isPending ? 'Resetting…' : 'Confirm reset'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  )
}
