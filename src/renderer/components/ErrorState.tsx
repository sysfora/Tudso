import { Button } from '@/components/ui/button'
import { useState } from 'react'

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const [loading, setLoading] = useState(false)
  return (
    <div className="rounded-lg bg-surface-2 px-3 py-3">
      <p className="text-[13px] font-medium">Unable to generate a response</p>
      <p className="mt-1 text-[12px] leading-relaxed text-muted">{message}</p>
      {onRetry ? (
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          loading={loading}
          onClick={() => {
            setLoading(true)
            onRetry()
          }}
        >
          Retry
        </Button>
      ) : null}
    </div>
  )
}
