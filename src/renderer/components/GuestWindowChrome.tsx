import { Maximize2, Minus, X } from 'lucide-react'
import { IconButton } from '@/components/ui/icon-button'
import { desktop } from '@/lib/desktop'
import { useAppStore } from '@/store/app-store'

export function GuestWindowChrome() {
  const windowCollapsed = useAppStore((state) => state.windowCollapsed)
  const minimizeToTray = useAppStore((state) => state.settings.minimizeToTray)

  return (
    <header
      className={
        windowCollapsed
          ? 'flex h-full min-h-0 flex-1 items-center justify-end px-2.5'
          : 'absolute inset-x-0 top-0 z-20 flex h-11 items-center justify-end px-2.5'
      }
    >
      <div className="drag-region h-full min-w-0 flex-1" />
      <div className="no-drag relative z-10 flex items-center gap-0.5">
        <IconButton
          label={windowCollapsed ? 'Expand' : minimizeToTray ? 'Minimize to tray' : 'Minimize'}
          onClick={() => desktop.window.minimize()}
        >
          {windowCollapsed ? <Maximize2 className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
        </IconButton>
        <IconButton label="Close" className="hover:bg-danger/20 hover:text-danger" onClick={() => desktop.window.close()}>
          <X className="h-4 w-4" />
        </IconButton>
      </div>
    </header>
  )
}
