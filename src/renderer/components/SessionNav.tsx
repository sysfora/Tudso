import { useEffect, useRef, useState } from 'react'
import { Check, Copy, FileCode, Play, Square, Trash2, X } from 'lucide-react'
import { formatAccelerator } from '@shared/accelerator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { desktop } from '@/lib/desktop'
import { formatElapsed, MAX_SESSION_TITLE } from '@/lib/format'
import { useAppStore, activeConversation } from '@/store/app-store'
import { useRealtimeStore } from '@/store/realtime-store'

export function SessionNav() {
  const conversation = useAppStore(activeConversation)
  const runningSessionId = useAppStore((state) => state.runningSessionId)
  const sessionStartedAt = useAppStore((state) => state.sessionStartedAt)
  const sessionSetupOpen = useAppStore((state) => state.sessionSetupOpen)
  const shortcuts = useAppStore((state) => state.shortcuts)
  const newConversation = useAppStore((state) => state.newConversation)
  const endSession = useAppStore((state) => state.endSession)
  const renameConversation = useAppStore((state) => state.renameConversation)
  const deleteConversation = useAppStore((state) => state.deleteConversation)
  const copyAnswer = useAppStore((state) => state.copyAnswer)
  const live = Boolean(conversation && conversation.id === runningSessionId)
  const [now, setNow] = useState(Date.now())
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(conversation?.title ?? '')
  const inputRef = useRef<HTMLInputElement>(null)
  const hint = (value: string) => formatAccelerator(value, desktop.platform)

  useEffect(() => {
    if (!live || !sessionStartedAt) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [live, sessionStartedAt])

  useEffect(() => {
    if (!editing) setDraft(conversation?.title ?? '')
  }, [conversation?.title, editing])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const stopLive = () => {
    endSession()
    useRealtimeStore.getState().stop()
  }

  const commitRename = () => {
    const next = (inputRef.current?.value ?? draft).replace(/\s+/g, ' ').trim()
    setEditing(false)
    if (conversation && next && next !== conversation.title) {
      void renameConversation(conversation.id, next)
    }
  }

  const hasAnswer = Boolean(conversation?.messages.some((item) => item.role === 'assistant' && item.content.trim()))

  if (!live && !sessionSetupOpen) {
    return (
      <Button
        className="no-drag h-8 gap-2 px-3.5"
        onClick={() => newConversation()}
        aria-label={`Start session${shortcuts.newConversation ? `, ${hint(shortcuts.newConversation)}` : ''}`}
      >
        <Play className="h-3.5 w-3.5 fill-current" />
        Start session
      </Button>
    )
  }

  if (sessionSetupOpen && !live) {
    return (
      <div className="no-drag flex h-8 items-center gap-2 rounded-md bg-raised px-3">
        <Play className="h-3.5 w-3.5 fill-current text-accent" />
        <span className="text-[13px] font-medium">New session</span>
      </div>
    )
  }

  if (editing && conversation) {
    return (
      <form
        className="no-drag flex h-8 min-w-0 max-w-[min(100%,320px)] items-center gap-1 rounded-md bg-raised px-1"
        onSubmit={(event) => {
          event.preventDefault()
          commitRename()
        }}
      >
        <input
          ref={inputRef}
          value={draft}
          maxLength={MAX_SESSION_TITLE}
          aria-label="Session name"
          className="h-6 min-w-0 flex-1 bg-transparent px-1.5 text-[13px] font-medium text-fg outline-none"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitRename}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commitRename()
            }
            if (event.key === 'Escape') {
              event.preventDefault()
              setDraft(conversation.title)
              setEditing(false)
            }
          }}
        />
        <button
          type="submit"
          aria-label="Save name"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted hover:bg-lift hover:text-fg"
          onMouseDown={(event) => event.preventDefault()}
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label="Cancel rename"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted hover:bg-lift hover:text-fg"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setDraft(conversation.title)
            setEditing(false)
          }}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </form>
    )
  }

  return (
    <div className="no-drag flex h-8 min-w-0 max-w-[min(100%,340px)] items-center rounded-md bg-raised">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Session: ${conversation?.title ?? 'Live'}${sessionStartedAt ? `, ${formatElapsed(now - sessionStartedAt)}` : ''}`}
            className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md px-2.5 text-left transition-colors duration-150 hover:bg-lift"
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-accent-fill" aria-hidden />
            <span className="min-w-0 truncate text-[13px] font-medium">
              {conversation?.title || 'Session'}
            </span>
            {sessionStartedAt ? (
              <span className="shrink-0 rounded-sm bg-surface px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted">
                {formatElapsed(now - sessionStartedAt)}
              </span>
            ) : null}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" side="bottom" className="w-[220px]">
          <DropdownMenuItem onSelect={stopLive}>
            <span className="flex items-center gap-2">
              <Square className="h-3.5 w-3.5 fill-current" />
              End session
            </span>
            <span className="ml-auto text-[11px] text-muted">{hint(shortcuts.endSession)}</span>
          </DropdownMenuItem>
          {conversation ? (
            <DropdownMenuItem onSelect={() => setEditing(true)}>Rename</DropdownMenuItem>
          ) : null}
          {hasAnswer ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void copyAnswer(1, 'markdown')}>
                <span className="flex items-center gap-2">
                  <Copy className="h-3.5 w-3.5 text-muted" />
                  Copy last answer
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void copyAnswer(1, 'code')}>
                <span className="flex items-center gap-2">
                  <FileCode className="h-3.5 w-3.5 text-muted" />
                  Copy last code
                </span>
              </DropdownMenuItem>
            </>
          ) : null}
          {conversation ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-danger data-[highlighted]:text-danger"
                onSelect={() => {
                  if (!window.confirm('Delete this session?')) return
                  stopLive()
                  void deleteConversation(conversation.id)
                }}
              >
                <span className="flex items-center gap-2">
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete session
                </span>
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <button
        type="button"
        aria-label="End session"
        title={hint(shortcuts.endSession)}
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted',
          'transition-colors duration-150 hover:bg-danger/20 hover:text-danger',
        )}
        onClick={stopLive}
      >
        <Square className="h-2.5 w-2.5 fill-current" />
      </button>
    </div>
  )
}
