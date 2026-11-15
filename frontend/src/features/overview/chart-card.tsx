import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'

export function ChartCard({
  title,
  description,
  action,
  children,
  table,
  footer,
}: {
  title: string
  description: string
  action?: ReactNode
  children: ReactNode
  table: ReactNode
  footer?: ReactNode
}) {
  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {action}
      </CardHeader>
      <CardContent className="min-w-0">{children}</CardContent>
      <CardFooter className="flex-col items-stretch gap-3 border-t pt-4">
        {footer}
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="group">
              <ChevronDown
                data-icon="inline-start"
                className="group-data-[state=open]:rotate-180"
              />
              View {title.toLowerCase()} data
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">{table}</CollapsibleContent>
        </Collapsible>
      </CardFooter>
    </Card>
  )
}
