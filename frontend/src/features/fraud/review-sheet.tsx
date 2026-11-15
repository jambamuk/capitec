import { useState } from 'react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAccount } from '@/components/app-shell'
import { PaymentFacts } from '@/components/transaction-detail'
import { humanize } from '@/lib/labels'
import { ErrorMessage, Loading } from '@/components/feedback'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { api, dateTime, money } from '@/lib/api'
import type { Transaction } from '@/lib/types'

type Evaluation = {
  status: string
  severity: string
  rules: {
    ruleCode: string
    result: string
    explanation: string
    criteria: { name?: string }
  }[]
  review: {
    outcome: string
    reviewedBy: string
    reviewedAt: string
    note: string
  } | null
}

export function FraudReviewSheet({
  transaction,
  onClose,
}: {
  transaction: Transaction
  onClose: () => void
}) {
  const { session } = useAccount()
  const client = useQueryClient()
  const [note, setNote] = useState('')
  const [outcome, setOutcome] = useState('REVIEWED')
  const query = useQuery({
    queryKey: ['fraud-detail', transaction.id],
    queryFn: () =>
      api<Evaluation>(
        `/api/v1/transactions/${transaction.id}/fraud-evaluation`,
      ),
    refetchInterval: (query) =>
      query.state.data?.status === 'PENDING' ? 2000 : false,
  })
  const review = useMutation({
    mutationFn: () =>
      api(`/api/v1/transactions/${transaction.id}/fraud-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note, outcome }),
      }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({
          queryKey: ['fraud-detail', transaction.id],
        }),
        client.invalidateQueries({ queryKey: ['fraud'] }),
        client.invalidateQueries({ queryKey: ['overview'] }),
      ])
    },
  })
  const evaluation = query.data
  const matched =
    evaluation?.rules.filter((rule) => rule.result === 'MATCHED') ?? []
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <SheetContent className="overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{transaction.description}</SheetTitle>
          <SheetDescription>
            {money(transaction.amount)} · {dateTime(transaction.occurredAt)}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 p-6">
          <ErrorMessage error={query.error ?? review.error} />
          {query.isPending ? (
            <Loading />
          ) : (
            evaluation && (
              <>
                <Badge
                  variant={
                    evaluation.status === 'FLAGGED' && !evaluation.review
                      ? 'destructive'
                      : 'secondary'
                  }
                  className="w-fit"
                >
                  {evaluation.review
                    ? 'Reviewed'
                    : evaluation.status === 'PENDING'
                      ? 'Checking payment'
                      : evaluation.status === 'FLAGGED'
                        ? 'Needs review'
                        : 'Not flagged'}
                </Badge>
                <PaymentFacts transaction={transaction} />
                {matched.length > 0 && (
                  <section
                    className="flex flex-col gap-3"
                    aria-label="Reasons for review"
                  >
                    <h3 className="text-lg font-semibold">
                      Reasons for review
                    </h3>
                    {matched.map((rule) => (
                      <Alert key={rule.ruleCode}>
                        <AlertTitle>
                          {rule.criteria.name ?? 'Payment flagged'}
                        </AlertTitle>
                        <AlertDescription>{rule.explanation}</AlertDescription>
                      </Alert>
                    ))}
                    <p className="text-sm text-muted-foreground">
                      Priority: {humanize(evaluation.severity)}
                    </p>
                  </section>
                )}
                {evaluation.review ? (
                  <Alert>
                    <AlertTitle>
                      Reviewed by {evaluation.review.reviewedBy}
                    </AlertTitle>
                    <AlertDescription>
                      <p>{humanize(evaluation.review.outcome)}</p>
                      <p>{evaluation.review.note}</p>
                      <p>{dateTime(evaluation.review.reviewedAt)}</p>
                    </AlertDescription>
                  </Alert>
                ) : (
                  evaluation.status === 'FLAGGED' &&
                  session.operator && (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault()
                        review.mutate()
                      }}
                    >
                      <FieldGroup>
                        <Field>
                          <FieldLabel id="review-outcome-label">
                            Review outcome
                          </FieldLabel>
                          <ToggleGroup
                            type="single"
                            variant="outline"
                            value={outcome}
                            aria-labelledby="review-outcome-label"
                            onValueChange={(value) => {
                              if (value) setOutcome(value)
                            }}
                          >
                            <ToggleGroupItem value="REVIEWED">
                              Reviewed
                            </ToggleGroupItem>
                            <ToggleGroupItem value="CLEARED">
                              Cleared
                            </ToggleGroupItem>
                            <ToggleGroupItem value="ESCALATED">
                              Escalated
                            </ToggleGroupItem>
                          </ToggleGroup>
                        </Field>
                        <Field>
                          <FieldLabel htmlFor="review-note">
                            Review note
                          </FieldLabel>
                          <Textarea
                            id="review-note"
                            required
                            maxLength={1000}
                            value={note}
                            onChange={(event) => setNote(event.target.value)}
                          />
                        </Field>
                        <Button
                          type="submit"
                          disabled={review.isPending || !note.trim()}
                        >
                          {review.isPending ? 'Saving…' : 'Mark as reviewed'}
                        </Button>
                      </FieldGroup>
                    </form>
                  )
                )}
              </>
            )
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
