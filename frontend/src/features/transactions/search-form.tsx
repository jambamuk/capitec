import { Search } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import type { AppSearch } from '@/lib/search'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Field, FieldLabel } from '@/components/ui/field'

export function TransactionSearch({ search }: { search: AppSearch }) {
  const navigate = useNavigate({ from: '/transactions' })
  return (
    <form
      className="grid items-end gap-4 sm:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_auto]"
      onSubmit={(event) => {
        event.preventDefault()
        const values = new FormData(event.currentTarget)
        void navigate({
          search: (old) => ({
            ...old,
            cursor: undefined,
            q: String(values.get('q') || '').trim() || undefined,
            minAmount: String(values.get('minAmount') || '') || undefined,
            maxAmount: String(values.get('maxAmount') || '') || undefined,
          }),
        })
      }}
    >
      <Field>
        <FieldLabel htmlFor="transaction-search">
          Search transactions
        </FieldLabel>
        <InputGroup>
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            id="transaction-search"
            name="q"
            type="search"
            maxLength={120}
            placeholder="Description or reference"
            defaultValue={search.q ?? ''}
          />
        </InputGroup>
      </Field>
      <Field>
        <FieldLabel htmlFor="minimum-amount">Minimum amount (R)</FieldLabel>
        <Input
          id="minimum-amount"
          name="minAmount"
          type="number"
          min="0"
          step="0.01"
          defaultValue={search.minAmount ?? ''}
          placeholder="Any amount"
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="maximum-amount">Maximum amount (R)</FieldLabel>
        <Input
          id="maximum-amount"
          name="maxAmount"
          type="number"
          min="0"
          step="0.01"
          defaultValue={search.maxAmount ?? ''}
          placeholder="Any amount"
        />
      </Field>
      <Button type="submit">Search</Button>
    </form>
  )
}
