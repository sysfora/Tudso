import { X } from 'lucide-react'
import { formatAccelerator } from '@shared/accelerator'
import { SHORTCUT_GROUPS, SHORTCUT_LABELS } from '@shared/defaults'
import { Kbd } from '@/components/ui/input'
import { desktop } from '@/lib/desktop'
import { cn } from '@/lib/cn'
import { useAppStore } from '@/store/app-store'

export function HelpOverlay() {
  const open = useAppStore((state) => state.shortcutsOpen)
  const setOpen = useAppStore((state) => state.setShortcutsOpen)
  const shortcuts = useAppStore((state) => state.shortcuts)

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-fg/50 p-6 pt-16 backdrop-blur-sm"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div
        className={cn(
          'max-h-[80vh] w-full max-w-xl overflow-auto rounded-2xl border border-border bg-surface p-5',
          'transition-transform duration-200 ease-out',
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Keyboard shortcuts</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md p-1 text-muted transition-colors duration-150 hover:bg-raised hover:text-fg"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group.title}>
              <h3 className="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">{group.title}</h3>
              <ul className="space-y-1.5">
                {group.ids.map((id) => (
                  <li key={id} className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="text-fg">{SHORTCUT_LABELS[id]}</span>
                    <Kbd>{formatAccelerator(shortcuts[id], desktop.platform)}</Kbd>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <p className="mt-5 text-[12px] text-muted">
          Customize shortcuts in Settings → Keyboard. Defaults use Ctrl+Alt so they stay clear of other apps.
        </p>
      </div>
    </div>
  )
}
