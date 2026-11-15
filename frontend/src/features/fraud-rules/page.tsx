import { Badge } from '@/components/ui/badge'
import { UnsavedChanges } from './unsaved-changes'
import { RuleCard } from './rule-card'
import { ruleOptions } from './queries'
import type { Rule, Configuration } from './types'
import { useState } from 'react'
import {
  useMutation,
  useSuspenseQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useAccount } from '@/components/app-shell'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle } from '@/components/ui/alert'
import { ErrorMessage, NoData } from '@/components/feedback'

function Editor({
  configuration,
  onSaved,
  onReload,
  reloading,
}: {
  configuration: Configuration
  onSaved: (version: number) => void
  onReload: () => void
  reloading: boolean
}) {
  const [rules, setRules] = useState(configuration.rules)
  const dirty = JSON.stringify(rules) !== JSON.stringify(configuration.rules)
  const client = useQueryClient()
  const update = (index: number, patch: Partial<Rule>) =>
    setRules((old) =>
      old.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)),
    )
  const save = useMutation({
    mutationFn: () =>
      api<Configuration>('/api/v1/fraud-rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedVersion: configuration.version, rules }),
      }),
    onSuccess: (value) => {
      client.setQueryData(['fraud-rules'], value)
      onSaved(value.version)
    },
  })
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        save.mutate()
      }}
      className="flex flex-col gap-5"
    >
      <UnsavedChanges dirty={dirty} />
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="secondary">
          {rules.filter((rule) => rule.enabled).length} of {rules.length} rules
          enabled
        </Badge>
        {dirty && <Badge variant="outline">Unsaved changes</Badge>}
        <Button
          type="button"
          variant="outline"
          onClick={onReload}
          disabled={dirty || reloading || save.isPending}
        >
          Reload rules
        </Button>
      </div>
      <ErrorMessage error={save.error} />
      {rules.map((rule, index) => (
        <RuleCard
          key={rule.code}
          rule={rule}
          update={(patch) => update(index, patch)}
          onRemove={() => setRules((old) => old.filter((_, i) => i !== index))}
        />
      ))}

      {rules.length === 0 && (
        <NoData
          title="No rules configured"
          description="Add a rule to start reviewing payments."
        />
      )}
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={rules.length >= 20 || save.isPending}
          onClick={() =>
            setRules((old) => {
              let number = 1
              while (old.some((rule) => rule.code === 'RULE_' + number))
                number++
              return [
                ...old,
                {
                  code: 'RULE_' + number,
                  name: 'New rule',
                  type: 'AMOUNT_GREATER_THAN',
                  enabled: true,
                  direction: 'DEBIT',
                  amount: '5000.00',
                  matchValue: null,
                },
              ]
            })
          }
        >
          Add rule
        </Button>
        <Button type="submit" disabled={!dirty || save.isPending}>
          {save.isPending ? 'Saving…' : 'Save rules'}
        </Button>
        {dirty && (
          <Button
            type="button"
            variant="ghost"
            disabled={save.isPending}
            onClick={() => setRules(configuration.rules)}
          >
            Discard changes
          </Button>
        )}
      </div>
    </form>
  )
}
export function FraudRuleSettings() {
  const { session } = useAccount()
  if (!session.operator || !session.fraudEnabled)
    return (
      <NoData
        title="Operator access required"
        description="Only operators can configure enabled fraud rules."
      />
    )
  return <RuleSettingsContent />
}

function RuleSettingsContent() {
  const [saved, setSaved] = useState<number | null>(null)
  const query = useSuspenseQuery(ruleOptions)
  return (
    <main className="flex max-w-4xl flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Fraud rules</h2>
        </div>
      </div>
      {saved && (
        <Alert>
          <AlertTitle>Rules saved</AlertTitle>
        </Alert>
      )}
      <ErrorMessage error={query.error} />
      {query.data && (
        <>
          <Editor
            key={query.data.version + ':' + query.dataUpdatedAt}
            configuration={query.data}
            onSaved={setSaved}
            onReload={() => void query.refetch()}
            reloading={query.isFetching}
          />
        </>
      )}
    </main>
  )
}
