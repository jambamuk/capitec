import { ruleSummary } from './rule-summary'
import { useQuery } from '@tanstack/react-query'
import { categoryOptions } from '@/features/transactions/queries'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from '@/components/ui/sheet'
import { ErrorMessage } from '@/components/feedback'
import { amountTypes, windowTypes, descriptions, type Rule } from './types'

export function RuleCard({
  rule,
  update,
  onRemove,
}: {
  rule: Rule
  update: (patch: Partial<Rule>) => void
  onRemove: () => void
}) {
  const categories = useQuery(categoryOptions)
  return (
    <Sheet>
      <ErrorMessage error={categories.error} />
      <Card>
        <CardHeader>
          <CardTitle>{rule.name || 'New rule'}</CardTitle>
          <CardDescription>
            {rule.enabled ? 'Enabled' : 'Disabled'} ·{' '}
            {rule.severity?.toLowerCase() ?? 'medium'} priority
          </CardDescription>
          <CardDescription>{ruleSummary(rule)}</CardDescription>
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="w-fit"
              aria-label={'Edit ' + rule.name}
            >
              Edit rule
            </Button>
          </SheetTrigger>
        </CardHeader>
        <SheetContent className="overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{rule.name}</SheetTitle>
            <SheetDescription>{descriptions[rule.type]}</SheetDescription>
          </SheetHeader>
          <div className="p-6">
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={'name-' + rule.code}>Rule name</FieldLabel>
                <Input
                  id={'name-' + rule.code}
                  required
                  maxLength={100}
                  value={rule.name}
                  onChange={(e) => update({ name: e.target.value })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={'type-' + rule.code}>Condition</FieldLabel>
                <NativeSelect
                  id={'type-' + rule.code}
                  value={rule.type}
                  onChange={(e) =>
                    update({
                      type: e.target.value as Rule['type'],
                      amount: amountTypes.includes(e.target.value)
                        ? '5000.00'
                        : null,
                      matchValue:
                        e.target.value === 'CATEGORY_EQUALS'
                          ? 'SHOPPING'
                          : e.target.value === 'FOREIGN_ONLINE_PAYMENT'
                            ? 'ZA'
                            : null,
                      windowMinutes: windowTypes.includes(e.target.value)
                        ? 5
                        : null,
                      countThreshold:
                        e.target.value === 'VELOCITY_COUNT' ? 8 : null,
                      direction: 'DEBIT',
                    })
                  }
                >
                  <NativeSelectOption value="AMOUNT_GREATER_THAN">
                    Amount greater than
                  </NativeSelectOption>
                  <NativeSelectOption value="VELOCITY_COUNT">
                    Transaction velocity
                  </NativeSelectOption>
                  <NativeSelectOption value="VELOCITY_AMOUNT">
                    Cumulative amount
                  </NativeSelectOption>
                  <NativeSelectOption value="NEW_BENEFICIARY_PAYMENT">
                    New beneficiary + amount
                  </NativeSelectOption>
                  <NativeSelectOption value="FOREIGN_ONLINE_PAYMENT">
                    Overseas online purchase + amount
                  </NativeSelectOption>
                  <NativeSelectOption value="MERCHANT_EQUALS">
                    Merchant equals
                  </NativeSelectOption>
                  <NativeSelectOption value="CATEGORY_EQUALS">
                    Category equals
                  </NativeSelectOption>
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor={'direction-' + rule.code}>
                  Transaction direction
                </FieldLabel>
                <NativeSelect
                  id={'direction-' + rule.code}
                  value={rule.direction}
                  onChange={(e) =>
                    update({
                      direction: e.target.value as Rule['direction'],
                    })
                  }
                >
                  <NativeSelectOption value="ANY">
                    Any direction
                  </NativeSelectOption>
                  <NativeSelectOption value="DEBIT">Debit</NativeSelectOption>
                  <NativeSelectOption value="CREDIT">Credit</NativeSelectOption>
                </NativeSelect>
              </Field>
              {rule.type !== 'VELOCITY_COUNT' && (
                <Field>
                  <FieldLabel htmlFor={'value-' + rule.code}>
                    {amountTypes.includes(rule.type)
                      ? 'Threshold (ZAR)'
                      : rule.type === 'MERCHANT_EQUALS'
                        ? 'Merchant name'
                        : 'Category'}
                  </FieldLabel>
                  {rule.type === 'CATEGORY_EQUALS' ? (
                    <NativeSelect
                      id={'value-' + rule.code}
                      value={rule.matchValue ?? ''}
                      required
                      onChange={(e) => update({ matchValue: e.target.value })}
                    >
                      {categories.data?.items.map((c) => (
                        <NativeSelectOption key={c.code} value={c.code}>
                          {c.display_name}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  ) : (
                    <Input
                      id={'value-' + rule.code}
                      required
                      type={amountTypes.includes(rule.type) ? 'number' : 'text'}
                      min={amountTypes.includes(rule.type) ? '0.01' : undefined}
                      step="0.01"
                      maxLength={200}
                      value={
                        (amountTypes.includes(rule.type)
                          ? rule.amount
                          : rule.matchValue) ?? ''
                      }
                      onChange={(e) =>
                        update(
                          amountTypes.includes(rule.type)
                            ? { amount: e.target.value }
                            : { matchValue: e.target.value },
                        )
                      }
                    />
                  )}
                </Field>
              )}
              {windowTypes.includes(rule.type) && (
                <Field>
                  <FieldLabel htmlFor={'window-' + rule.code}>
                    Window (minutes)
                  </FieldLabel>
                  <Input
                    id={'window-' + rule.code}
                    type="number"
                    required
                    min={1}
                    max={1440}
                    step={1}
                    value={rule.windowMinutes ?? ''}
                    onChange={(e) =>
                      update({ windowMinutes: Number(e.target.value) })
                    }
                  />
                </Field>
              )}
              {rule.type === 'VELOCITY_COUNT' && (
                <Field>
                  <FieldLabel htmlFor={'count-' + rule.code}>
                    Count greater than
                  </FieldLabel>
                  <Input
                    id={'count-' + rule.code}
                    type="number"
                    required
                    min={1}
                    max={10000}
                    step={1}
                    value={rule.countThreshold ?? ''}
                    onChange={(e) =>
                      update({ countThreshold: Number(e.target.value) })
                    }
                  />
                </Field>
              )}
              {rule.type === 'FOREIGN_ONLINE_PAYMENT' && (
                <Field>
                  <FieldLabel htmlFor={'country-' + rule.code}>
                    Home country (ISO code)
                  </FieldLabel>
                  <Input
                    id={'country-' + rule.code}
                    required
                    minLength={2}
                    maxLength={2}
                    pattern="[A-Z]{2}"
                    value={rule.matchValue ?? ''}
                    onChange={(e) =>
                      update({
                        matchValue: e.target.value.toUpperCase(),
                      })
                    }
                  />
                </Field>
              )}
              <Field>
                <FieldLabel htmlFor={'severity-' + rule.code}>
                  Review severity
                </FieldLabel>
                <NativeSelect
                  id={'severity-' + rule.code}
                  value={rule.severity ?? 'MEDIUM'}
                  onChange={(e) =>
                    update({
                      severity: e.target.value as Rule['severity'],
                    })
                  }
                >
                  <NativeSelectOption value="LOW">Low</NativeSelectOption>
                  <NativeSelectOption value="MEDIUM">Medium</NativeSelectOption>
                  <NativeSelectOption value="HIGH">High</NativeSelectOption>
                </NativeSelect>
              </Field>
            </FieldGroup>
          </div>
          <div className="flex items-center justify-between gap-4 px-6 pb-6">
            <Field orientation="horizontal">
              <Switch
                id={'enabled-' + rule.code}
                checked={rule.enabled}
                onCheckedChange={(enabled) => update({ enabled })}
              />
              <FieldLabel htmlFor={'enabled-' + rule.code}>Enabled</FieldLabel>
            </Field>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onRemove()}
              aria-label={'Remove ' + rule.name}
            >
              Remove
            </Button>
          </div>
          <SheetFooter>
            <SheetClose asChild>
              <Button type="button">Done</Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Card>
    </Sheet>
  )
}
