import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Copy, FileCode, Play, Plus, Square, Trash2, X } from 'lucide-react'
import { formatAccelerator } from '@shared/accelerator'
import { APP_NAME } from '@shared/defaults'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/cn'
import { desktop } from '@/lib/desktop'
import { formatElapsed, MAX_SESSION_TITLE } from '@/lib/format'
import { useAppStore, activeConversation } from '@/store/app-store'
import { useRealtimeStore } from '@/store/realtime-store'

export function SessionNav() {
  const conversation = useAppStore(activeConversation)
  const runningSessionId = useAppStore((state) => state.runningSessionId)
  const sessionStartedAt = useAppStore((state) => state.sessionStartedAt)
  const generatingId = useAppStore((state) => state.generatingId)
  const shortcuts = useAppStore((state) => state.shortcuts)
  const newConversation = useAppStore((state) => state.newConversation)
  const continueSession = useAppStore((state) => state.continueSession)
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
  const status = !conversation
    ? 'No session'
    : live
      ? generatingId
        ? 'Answering'
        : 'Live'
      : 'Ready'

  if (editing && conversation) {
    return (
      <form
        className="no-drag flex h-8 min-w-0 max-w-[min(100%,320px)] items-center gap-1 rounded-md bg-surface-2 px-1"
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
    <div className="no-drag flex min-w-0 max-w-[min(100%,320px)] items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={conversation ? `Session: ${conversation.title}` : 'Sessions'}
            className={cn(
              'flex h-8 min-w-0 max-w-full items-center gap-2 rounded-md px-2.5 text-left transition-colors duration-150',
              live ? 'bg-raised hover:bg-lift' : 'bg-surface-2 hover:bg-lift',
            )}
          >
            <span
              className={cn('h-1.5 w-1.5 shrink-0 rounded-full', live ? 'bg-accent-fill' : 'bg-muted')}
              aria-hidden
            />
            <span className="min-w-0 truncate text-[13px] font-medium">
              {conversation?.title || APP_NAME}
            </span>
            {live && sessionStartedAt ? (
              <span className="shrink-0 text-[11px] tabular-nums text-muted">
                {formatElapsed(now - sessionStartedAt)}
              </span>
            ) : (
              <span className="shrink-0 text-[11px] text-muted">{status}</span>
            )}
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" side="bottom" className="w-[220px]">
          {live ? (
            <DropdownMenuItem
              onSelect={stopLive}
            >
              <span className="flex items-center gap-2">
                <Square className="h-3.5 w-3.5 fill-current" />
                End session
              </span>
              <span className="ml-auto text-[11px] text-muted">{hint(shortcuts.endSession)}</span>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => continueSession(conversation?.id)}>
              <span className="flex items-center gap-2">
                <Play className="h-3.5 w-3.5 fill-current" />
                {conversation ? 'Continue session' : 'Start session'}
              </span>
            </DropdownMenuItem>
          )}
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
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={live} onSelect={() => newConversation()}>
            <span className="flex items-center gap-2">
              <Plus className="h-3.5 w-3.5 text-muted" />
              New session
            </span>
            <span className="ml-auto text-[11px] text-muted">{hint(shortcuts.newConversation)}</span>
          </DropdownMenuItem>
          {conversation && !live ? (
            <DropdownMenuItem
              className="text-danger data-[highlighted]:text-danger"
              onSelect={() => {
                if (!window.confirm('Delete this session?')) return
                void deleteConversation(conversation.id)
              }}
            >
              <span className="flex items-center gap-2">
                <Trash2 className="h-3.5 w-3.5" />
                Delete session
              </span>
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {live ? (
        <button
          type="button"
          aria-label="End session"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-2 text-fg transition-colors duration-150 hover:bg-danger/20 hover:text-danger"
          onClick={stopLive}
        >
          <Square className="h-2.5 w-2.5 fill-current" />
        </button>
      ) : null}
    </div>
  )
}
