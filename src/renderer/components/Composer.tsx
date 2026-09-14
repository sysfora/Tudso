import { ArrowUp, AudioLines, Radio, ScanSearch, Square } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { formatAccelerator } from '@shared/accelerator'
import { hasProductAccess } from '@shared/plans'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { desktop } from '@/lib/desktop'
import { cn } from '@/lib/cn'
import { LiveControl } from '@/components/LiveControl'
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
  const shortcuts = useAppStore((state) => state.shortcuts)
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
            <IconButton
              label={screenAllowed ? 'Answer from screen' : 'Upgrade to answer from screen'}
              shortcut={formatAccelerator(shortcuts.askScreen, desktop.platform)}
              disabled={Boolean(generatingId) || realtimeListening}
              onClick={() => void askFromScreen()}
            >
              <ScanSearch className="h-4 w-4" />
            </IconButton>
            <LiveControl
              active={realtimeListening}
              idleLabel={audioAllowed ? 'Live copilot' : 'Upgrade for live copilot'}
              liveLabel="Stop live copilot"
              idleIcon={<Radio className="h-4 w-4" />}
              liveIcon={<AudioLines className="h-4 w-4" />}
              shortcut={formatAccelerator(shortcuts.liveCopilotAudio, desktop.platform)}
              onClick={() => {
                if (!audioAllowed && !realtimeListening) {
                  useRealtimeStore.setState({
                    error: 'Live copilot needs an active subscription.',
                  })
                  return
                }
                void toggleRealtime()
              }}
            />
          </div>
          {generatingId ? (
            <Button
              size="icon"
              variant="outline"
              className="pointer-events-auto h-8 w-8"
              onClick={stopGeneration}
              aria-label="Stop generation"
            >
              <Square className="h-3 w-3" />
            </Button>
          ) : (
            <Button
              size="icon"
              className={cn('pointer-events-auto h-8 w-8', !canSend && 'opacity-40')}
              disabled={!canSend}
              onClick={() => void sendMessage()}
              aria-label="Send message"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          )}
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
