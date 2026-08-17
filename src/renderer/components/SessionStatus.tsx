import { useEffect, useState } from 'react'
import { Square } from 'lucide-react'
import { formatElapsed } from '@/lib/format'
import { useAppStore } from '@/store/app-store'
import { useRealtimeStore } from '@/store/realtime-store'

export function SessionStatus() {
  const runningSessionId = useAppStore((state) => state.runningSessionId)
  const sessionStartedAt = useAppStore((state) => state.sessionStartedAt)
  const endSession = useAppStore((state) => state.endSession)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!runningSessionId || !sessionStartedAt) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [runningSessionId, sessionStartedAt])

  if (!runningSessionId || !sessionStartedAt) {
    return <p className="truncate text-[12px] text-muted">No session</p>
  }

  return (
    <div className="flex min-w-0 items-center justify-center gap-2">
      <p className="truncate tabular-nums text-[12px] text-fg">
        Session {formatElapsed(now - sessionStartedAt)}
      </p>
      <button
        type="button"
        aria-label="Stop session"
        className="no-drag flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-raised text-fg transition-colors duration-150 hover:bg-danger/20 hover:text-danger"
        onClick={() => {
          endSession()
          useRealtimeStore.getState().stop()
        }}
      >
        <Square className="h-2.5 w-2.5 fill-current" />
      </button>
    </div>
  )
}
