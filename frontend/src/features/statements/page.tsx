import { useEffect, useRef, useState } from 'react'
import { LinkManager } from './link-manager'
import { useSearch, useNavigate } from '@tanstack/react-router'
import { statementOptions } from './queries'
import {
  useMutation,
  useSuspenseQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useAccount } from '@/components/app-shell'
import { AccountFilter } from '@/components/account-filter'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { api, dateTime } from '@/lib/api'
import type { Statement } from '@/lib/types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from '@/components/ui/field'
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from '@/components/ui/table'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ErrorMessage, NoData } from '@/components/feedback'

type Grant = { id: string; downloadUrl: string; expiresAt: string }
export function Statements() {
  const { session } = useAccount()
  if (!session.statementsEnabled)
    return (
      <NoData
        title="This service is unavailable"
        description="Choose another page from the menu."
      />
    )
  return <StatementsContent />
}

function StatementsContent() {
  const { accountId, session, accounts } = useAccount()
  const [uploadAccountId, setUploadAccountId] = useState(accountId)
  const client = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const [grant, setGrant] = useState<{
    accountId: string
    value: Grant
    filename: string
  } | null>(null)
  const [managing, setManaging] = useState<Statement | null>(null)
  const [copied, setCopied] = useState(false)
  const search = useSearch({ from: '/statements' })
  const navigate = useNavigate({ from: '/statements' })
  const list = useSuspenseQuery(statementOptions(search))
  const upload = useMutation({
    mutationFn: async () => {
      const file = input.current?.files?.[0]
      if (!file) throw new Error('Choose a PDF first.')
      if (!uploadAccountId)
        throw new Error('Choose the account for this statement.')
      if (file.size > 10 * 1024 * 1024)
        throw new Error('PDF must be no larger than 10 MB.')
      const body = new FormData()
      body.set('file', file)
      body.set('accountId', uploadAccountId)
      return api<Statement>('/api/v1/statements', { method: 'POST', body })
    },
    onSuccess: () => {
      if (input.current) input.current.value = ''
      void client.invalidateQueries({ queryKey: ['statements'] })
      void navigate({ search: (old) => ({ ...old, cursor: undefined }) })
    },
  })
  const issue = useMutation({
    mutationFn: (id: string) =>
      api<Grant>(`/api/v1/statements/${id}/download-links`, { method: 'POST' }),
    onSuccess: (value, id) => {
      setGrant({
        accountId,
        value,
        filename:
          list.data.items.find((statement) => statement.id === id)?.filename ||
          'Statement',
      })
      setCopied(false)
      void client.invalidateQueries({ queryKey: ['statement-links', id] })
    },
  })
  const revoke = useMutation({
    mutationFn: (id: string) =>
      api(`/api/v1/download-links/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setGrant(null)
      void client.invalidateQueries({ queryKey: ['statement-links'] })
    },
  })
  const active = grant?.accountId === accountId ? grant.value : null
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [active])
  const expired = active ? now >= Date.parse(active.expiresAt) : false
  const [copyError, setCopyError] = useState<Error | null>(null)
  return (
    <main className="flex flex-col gap-5">
      <div>
        <h2 className="text-2xl font-semibold">Statements</h2>
      </div>
      <div className="max-w-sm">
        <AccountFilter to="/statements" />
      </div>
      {session.operator && (
        <Card>
          <CardHeader>
            <CardTitle>Upload a statement</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                upload.mutate()
              }}
            >
              <FieldGroup className="max-w-xl">
                <Field>
                  <FieldLabel htmlFor="upload-account">
                    Upload account
                  </FieldLabel>
                  <NativeSelect
                    id="upload-account"
                    value={uploadAccountId}
                    required
                    onChange={(e) => setUploadAccountId(e.target.value)}
                  >
                    <NativeSelectOption value="">
                      Choose an account
                    </NativeSelectOption>
                    {accounts.map((a) => (
                      <NativeSelectOption key={a.id} value={a.id}>
                        {a.customerName} · {a.maskedNumber}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor="pdf">Upload a statement</FieldLabel>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Input
                      ref={input}
                      id="pdf"
                      type="file"
                      accept=".pdf,application/pdf"
                    />
                    <Button type="submit" disabled={upload.isPending}>
                      {upload.isPending ? 'Uploading…' : 'Upload PDF'}
                    </Button>
                  </div>
                  <FieldDescription>
                    Unencrypted PDF only, up to 10 MB.
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      )}
      <ErrorMessage
        error={
          upload.error ?? issue.error ?? revoke.error ?? list.error ?? copyError
        }
      />
      {upload.isSuccess && (
        <Alert>
          <AlertTitle>Statement uploaded</AlertTitle>
          <AlertDescription>Your document is available below.</AlertDescription>
        </Alert>
      )}
      {!list.data.items.length ? (
        <NoData
          title="No statements yet"
          description={
            session.operator
              ? 'Upload a PDF for this account to get started.'
              : 'Statements will appear when an operator uploads them.'
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.data.items.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.filename}</TableCell>
                <TableCell>
                  {accounts.find((a) => a.id === s.accountId)?.customerName} ·{' '}
                  {accounts.find((a) => a.id === s.accountId)?.maskedNumber}
                </TableCell>
                <TableCell>{dateTime(s.createdAt)}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {Math.max(1, Math.ceil(s.sizeBytes / 1024)).toLocaleString(
                    'en-ZA',
                  )}{' '}
                  KB
                </TableCell>
                <TableCell>
                  <Badge
                    variant={s.status === 'AVAILABLE' ? 'secondary' : 'outline'}
                  >
                    {s.status === 'AVAILABLE'
                      ? 'Available'
                      : s.status === 'STAGING'
                        ? 'Preparing'
                        : 'Unavailable'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={s.status !== 'AVAILABLE' || issue.isPending}
                      onClick={() => issue.mutate(s.id)}
                    >
                      Create download link
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setManaging(s)}
                    >
                      Manage links
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {(search.cursor || list.data.nextCursor) && (
        <div className="flex gap-3">
          <Button
            variant="outline"
            disabled={!search.cursor}
            onClick={() =>
              navigate({ search: (old) => ({ ...old, cursor: undefined }) })
            }
          >
            First page
          </Button>
          <Button
            variant="outline"
            disabled={!list.data.nextCursor}
            onClick={() =>
              navigate({
                search: (old) => ({
                  ...old,
                  cursor: list.data.nextCursor || undefined,
                }),
              })
            }
          >
            Next page
          </Button>
        </div>
      )}
      {active && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>{grant?.filename}</CardTitle>
            <Badge variant="secondary" className="w-fit">
              {expired ? 'Link expired' : 'Download link ready'}
            </Badge>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="download-link">Download link</FieldLabel>
                <div className="flex gap-2">
                  <Input
                    id="download-link"
                    readOnly
                    value={
                      new URL(active.downloadUrl, window.location.origin).href
                    }
                  />
                  <Button
                    variant="outline"
                    disabled={expired}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(
                          new URL(active.downloadUrl, window.location.origin)
                            .href,
                        )
                        setCopied(true)
                        setCopyError(null)
                      } catch {
                        setCopyError(
                          new Error(
                            'Copy is unavailable. Select and copy the link manually.',
                          ),
                        )
                      }
                    }}
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
                <FieldDescription>
                  Expires {dateTime(active.expiresAt)} SAST. Anyone with this
                  link can download this PDF until it expires.
                </FieldDescription>
              </Field>
              {expired ? (
                <p className="text-sm text-muted-foreground">
                  Create a new link to download this statement.
                </p>
              ) : (
                <Button variant="link" asChild className="w-fit">
                  <a href={active.downloadUrl}>Download PDF</a>
                </Button>
              )}
              <Button
                variant="outline"
                className="w-fit"
                disabled={revoke.isPending}
                onClick={() => revoke.mutate(active.id)}
              >
                {revoke.isPending ? 'Revoking…' : 'Revoke download link'}
              </Button>
            </FieldGroup>
          </CardContent>
        </Card>
      )}
      {managing && (
        <LinkManager
          key={managing.id}
          statement={managing}
          onClose={() => setManaging(null)}
          onRevoked={(id) => {
            if (grant?.value.id === id) setGrant(null)
          }}
        />
      )}
    </main>
  )
}
