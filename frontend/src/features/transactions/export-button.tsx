import { Download } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { apiResponse, params } from '@/lib/api'
import type { AppSearch } from '@/lib/search'
import { transactionFilters } from './queries'
import { Button } from '@/components/ui/button'
import { ErrorMessage } from '@/components/feedback'

export function ExportButton({ search }: { search: AppSearch }) {
  const download = useMutation({
    mutationFn: async () => {
      const response = await apiResponse(
        '/api/v1/transactions/export?' + params(transactionFilters(search)),
      )
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = 'transactions.csv'
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    },
  })
  return (
    <div className="flex flex-col gap-2">
      <Button onClick={() => download.mutate()} disabled={download.isPending}>
        <Download data-icon="inline-start" />
        {download.isPending ? 'Exporting…' : 'Export CSV'}
      </Button>
      <ErrorMessage error={download.error} />
    </div>
  )
}
