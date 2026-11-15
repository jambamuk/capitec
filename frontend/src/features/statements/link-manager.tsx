import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, dateTime, params } from '@/lib/api'
import type { Page, Statement } from '@/lib/types'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorMessage, NoData } from '@/components/feedback'

type ActiveLink = {
  id: string
  issuedBy: string
  createdAt: string
  expiresAt: string
}

export function LinkManager({
  statement,
  onClose,
  onRevoked,
}: {
  statement: Statement
  onClose: () => void
  onRevoked: (id: string) => void
}) {
  const client = useQueryClient()
  const [cursor, setCursor] = useState<string>()
  const links = useQuery({
    queryKey: ['statement-links', statement.id, cursor],
    queryFn: ({ signal }) =>
      api<Page<ActiveLink>>(
        `/api/v1/statements/${statement.id}/download-links?` +
          params({ cursor }),
        { signal },
      ),
    refetchInterval: 2000,
  })
  const revoke = useMutation({
    mutationFn: (id: string) =>
      api(`/api/v1/download-links/${id}`, { method: 'DELETE' }),
    onSuccess: async (_, id) => {
      onRevoked(id)
      await client.invalidateQueries({
        queryKey: ['statement-links', statement.id],
      })
    },
  })
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <SheetContent className="overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Active download links</SheetTitle>
          <SheetDescription>{statement.filename}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 p-6">
          <ErrorMessage error={links.error ?? revoke.error} />
          {links.isPending ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            links.data && (
              <>
                {!links.data.items.length && (
                  <NoData
                    title="No active links"
                    description="Download links expire automatically. Create a new link to share this statement."
                  />
                )}
                {links.data.items.map((link) => (
                  <Card key={link.id}>
                    <CardHeader>
                      <CardTitle>Created by {link.issuedBy}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <dl className="grid gap-2 text-sm">
                        <div>
                          <dt className="text-muted-foreground">Created</dt>
                          <dd>{dateTime(link.createdAt)}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Expires</dt>
                          <dd>{dateTime(link.expiresAt)} SAST</dd>
                        </div>
                      </dl>
                    </CardContent>
                    <CardFooter>
                      <Button
                        variant="outline"
                        disabled={revoke.isPending}
                        onClick={() => revoke.mutate(link.id)}
                      >
                        Revoke link
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
                {(cursor || links.data.nextCursor) && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      disabled={!cursor}
                      onClick={() => setCursor(undefined)}
                    >
                      First page
                    </Button>
                    <Button
                      variant="outline"
                      disabled={!links.data.nextCursor}
                      onClick={() =>
                        setCursor(links.data?.nextCursor || undefined)
                      }
                    >
                      Next page
                    </Button>
                  </div>
                )}
              </>
            )
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
