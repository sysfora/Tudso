import { Check, Copy, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

export function MessageActions({
  onCopy,
  onRegenerate,
  disabled,
}: {
  onCopy: () => void
  onRegenerate?: () => void
  disabled?: boolean
}) {
  const [copied, setCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  return (
    <div className="mt-2 flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-muted hover:bg-lift hover:text-fg"
        onClick={() => {
          onCopy()
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1200)
        }}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? 'Copied' : 'Copy'}
      </Button>
      {onRegenerate ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-muted hover:bg-lift hover:text-fg"
          disabled={disabled}
          loading={regenerating}
          onClick={() => {
            setRegenerating(true)
            onRegenerate()
          }}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Regenerate
        </Button>
      ) : null}
    </div>
  )
}
