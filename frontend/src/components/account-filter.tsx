import { useNavigate } from '@tanstack/react-router'
import { useAccount } from '@/components/app-shell'
import { Field, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'

export function AccountFilter({
  to,
}: {
  to: '/overview' | '/transactions' | '/fraud' | '/statements'
}) {
  const { accountId, accounts } = useAccount()
  const navigate = useNavigate()
  return (
    <Field>
      <FieldLabel htmlFor="account-filter">Account filter</FieldLabel>
      <NativeSelect
        id="account-filter"
        value={accountId}
        onChange={(e) =>
          navigate({
            to,
            search: (old) => ({
              ...old,
              accountId: e.target.value || undefined,
              cursor: undefined,
            }),
          })
        }
      >
        <NativeSelectOption value="">All accounts</NativeSelectOption>
        {accounts.map((account) => (
          <NativeSelectOption key={account.id} value={account.id}>
            {account.customerName} · {account.maskedNumber}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </Field>
  )
}
