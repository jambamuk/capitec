import { useState, type ReactNode } from 'react'
import { SlidersHorizontal, ChevronDown } from 'lucide-react'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

/** Keep investigation controls available without placing them ahead of every mobile result. */
export function FilterPanel({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <Card>
        <CardHeader className="sm:hidden">
          <CollapsibleTrigger asChild>
            <Button variant="outline" aria-label="Filters">
              <SlidersHorizontal data-icon="inline-start" />
              Filters
              <ChevronDown
                data-icon="inline-end"
                className={open ? 'rotate-180' : ''}
              />
            </Button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent
          forceMount
          className="data-[state=closed]:hidden sm:data-[state=closed]:block"
        >
          <CardContent className="flex flex-col gap-5">{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
