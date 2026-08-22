import { Maximize2, Minus, PanelLeft, Plus, Settings, X } from 'lucide-react'
import { formatAccelerator } from '@shared/accelerator'
import { APP_NAME } from '@shared/defaults'
import { IconButton } from '@/components/ui/icon-button'
import { Logo } from '@/components/Logo'
import { SessionNav } from '@/components/SessionNav'
import { TitleBarMenu } from '@/components/TitleBarMenu'
import { desktop } from '@/lib/desktop'
import { useAppStore, windowModeFromWidth } from '@/store/app-store'

function NavBrand() {
  return (
    <div className="ml-1 flex shrink-0 items-center gap-2">
      <Logo className="h-7 w-7 text-accent" />
      <span className="text-[14px] font-semibold tracking-tight">{APP_NAME}</span>
    </div>
  )
}

export function WindowHeader() {
  const shortcuts = useAppStore((state) => state.shortcuts)
  const newConversation = useAppStore((state) => state.newConversation)
  const runningSessionId = useAppStore((state) => state.runningSessionId)
  const settings = useAppStore((state) => state.settings)
  const settingsOpen = useAppStore((state) => state.settingsOpen)
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen)
  const sidebarCollapsed = useAppStore((state) => state.sidebarCollapsed)
  const setSidebarCollapsed = useAppStore((state) => state.setSidebarCollapsed)
  const windowWidth = useAppStore((state) => state.windowWidth)
  const windowCollapsed = useAppStore((state) => state.windowCollapsed)
  const mode = windowModeFromWidth(windowWidth)
  const shortcutHint = (value: string) => formatAccelerator(value, desktop.platform)

  if (windowCollapsed) {
    return (
      <header className="z-20 flex h-full min-h-0 flex-1 items-center gap-2 bg-transparent px-2.5">
        <div className="drag-region flex h-full min-w-0 flex-1 items-center gap-2">
          <NavBrand />
          <div className="flex h-full min-w-0 flex-1 items-center justify-center px-1">
            <SessionNav />
          </div>
        </div>
        <div className="flex h-full items-center gap-0.5">
          <TitleBarMenu />
          <IconButton label="Expand" shortcut={shortcutHint(shortcuts.toggleCollapsed)} onClick={() => desktop.window.minimize()}>
            <Maximize2 className="h-4 w-4" />
          </IconButton>
          <IconButton label="Close" className="hover:bg-danger/20 hover:text-danger" onClick={() => desktop.window.close()}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>
      </header>
    )
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-transparent px-2.5">
      {mode !== 'compact' && !settingsOpen ? (
        <IconButton
          label={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
          aria-pressed={!sidebarCollapsed}
          className={!sidebarCollapsed ? 'bg-raised text-fg hover:bg-lift' : undefined}
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        >
          <PanelLeft className="h-4 w-4" />
        </IconButton>
      ) : null}

      <div className="drag-region flex min-h-0 min-w-0 flex-1 items-center gap-2">
        <NavBrand />
        <div className="flex min-w-0 flex-1 justify-center px-2">
          <SessionNav />
        </div>
      </div>

      <div className="flex items-center gap-0.5">
        <IconButton
          label={runningSessionId ? 'Stop the current session first' : 'New session'}
          shortcut={runningSessionId ? undefined : shortcutHint(shortcuts.newConversation)}
          disabled={Boolean(runningSessionId)}
          onClick={newConversation}
        >
          <Plus className="h-4 w-4" />
        </IconButton>
        <IconButton
          label="Settings"
          shortcut={shortcutHint(shortcuts.openSettings)}
          className={settingsOpen ? 'bg-raised text-fg hover:bg-lift' : undefined}
          onClick={() => setSettingsOpen(!settingsOpen)}
        >
          <Settings className="h-4 w-4" />
        </IconButton>
        <TitleBarMenu />
        <IconButton
          label={settings.minimizeToTray ? 'Minimize to tray' : 'Minimize'}
          shortcut={settings.minimizeToTray ? undefined : shortcutHint(shortcuts.toggleCollapsed)}
          onClick={() => desktop.window.minimize()}
        >
          <Minus className="h-4 w-4" />
        </IconButton>
        <IconButton label="Close" className="hover:bg-danger/20 hover:text-danger" onClick={() => desktop.window.close()}>
          <X className="h-4 w-4" />
        </IconButton>
      </div>
    </header>
  )
}
