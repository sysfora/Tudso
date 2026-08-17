import { Button } from '@/components/ui/button'

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-lg bg-surface-2 px-3 py-3">
      <p className="text-[13px] font-medium">Unable to generate a response</p>
      <p className="mt-1 text-[12px] leading-relaxed text-muted">{message}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  )
}
