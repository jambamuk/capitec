import { useState } from 'react'
import { v4 as uuid } from 'uuid'
import { Link } from '@tanstack/react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useAccount } from '@/components/app-shell'
import { api, money } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { ErrorMessage } from '@/components/feedback'
import {
  sourceNames,
  type EventRequest,
  type Receipt,
  type TestResult,
} from './types'

const presets: Record<string, Partial<EventRequest>> = {
  normal: {
    amount: '100.00',
    count: 1,
    type: 'CARD_PURCHASE',
    channel: 'POS',
    country: 'ZA',
    source: 'CARD_PROCESSOR',
  },
  high: {
    amount: '6000.00',
    count: 1,
    type: 'CARD_PURCHASE',
    channel: 'POS',
    country: 'ZA',
  },
  count: {
    amount: '100.00',
    count: 10,
    spacingSeconds: 1,
    type: 'CARD_PURCHASE',
    channel: 'POS',
    country: 'ZA',
  },
  total: {
    amount: '4000.00',
    count: 3,
    spacingSeconds: 1,
    type: 'CARD_PURCHASE',
    channel: 'POS',
    country: 'ZA',
  },
  beneficiary: {
    amount: '6000.00',
    count: 1,
    type: 'TRANSFER',
    channel: 'MOBILE',
    source: 'CORE_BANK',
    beneficiaryAgeMinutes: 10,
  },
  foreign: {
    amount: '3000.00',
    count: 1,
    type: 'CARD_PURCHASE',
    channel: 'ECOMMERCE',
    country: 'GB',
    source: 'CARD_PROCESSOR',
  },
}

