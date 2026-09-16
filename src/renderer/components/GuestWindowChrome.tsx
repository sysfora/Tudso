import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { APP_NAME } from '@shared/defaults'
import { IconButton } from '@/components/ui/icon-button'
import { Logo } from '@/components/Logo'
import { desktop } from '@/lib/desktop'
import { useAppStore } from '@/store/app-store'

export function GuestWindowChrome() {
  const windowCollapsed = useAppStore((state) => state.windowCollapsed)
  const runningSessionId = useAppStore((state) => state.runningSessionId)
  const minimizeToTray = useAppStore((state) => state.settings.minimizeToTray)

  return (
    <header
      className={
        windowCollapsed
          ? 'flex h-full min-h-0 flex-1 items-center justify-end px-2.5'
          : 'absolute inset-x-0 top-0 z-20 flex h-11 items-center justify-end px-2.5'
      }
    >
      <div className="drag-region flex h-full min-w-0 flex-1 items-center gap-2 px-1">
        <div className="no-drag flex items-center gap-2 text-[12px] font-semibold tracking-tight text-fg/90">
          <Logo className="h-4 w-4 text-accent" />
          <span>{APP_NAME}</span>
        </div>
      </div>
      <div className="no-drag relative z-10 flex items-center gap-0.5">
        <IconButton
          label={windowCollapsed ? 'Expand' : minimizeToTray ? 'Minimize to tray' : 'Minimize'}
          onClick={() => desktop.window.minimize()}
        >
          {windowCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </IconButton>
        {!runningSessionId ? (
          <IconButton label="Close" className="hover:bg-danger/20 hover:text-danger" onClick={() => desktop.app.quit()}>
            <X className="h-4 w-4" />
          </IconButton>
        ) : null}
      </div>
    </header>
  )
}
