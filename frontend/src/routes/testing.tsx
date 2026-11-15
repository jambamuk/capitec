import { createFileRoute } from '@tanstack/react-router'
import { TestingWorkspace } from '@/features/testing/workspace'
export const Route = createFileRoute('/testing')({
  component: TestingWorkspace,
})
