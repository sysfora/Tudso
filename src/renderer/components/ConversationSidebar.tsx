import { useEffect, useRef, useState } from 'react'
import { Check, Ellipsis, Plus, X } from 'lucide-react'
import { conversationGroup, formatSessionTime, MAX_SESSION_TITLE } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAppStore, windowModeFromWidth } from '@/store/app-store'
import type { Conversation } from '@shared/types'

const GROUPS = ['Today', 'Yesterday', 'Older'] as const

export function ConversationSidebar() {
  const conversations = useAppStore((state) => state.conversations)
  const activeId = useAppStore((state) => state.activeId)
  const selectConversation = useAppStore((state) => state.selectConversation)
  const newConversation = useAppStore((state) => state.newConversation)
  const renameConversation = useAppStore((state) => state.renameConversation)
  const deleteConversation = useAppStore((state) => state.deleteConversation)
  const runningSessionId = useAppStore((state) => state.runningSessionId)
  const collapsed = useAppStore((state) => state.sidebarCollapsed)
  const width = useAppStore((state) => state.windowWidth)
  const compact = useAppStore((state) => state.settings.compactMode)
  const mode = windowModeFromWidth(width)
  const visible = mode !== 'compact' && !collapsed

  if (!visible) return null

  const grouped = GROUPS.map((label) => ({
    label,
    items: conversations.filter((item) => conversationGroup(item.updatedAt) === label),
  })).filter((group) => group.items.length > 0)

  return (
    <aside
      className={cn(
        'flex w-[220px] shrink-0 flex-col border-r border-border bg-transparent',
        compact && 'w-[196px]',
      )}
      style={{ backgroundColor: 'transparent' }}
      aria-label="Sessions"
    >
      <div className="p-2">
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          disabled={Boolean(runningSessionId)}
          title={runningSessionId ? 'Stop the current session first' : undefined}
          onClick={newConversation}
        >
          <Plus className="h-3.5 w-3.5" />
          New Session
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1 bg-transparent">
        <nav className="bg-transparent px-2 pb-3">
          {grouped.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted">No sessions yet</p>
          ) : (
            grouped.map((group) => (
              <div key={group.label} className="mb-3">
                <p className="px-2 pb-1 text-[11px] font-medium tracking-wide text-muted uppercase">{group.label}</p>
                <ul className="space-y-0.5">
                  {group.items.map((item) => (
                    <SessionRow
                      key={item.id}
                      item={item}
                      active={item.id === activeId}
                      live={item.id === runningSessionId}
                      locked={Boolean(runningSessionId) && item.id !== runningSessionId}
                      onSelect={() => selectConversation(item.id)}
                      onRename={(title) => void renameConversation(item.id, title)}
                      onDelete={() => void deleteConversation(item.id)}
                    />
                  ))}
                </ul>
              </div>
            ))
          )}
        </nav>
      </ScrollArea>
    </aside>
  )
}

function SessionRow({
  item,
  active,
  live,
  locked,
  onSelect,
  onRename,
  onDelete,
}: {
  item: Conversation
  active: boolean
  live: boolean
  locked: boolean
  onSelect: () => void
  onRename: (title: string) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [draft, setDraft] = useState(item.title)
  const inputRef = useRef<HTMLInputElement>(null)
  const skipCommit = useRef(false)

  useEffect(() => {
    if (!editing) setDraft(item.title)
  }, [editing, item.title])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const startRename = () => {
    setDraft(item.title)
    setEditing(true)
  }

  const commitRename = () => {
    if (skipCommit.current) {
      skipCommit.current = false
      setEditing(false)
      return
    }
    const next = (inputRef.current?.value ?? draft).replace(/\s+/g, ' ').trim()
    setEditing(false)
    if (next && next !== item.title) onRename(next)
  }

  const cancelRename = () => {
    skipCommit.current = true
    setDraft(item.title)
    setEditing(false)
  }

  return (
    <li>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className={cn(
              'group relative rounded-md transition-colors duration-150',
              locked && 'opacity-40',
              active ? 'bg-[color:color-mix(in_srgb,var(--surface)_70%,transparent)] text-fg' : 'text-muted hover:bg-[color:color-mix(in_srgb,var(--surface)_35%,transparent)] hover:text-fg',
              locked && 'hover:bg-transparent hover:text-muted',
            )}
          >
            {editing ? (
              <form
                className="flex items-center gap-0.5 px-1 py-1"
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
                  className="h-6 min-w-0 flex-1 rounded-sm bg-[color:color-mix(in_srgb,var(--surface)_70%,transparent)] px-1 text-[13px] text-fg outline-none"
                  onChange={(event) => setDraft(event.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      commitRename()
                    }
                    if (event.key === 'Escape') {
                      event.preventDefault()
                      cancelRename()
                    }
                  }}
                />
                <button
                  type="submit"
                  aria-label="Save name"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted hover:bg-lift hover:text-fg"
                  onPointerDown={(event) => event.preventDefault()}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={(event) => {
                    event.preventDefault()
                    commitRename()
                  }}
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Cancel rename"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted hover:bg-lift hover:text-fg"
                  onPointerDown={(event) => event.preventDefault()}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={cancelRename}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </form>
            ) : (
              <>
                <button
                  type="button"
                  onClick={locked ? undefined : onSelect}
                  disabled={locked}
                  title={locked ? 'End the current session first' : undefined}
                  onDoubleClick={(event) => {
                    event.preventDefault()
                    if (locked) return
                    startRename()
                  }}
                  aria-current={active ? 'page' : undefined}
                  className="w-full rounded-md bg-transparent py-1.5 pr-8 pl-2 text-left disabled:pointer-events-none"
                >
                  <span className={cn('flex items-center gap-2 text-[13px]', active && 'font-medium')}>
                    {live ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-fill" aria-hidden /> : null}
                    <span className="min-w-0 truncate">{item.title}</span>
                  </span>
                  <span className="mt-0.5 block text-[11px] font-normal tabular-nums text-muted">
                    {live ? 'Live' : formatSessionTime(item.createdAt)}
                  </span>
                </button>
                <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Session actions"
                      className={cn(
                        'absolute top-1.5 right-1 flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-lift hover:text-fg',
                        active || menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
                      )}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Ellipsis className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" side="bottom">
                    <DropdownMenuItem onSelect={startRename}>Rename</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-danger data-[highlighted]:text-danger" onSelect={onDelete}>
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={startRename}>Rename</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem className="text-danger data-[highlighted]:text-danger" onSelect={onDelete}>
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </li>
  )
}
