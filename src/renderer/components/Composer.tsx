import { ArrowUp, Radio, ScanSearch, Square } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { hasProductAccess } from '@shared/plans'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { useAppStore } from '@/store/app-store'
import { useAuthStore } from '@/store/auth-store'
import { useRealtimeStore } from '@/store/realtime-store'

export function Composer() {
  const composer = useAppStore((state) => state.composer)
  const setComposer = useAppStore((state) => state.setComposer)
  const sendMessage = useAppStore((state) => state.sendMessage)
  const askFromScreen = useAppStore((state) => state.askFromScreen)
  const generatingId = useAppStore((state) => state.generatingId)
  const stopGeneration = useAppStore((state) => state.stopGeneration)
  const entitlement = useAuthStore((state) => state.entitlement)
  const realtimeListening = useRealtimeStore((state) => state.listening)
  const realtimeSpeaking = useRealtimeStore((state) => state.speaking)
  const realtimeError = useRealtimeStore((state) => state.error)
  const toggleRealtime = useRealtimeStore((state) => state.toggle)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const realtimeTranscript = useRealtimeStore((state) => state.transcript)
  const canSend = Boolean(composer.trim()) && !generatingId
  const paid = hasProductAccess(entitlement?.plan, entitlement?.status, entitlement?.interviewCredits)
  const screenAllowed = paid
  const audioAllowed = paid

  useEffect(() => {
    const node = textareaRef.current
    if (!node) return
    node.style.height = 'auto'
    node.style.height = `${Math.min(Math.max(node.scrollHeight, 88), 180)}px`
  }, [composer])

  return (
    <div className="px-3 pb-3">
      <div className="relative no-drag rounded-xl bg-surface-2 transition-colors duration-150 hover:bg-raised">
        <label htmlFor="composer-input" className="sr-only">
          Message
        </label>
        <textarea
          id="composer-input"
          ref={textareaRef}
          rows={3}
          value={composer}
          placeholder="Ask anything..."
          className="block max-h-[180px] min-h-[88px] w-full resize-none bg-surface-2 px-3 pt-3 pb-12 text-[14px] leading-relaxed text-fg outline-none placeholder:text-muted select-text no-drag"
          onPointerDown={() => textareaRef.current?.focus()}
          onChange={(event) => setComposer(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void sendMessage()
            }
          }}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between px-2 pb-2">
          <div className="pointer-events-auto flex items-center">
            <Button
              variant={realtimeListening ? 'default' : 'outline'}
              className="h-8 px-3 text-[12px]"
              disabled={Boolean(generatingId) || !audioAllowed}
              onClick={() => {
                if (!audioAllowed && !realtimeListening) {
                  useRealtimeStore.setState({
                    error: 'Live copilot needs an active subscription.',
                  })
                  return
                }
                void toggleRealtime()
              }}
              title={audioAllowed ? 'Live copilot' : 'Upgrade for live copilot'}
            >
              <Radio className="h-3.5 w-3.5" />
              {realtimeListening ? 'Stop live copilot' : 'Live copilot'}
            </Button>
          </div>
          <div className="pointer-events-auto flex items-center gap-2">
            <Button
              variant="outline"
              className="h-8 px-3 text-[12px]"
              disabled={Boolean(generatingId) || !screenAllowed}
              onClick={() => void askFromScreen()}
              title={screenAllowed ? 'Answer from screen' : 'Upgrade to answer from screen'}
            >
              <ScanSearch className="h-3.5 w-3.5" />
              Answer from screen
            </Button>
            {generatingId ? (
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8"
                onClick={stopGeneration}
                aria-label="Stop generation"
              >
                <Square className="h-3 w-3" />
              </Button>
            ) : (
              <Button
                size="icon"
                className={cn('h-8 w-8', !canSend && 'opacity-40')}
                disabled={!canSend}
                onClick={() => void sendMessage()}
                aria-label="Send message"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
      {(realtimeListening || realtimeTranscript) ? (
        <p className="mt-1.5 px-1 text-[12px] leading-relaxed text-fg">
          <span className="text-[11px] font-medium tracking-wide text-muted uppercase">
            Computer Audio (Interviewer)
          </span>
          {' '}
          {realtimeTranscript || (realtimeSpeaking ? 'Hearing…' : 'Listening…')}
        </p>
      ) : null}
      {realtimeListening ? (
        <p className="mt-1.5 px-1 text-[11px] text-muted">
          Live copilot · Computer Audio (Interviewer) · {realtimeSpeaking ? 'hearing speech' : generatingId ? 'answering, still listening' : realtimeTranscript ? 'waiting for a pause' : 'listening'}
          {realtimeError ? ` · ${realtimeError}` : null}
        </p>
      ) : null}
    </div>
  )
}
