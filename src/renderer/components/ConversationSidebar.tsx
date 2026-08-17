import { Plus } from 'lucide-react'
import { conversationGroup, formatSessionTime } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAppStore, windowModeFromWidth } from '@/store/app-store'

const GROUPS = ['Today', 'Yesterday', 'Older'] as const

export function ConversationSidebar() {
  const conversations = useAppStore((state) => state.conversations)
  const activeId = useAppStore((state) => state.activeId)
  const selectConversation = useAppStore((state) => state.selectConversation)
  const newConversation = useAppStore((state) => state.newConversation)
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
        'flex w-[220px] shrink-0 flex-col border-r border-border bg-surface',
        compact && 'w-[196px]',
      )}
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
      <ScrollArea className="min-h-0 flex-1">
        <nav className="px-2 pb-3">
          {grouped.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted">No sessions yet</p>
          ) : (
            grouped.map((group) => (
              <div key={group.label} className="mb-3">
                <p className="px-2 pb-1 text-[11px] font-medium tracking-wide text-muted uppercase">{group.label}</p>
                <ul className="space-y-0.5">
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => selectConversation(item.id)}
                        aria-current={item.id === activeId ? 'page' : undefined}
                        className={cn(
                          'w-full rounded-md bg-transparent px-2 py-1.5 text-left transition-colors duration-150 hover:bg-lift hover:text-fg',
                          item.id === activeId ? 'bg-raised font-medium text-fg hover:bg-lift' : 'text-muted',
                        )}
                      >
                        <span className="block truncate text-[13px]">{item.title}</span>
                        <span className="mt-0.5 block text-[11px] font-normal tabular-nums text-muted">
                          {item.id === runningSessionId ? 'Live' : formatSessionTime(item.createdAt)}
                        </span>
                      </button>
                    </li>
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
