import { useState } from 'react'
import { useAccount } from '@/components/app-shell'
import { NoData } from '@/components/feedback'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { StreamControls } from './stream-controls'
import { EventComposer } from './event-composer'
import { ApiExplorer } from './api-explorer'
import { LiveTransactions } from './live-transactions'

export function TestingWorkspace() {
  const { session } = useAccount()
  const [generation, setGeneration] = useState(0)
  if (!session.operator || !session.testingEnabled)
    return (
      <NoData
        title="Testing workspace unavailable"
        description="This workspace is available to operators in the demo environment."
      />
    )
  return (
    <main className="flex flex-col gap-6">
      <h2 className="text-2xl font-semibold">Testing workspace</h2>
      <StreamControls onReset={() => setGeneration((value) => value + 1)} />
      <Tabs defaultValue="events" key={generation}>
        <TabsList>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="api">API explorer</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>
        <TabsContent value="events">
          <EventComposer />
        </TabsContent>
        <TabsContent value="api">
          <ApiExplorer />
        </TabsContent>
        <TabsContent value="transactions">
          <LiveTransactions />
        </TabsContent>
      </Tabs>
    </main>
  )
}
