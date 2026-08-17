import { QUICK_ACTIONS } from '@shared/defaults'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/app-store'

export function QuickActions() {
  const setComposer = useAppStore((state) => state.setComposer)
  const composer = useAppStore((state) => state.composer)
  const generating = Boolean(useAppStore((state) => state.generatingId))
  const hasMessages = useAppStore((state) => {
    const active = state.conversations.find((item) => item.id === state.activeId)
    return Boolean(active?.messages.length)
  })

  if (hasMessages) return null

  return (
    <div className="flex flex-wrap gap-1.5 px-3 pb-2">
      {QUICK_ACTIONS.map((action) => (
        <Button
          key={action.id}
          variant="outline"
          size="sm"
          disabled={generating}
          className="h-6 rounded-full px-2.5 text-[11px] hover:bg-lift"
          onClick={() => {
            setComposer(composer ? composer : action.prompt)
            requestAnimationFrame(() => document.getElementById('composer-input')?.focus())
          }}
        >
          {action.label}
        </Button>
      ))}
    </div>
  )
}
