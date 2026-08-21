import { QUICK_ACTIONS } from '@shared/defaults'
import { cn } from '@/lib/cn'
import { useAppStore } from '@/store/app-store'

export function QuickActions() {
  const generating = Boolean(useAppStore((state) => state.generatingId))
  const activeId = useAppStore((state) => state.quickActionId)
  const toggleQuickAction = useAppStore((state) => state.toggleQuickAction)

  return (
    <div className="flex flex-wrap gap-1.5 px-3 pb-2">
      {QUICK_ACTIONS.map((action) => {
        const active = action.id === activeId
        return (
          <button
            key={action.id}
            type="button"
            disabled={generating}
            aria-pressed={active}
            className={cn(
              'h-6 rounded-full px-2.5 text-[11px] transition-colors duration-150',
              active
                ? 'bg-accent-fill text-accent-fill-fg'
                : 'bg-surface-2 text-muted hover:bg-lift hover:text-fg',
              generating && 'opacity-40',
            )}
            onClick={() => toggleQuickAction(action.id)}
          >
            {action.label}
          </button>
        )
      })}
    </div>
  )
}
