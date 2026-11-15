import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'

export function PageSkeleton() {
  return (
    <section
      role="status"
      aria-label="Loading page"
      className="flex flex-col gap-6"
    >
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <Card key={item}>
            <CardHeader>
              <Skeleton className="h-5 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Table>
        <TableBody>
          {[0, 1, 2, 3, 4].map((row) => (
            <TableRow key={row}>
              {[0, 1, 2, 3].map((cell) => (
                <TableCell key={cell}>
                  <Skeleton className="h-6 w-full" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <span className="sr-only">Loading your data</span>
    </section>
  )
}
