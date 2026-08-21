import { ArrowUp, AudioLines, Mic, MicOff, Monitor, Paperclip, Radio, ScanSearch, Square, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { formatAccelerator } from '@shared/accelerator'
import { MODEL_OPTIONS, resolveChatModel } from '@shared/defaults'
import { isPaidPlan } from '@shared/plans'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { desktop } from '@/lib/desktop'
import { createId, formatBytes } from '@/lib/format'
import { cn } from '@/lib/cn'
import { LiveControl } from '@/components/LiveControl'
import { useVoiceInput } from '@/hooks/use-voice-input'
import { useAppStore } from '@/store/app-store'
import { useAuthStore } from '@/store/auth-store'
import { useRealtimeStore } from '@/store/realtime-store'

export function Composer() {
  const composer = useAppStore((state) => state.composer)
  const setComposer = useAppStore((state) => state.setComposer)
  const attachments = useAppStore((state) => state.attachments)
  const setAttachments = useAppStore((state) => state.setAttachments)
  const sendMessage = useAppStore((state) => state.sendMessage)
  const askFromScreen = useAppStore((state) => state.askFromScreen)
  const generatingId = useAppStore((state) => state.generatingId)
  const stopGeneration = useAppStore((state) => state.stopGeneration)
  const shortcuts = useAppStore((state) => state.shortcuts)
  const settings = useAppStore((state) => state.settings)
  const setSettings = useAppStore((state) => state.setSettings)
  const screenContext = useAppStore((state) => state.screenContext)
  const toggleScreenContext = useAppStore((state) => state.toggleScreenContext)
  const entitlement = useAuthStore((state) => state.entitlement)
  const realtimeListening = useRealtimeStore((state) => state.listening)
  const realtimeSpeaking = useRealtimeStore((state) => state.speaking)
  const realtimeError = useRealtimeStore((state) => state.error)
  const toggleRealtime = useRealtimeStore((state) => state.toggle)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const realtimeTranscript = useRealtimeStore((state) => state.transcript)
  const realtimeMode = useRealtimeStore((state) => state.mode)
  const { listening, error: voiceError, toggle: toggleVoice } = useVoiceInput()
  const [attaching, setAttaching] = useState(false)
  const canSend = Boolean(composer.trim() || attachments.length) && !generatingId
  const paid = isPaidPlan(entitlement?.plan, entitlement?.status)
  const screenAllowed = paid
  const audioAllowed = paid

  useEffect(() => {
    const node = textareaRef.current
    if (!node) return
    node.style.height = 'auto'
    node.style.height = `${Math.min(Math.max(node.scrollHeight, 88), 180)}px`
  }, [composer])

  const attach = async () => {
    if (attaching) return
    setAttaching(true)
    try {
      const files = await desktop.app.pickFiles()
      if (!files.length) return
      setAttachments([
        ...attachments,
        ...files.map((file) => ({ ...file, id: createId() })),
      ])
    } finally {
      setAttaching(false)
    }
  }

  return (
    <div className="px-3 pb-3">
      <div className="mb-1.5 flex items-center gap-1 px-1">
        <Select
          value={resolveChatModel(settings.model)}
          onValueChange={(value) => void setSettings({ model: value })}
        >
          <SelectTrigger
            className="h-6 w-auto min-w-[108px] gap-1 rounded-full border-0 bg-transparent px-2 py-0 text-[11px] text-muted hover:bg-raised hover:text-fg"
            aria-label="Model"
            title={formatAccelerator(shortcuts.toggleModel, desktop.platform)}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODEL_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value} className="text-[12px]">
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          type="button"
          onClick={() => screenAllowed && toggleScreenContext()}
          className={cn(
            'flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]',
            screenContext && screenAllowed ? 'bg-accent-fill text-accent-fill-fg' : 'text-muted hover:bg-raised hover:text-fg',
            !screenAllowed && 'opacity-50 cursor-not-allowed',
          )}
          title={screenAllowed ? 'Include screen with your next message' : 'Upgrade to include screen'}
        >
          <Monitor className="h-3 w-3" />
          Screen
        </button>
      </div>
      <div className="relative no-drag rounded-xl bg-surface-2 transition-colors duration-150 hover:bg-raised">
        {attachments.length ? (
          <ul className="flex flex-wrap gap-1.5 px-3 pt-3">
            {attachments.map((file) => (
              <li
                key={file.id}
                className="flex items-center gap-1 rounded-md bg-surface px-2 py-1 text-[11px] transition-colors duration-150 hover:bg-lift"
              >
                <span>{file.name}</span>
                <span className="text-muted">{formatBytes(file.size)}</span>
                <button
                  type="button"
                  aria-label={`Remove ${file.name}`}
                  className="rounded-sm p-0.5 text-muted transition-colors duration-150 hover:bg-lift hover:text-fg"
                  onClick={() => setAttachments(attachments.filter((item) => item.id !== file.id))}
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <label htmlFor="composer-input" className="sr-only">
          Message
        </label>
        <textarea
          id="composer-input"
          ref={textareaRef}
          rows={3}
          value={composer}
          placeholder={listening ? 'Listening… speak now' : 'Ask anything...'}
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
            <IconButton label="Attach file" loading={attaching} onClick={() => void attach()}>
              <Paperclip className="h-4 w-4" />
            </IconButton>
            <IconButton
              label={screenAllowed ? 'Answer from screen' : 'Upgrade to answer from screen'}
              shortcut={formatAccelerator(shortcuts.askScreen, desktop.platform)}
              disabled={Boolean(generatingId) || realtimeListening}
              onClick={() => void askFromScreen()}
            >
              <ScanSearch className="h-4 w-4" />
            </IconButton>
            <LiveControl
              active={listening}
              idleLabel="Voice input"
              liveLabel="Stop voice input"
              idleIcon={<Mic className="h-4 w-4" />}
              liveIcon={<MicOff className="h-4 w-4" />}
              disabled={realtimeListening}
              onClick={toggleVoice}
            />
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
                if (listening) toggleVoice()
                void toggleRealtime()
              }}
            />
            <Select value={realtimeMode} onValueChange={(value) => useRealtimeStore.setState({ mode: value as 'mic' | 'system' })} disabled={realtimeListening}>
              <SelectTrigger className="h-7 w-[210px] border-0 bg-transparent text-[11px] text-muted focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system" className="text-[12px]">Computer Audio (Interviewer)</SelectItem>
                <SelectItem value="mic" className="text-[12px]">Microphone (You)</SelectItem>
              </SelectContent>
            </Select>
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
            {realtimeMode === 'system' ? 'Computer Audio (Interviewer)' : 'Microphone (You)'}
          </span>
          {' '}
          {realtimeTranscript || (realtimeSpeaking ? 'Hearing…' : 'Listening…')}
        </p>
      ) : null}
      <p className="mt-1.5 px-1 text-[11px] text-muted">
        Enter to send · {formatAccelerator(shortcuts.toggleModel, desktop.platform)} {resolveChatModel(settings.model) === 'gpt-4.1' ? 'Intelligent' : 'Fast'} · {formatAccelerator(shortcuts.askScreen, desktop.platform)} answer from screen · {formatAccelerator(shortcuts.liveCopilotAudio, desktop.platform)} copilot
        {listening ? ' · Voice input live' : null}
        {voiceError ? ` · ${voiceError}` : null}
        {realtimeListening
          ? ` · Live copilot · ${realtimeMode === 'system' ? 'Computer Audio (Interviewer)' : 'Microphone (You)'} · ${realtimeSpeaking ? 'hearing speech' : generatingId ? 'answering, still listening' : realtimeTranscript ? 'waiting for a pause' : 'listening'}`
          : null}
        {realtimeError ? ` · ${realtimeError}` : null}
      </p>
    </div>
  )
}
