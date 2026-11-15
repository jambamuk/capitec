import { Pause, Play, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export function LiveUpdates({
  paused,
  onPauseChange,
  updatedAt,
  fetching,
  failed,
  onRefresh,
}: {
  paused: boolean
  onPauseChange: (paused: boolean) => void
  updatedAt?: string
  fetching: boolean
  failed: boolean
  onRefresh: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="secondary">
        {failed
          ? 'Updates unavailable'
          : paused
            ? 'Auto-refresh paused'
            : 'Auto-refresh on'}
      </Badge>
      {updatedAt && (
        <span className="text-xs text-muted-foreground">
          Updated{' '}
          {new Intl.DateTimeFormat('en-ZA', {
            timeZone: 'Africa/Johannesburg',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hourCycle: 'h23',
          }).format(new Date(updatedAt))}{' '}
          SAST
        </span>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPauseChange(!paused)}
      >
        {paused ? (
          <Play data-icon="inline-start" />
        ) : (
          <Pause data-icon="inline-start" />
        )}
        {paused ? 'Resume updates' : 'Pause updates'}
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Refresh"
        disabled={fetching}
        onClick={onRefresh}
      >
        <RefreshCw />
      </Button>
    </div>
  )
}