export function EventComposer() {
  const { accounts, session } = useAccount()
  const [draft, setDraft] = useState<EventRequest>({
    requestId: '',
    accountId: accounts[0].id,
    source: 'CARD_PROCESSOR',
    amount: '6000.00',
    description: 'Test purchase',
    direction: 'DEBIT',
    type: 'CARD_PURCHASE',
    channel: 'POS',
    occurredAt: '',
    count: 1,
    spacingSeconds: 1,
    merchant: 'GadgetHub',
    merchantCategory: '5732',
    country: 'ZA',
    beneficiary: 'Test supplier',
    beneficiaryAgeMinutes: 10,
  })
  const [time, setTime] = useState('')
  const [lastRequest, setLastRequest] = useState<EventRequest | null>(null)
  const [selected, setSelected] = useState('')
  const update = (patch: Partial<EventRequest>) =>
    setDraft((previous) => ({ ...previous, ...patch }))
  const send = useMutation({
    mutationFn: (body: EventRequest) =>
      api<Receipt>('/api/v1/testing/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
  })
  const result = useQuery({
    queryKey: ['test-results', lastRequest?.requestId],
    enabled: Boolean(lastRequest),
    queryFn: () =>
      api<TestResult[]>('/api/v1/testing/events/' + lastRequest!.requestId),
    refetchInterval: (query) => {
      const rows = query.state.data
      const complete =
        rows?.length === lastRequest?.count &&
        rows?.every((row) => !session.fraudEnabled || row.status !== 'PENDING')
      return complete ? false : 2000
    },
  })
  const evidence = useQuery({
    queryKey: ['test-evidence', selected],
    enabled: Boolean(selected) && session.fraudEnabled,
    queryFn: () =>
      api<{ status: string }>(
        `/api/v1/transactions/${selected}/fraud-evaluation`,
      ),
    refetchInterval: (query) =>
      query.state.data?.status === 'PENDING' ? 2000 : false,
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle>Send transaction events</CardTitle>
        <CardDescription>
          Choose a starting scenario, then adjust its values. Results use your
          currently saved fraud rules.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <form
          id="send-test-events"
          onSubmit={(event) => {
            event.preventDefault()
            const request = {
              ...draft,
              requestId: uuid(),
              occurredAt: time
                ? new Date(time + 'Z').toISOString()
                : new Date().toISOString(),
            }
            setLastRequest(request)
            setSelected('')
            send.mutate(request)
          }}
        >
          <FieldGroup className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="test-preset">Scenario</FieldLabel>
              <NativeSelect
                id="test-preset"
                defaultValue="high"
                onChange={(event) =>
                  update({ direction: 'DEBIT', ...presets[event.target.value] })
                }
              >
                {[
                  ['normal', 'Ordinary payment'],
                  ['high', 'High value'],
                  ['count', 'Rapid payments'],
                  ['total', 'Cumulative spend'],
                  ['beneficiary', 'New beneficiary'],
                  ['foreign', 'Overseas online purchase'],
                ].map(([value, label]) => (
                  <NativeSelectOption key={value} value={value}>
                    {label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="test-account">Account</FieldLabel>
              <NativeSelect
                id="test-account"
                value={draft.accountId}
                onChange={(event) => update({ accountId: event.target.value })}
              >
                {accounts.map((account) => (
                  <NativeSelectOption key={account.id} value={account.id}>
                    {account.customerName} · {account.maskedNumber}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="test-source">Source</FieldLabel>
              <NativeSelect
                id="test-source"
                value={draft.source}
                onChange={(event) =>
                  update({
                    source: event.target.value as EventRequest['source'],
                  })
                }
              >
                {Object.entries(sourceNames).map(([value, label]) => (
                  <NativeSelectOption key={value} value={value}>
                    {label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="test-amount">
                Amount per event (ZAR)
              </FieldLabel>
              <Input
                id="test-amount"
                required
                type="number"
                min="0.01"
                step="0.01"
                value={draft.amount}
                onChange={(event) => update({ amount: event.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="test-description">Description</FieldLabel>
              <Input
                id="test-description"
                required
                maxLength={200}
                value={draft.description}
                onChange={(event) =>
                  update({ description: event.target.value })
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="test-direction">Direction</FieldLabel>
              <NativeSelect
                id="test-direction"
                value={draft.direction}
                onChange={(event) =>
                  update({
                    direction: event.target.value as EventRequest['direction'],
                  })
                }
              >
                <NativeSelectOption value="DEBIT">Money out</NativeSelectOption>
                <NativeSelectOption value="CREDIT">Money in</NativeSelectOption>
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="test-count">Number of events</FieldLabel>
              <Input
                id="test-count"
                required
                type="number"
                min={1}
                max={20}
                value={draft.count}
                onChange={(event) =>
                  update({ count: Number(event.target.value) })
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="test-spacing">
                Event-time spacing (seconds)
              </FieldLabel>
              <Input
                id="test-spacing"
                required
                type="number"
                min={0}
                max={3600}
                value={draft.spacingSeconds}
                onChange={(event) =>
                  update({ spacingSeconds: Number(event.target.value) })
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="test-time">
                Last event time (UTC, blank = now)
              </FieldLabel>
              <Input
                id="test-time"
                type="datetime-local"
                value={time}
                onChange={(event) => setTime(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="test-type">Payment type</FieldLabel>
              <NativeSelect
                id="test-type"
                value={draft.type}
                onChange={(event) =>
                  update({ type: event.target.value as EventRequest['type'] })
                }
              >
                <NativeSelectOption value="CARD_PURCHASE">
                  Card purchase
                </NativeSelectOption>
                <NativeSelectOption value="TRANSFER">
                  Transfer
                </NativeSelectOption>
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="test-channel">Channel</FieldLabel>
              <NativeSelect
                id="test-channel"
                value={draft.channel}
                onChange={(event) =>
                  update({
                    channel: event.target.value as EventRequest['channel'],
                  })
                }
              >
                {['POS', 'ECOMMERCE', 'MOBILE', 'ONLINE', 'ATM', 'BRANCH'].map(
                  (value) => (
                    <NativeSelectOption key={value} value={value}>
                      {value}
                    </NativeSelectOption>
                  ),
                )}
              </NativeSelect>
            </Field>
            {draft.type === 'CARD_PURCHASE' ? (
              <>
                <Field>
                  <FieldLabel htmlFor="test-merchant">Merchant</FieldLabel>
                  <Input
                    id="test-merchant"
                    required
                    maxLength={200}
                    value={draft.merchant}
                    onChange={(event) =>
                      update({ merchant: event.target.value })
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="test-mcc">
                    Merchant category code
                  </FieldLabel>
                  <Input
                    id="test-mcc"
                    required
                    pattern="[0-9]{4}"
                    maxLength={4}
                    value={draft.merchantCategory}
                    onChange={(event) =>
                      update({ merchantCategory: event.target.value })
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="test-country">
                    Merchant country (ISO)
                  </FieldLabel>
                  <Input
                    id="test-country"
                    required
                    pattern="[A-Z]{2}"
                    maxLength={2}
                    value={draft.country}
                    onChange={(event) =>
                      update({ country: event.target.value.toUpperCase() })
                    }
                  />
                </Field>
              </>
            ) : (
              <>
                <Field>
                  <FieldLabel htmlFor="test-beneficiary">
                    Beneficiary
                  </FieldLabel>
                  <Input
                    id="test-beneficiary"
                    required
                    maxLength={200}
                    value={draft.beneficiary}
                    onChange={(event) =>
                      update({ beneficiary: event.target.value })
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="test-beneficiary-age">
                    Beneficiary age (minutes)
                  </FieldLabel>
                  <Input
                    id="test-beneficiary-age"
                    required
                    type="number"
                    min={0}
                    max={525600}
                    value={draft.beneficiaryAgeMinutes}
                    onChange={(event) =>
                      update({
                        beneficiaryAgeMinutes: Number(event.target.value),
                      })
                    }
                  />
                </Field>
              </>
            )}
          </FieldGroup>
        </form>
        <div className="flex flex-wrap gap-3">
          <Button
            form="send-test-events"
            type="submit"
            disabled={send.isPending}
          >
            {send.isPending ? 'Sending…' : 'Send events'}
          </Button>
          <Button
            variant="outline"
            disabled={!lastRequest || send.isPending}
            onClick={() => lastRequest && send.mutate(lastRequest)}
          >
            Replay last batch
          </Button>
          {session.fraudEnabled && (
            <Button variant="link" asChild>
              <Link to="/fraud-rules" search={{}}>
                Configure fraud rules
              </Link>
            </Button>
          )}
        </div>
        <ErrorMessage error={send.error ?? result.error ?? evidence.error} />
        {send.data && (
          <Alert>
            <AlertTitle>
              {send.data.accepted.length} of {send.data.requested} events
              acknowledged
            </AlertTitle>
            <AlertDescription>
              {send.data.error ?? 'Follow their processing results below.'}
            </AlertDescription>
          </Alert>
        )}
        {lastRequest && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transaction</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Fraud result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.data?.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Button
                        variant="link"
                        onClick={() => setSelected(row.id)}
                        disabled={!session.fraudEnabled}
                        aria-label={'Inspect test transaction ' + row.id}
                      >
                        {row.description}
                      </Button>
                    </TableCell>
                    <TableCell>{money(row.amount)}</TableCell>
                    <TableCell>{row.category}</TableCell>
                    <TableCell>
                      {session.fraudEnabled
                        ? row.status
                        : 'Fraud checks disabled'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-sm text-muted-foreground">
              {result.data?.length ?? 0} of {lastRequest.count} transactions
              ingested.
            </p>
          </>
        )}
        {evidence.data !== undefined && (
          <Field>
            <FieldLabel htmlFor="test-evidence">
              Fraud evaluation response
            </FieldLabel>
            <Textarea
              id="test-evidence"
              readOnly
              className="h-72 field-sizing-fixed font-mono"
              value={JSON.stringify(evidence.data, null, 2)}
            />
          </Field>
        )}
        {send.data && (
          <Field>
            <FieldLabel htmlFor="test-published">
              Published Kafka events
            </FieldLabel>
            <Textarea
              id="test-published"
              readOnly
              className="h-48 field-sizing-fixed font-mono"
              value={JSON.stringify(send.data.accepted, null, 2)}
            />
          </Field>
        )}
      </CardContent>
    </Card>
  )
}
