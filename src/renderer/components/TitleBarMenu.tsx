import {
  Command,
  Copy,
  CreditCard,
  FileCode,
  Keyboard,
  LogOut,
  MonitorOff,
  MoreHorizontal,
  Play,
  Square,
  User,
} from 'lucide-react'
import { formatAccelerator } from '@shared/accelerator'
import { SHORTCUT_LABELS } from '@shared/defaults'
import { canHideFromCapture } from '@shared/plans'
import type { ShortcutId, WindowMode } from '@shared/types'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { IconButton } from '@/components/ui/icon-button'
import { runAppCommand } from '@/lib/commands'
import { cn } from '@/lib/cn'
import { desktop } from '@/lib/desktop'
import { useAppStore, windowModeFromWidth } from '@/store/app-store'
import { useAuthStore } from '@/store/auth-store'
import { useRealtimeStore } from '@/store/realtime-store'

const POSITIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const
const SIZES: { id: WindowMode; label: string; name: string; shortcut: ShortcutId }[] = [
  { id: 'compact', label: 'S', name: 'Compact', shortcut: 'windowCompact' },
  { id: 'normal', label: 'M', name: 'Normal', shortcut: 'windowNormal' },
  { id: 'expanded', label: 'L', name: 'Expanded', shortcut: 'windowExpanded' },
]

export function TitleBarMenu() {
  const settings = useAppStore((state) => state.settings)
  const shortcuts = useAppStore((state) => state.shortcuts)
  const runningSessionId = useAppStore((state) => state.runningSessionId)
  const activeId = useAppStore((state) => state.activeId)
  const endSession = useAppStore((state) => state.endSession)
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen)
  const windowWidth = useAppStore((state) => state.windowWidth)
  const mode = windowModeFromWidth(windowWidth)
  const email = useAuthStore((state) => state.session?.email)
  const entitlement = useAuthStore((state) => state.entitlement)
  const hideAllowed = canHideFromCapture(entitlement?.plan, entitlement?.status)
  const hint = (value: string) => formatAccelerator(value, desktop.platform)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <span className="group inline-flex">
          <IconButton label="More" className="group-data-[state=open]:bg-lift group-data-[state=open]:text-fg">
            <MoreHorizontal className="h-4 w-4" />
          </IconButton>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="bottom"
        align="end"
        collisionPadding={8}
        className="w-[min(252px,calc(100vw-16px))] p-1.5"
      >
        {email ? (
          <>
            <DropdownMenuItem onSelect={() => setSettingsOpen(true, 'account')}>
              <span className="flex min-w-0 items-center gap-2">
                <User className="h-3.5 w-3.5 shrink-0 text-muted" />
                <span className="truncate">{email}</span>
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}

        {hideAllowed ? (
          <>
            <DropdownMenuLabel>Interview</DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              className="justify-between gap-3"
              checked={settings.hideFromCapture}
              onCheckedChange={(checked) => {
                void useAppStore.getState().setSettings({ hideFromCapture: Boolean(checked) })
              }}
            >
              <span className="flex items-center gap-2">
                <MonitorOff className="h-3.5 w-3.5 text-muted" />
                Hide from share
              </span>
              <span className="text-[11px] text-muted">{hint(shortcuts.toggleHideFromCapture)}</span>
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuLabel>Session</DropdownMenuLabel>
        {runningSessionId ? (
          <DropdownMenuItem
            onSelect={() => {
              endSession()
              useRealtimeStore.getState().stop()
            }}
          >
            <span className="flex items-center gap-2">
              <Square className="h-3.5 w-3.5 fill-current" />
              End session
            </span>
            <MenuHint>{hint(shortcuts.endSession)}</MenuHint>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => useAppStore.getState().continueSession()}>
            <span className="flex items-center gap-2">
              <Play className="h-3.5 w-3.5 fill-current" />
              {activeId ? 'Continue session' : 'Start session'}
            </span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          disabled={Boolean(runningSessionId)}
          onSelect={() => useAppStore.getState().newConversation()}
        >
          New session
          <MenuHint>{hint(shortcuts.newConversation)}</MenuHint>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void useAppStore.getState().copyAnswer(1, 'markdown')}>
          <span className="flex items-center gap-2">
            <Copy className="h-3.5 w-3.5 text-muted" />
            Copy last answer
          </span>
          <MenuHint>{hint(shortcuts.copyLastAnswer)}</MenuHint>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void useAppStore.getState().copyAnswer(1, 'code')}>
          <span className="flex items-center gap-2">
            <FileCode className="h-3.5 w-3.5 text-muted" />
            Copy last code
          </span>
          <MenuHint>{hint(shortcuts.copyLastCode)}</MenuHint>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => runAppCommand('open-command-palette')}>
          <span className="flex items-center gap-2">
            <Command className="h-3.5 w-3.5 text-muted" />
            Command palette
          </span>
          <MenuHint>{hint(shortcuts.openCommandPalette)}</MenuHint>
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Window</DropdownMenuLabel>
        <div className="px-2 pb-1.5">
          <div className="grid grid-cols-3 gap-1">
            {SIZES.map((size) => (
              <button
                key={size.id}
                type="button"
                className={cn(
                  'h-8 rounded-md text-[12px] transition-colors duration-150',
                  mode === size.id ? 'bg-lift font-medium text-fg' : 'bg-surface-2 text-muted hover:bg-lift hover:text-fg',
                )}
                title={`${size.name} · ${hint(shortcuts[size.shortcut])}`}
                aria-label={size.name}
                aria-pressed={mode === size.id}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => void desktop.window.setMode(size.id)}
              >
                {size.label}
              </button>
            ))}
          </div>
          <div className="mt-1.5 grid grid-cols-3 gap-1">
            {POSITIONS.map((preset) => {
              const id = `positionWindow${preset}` as const
              const col = (preset - 1) % 3
              const row = Math.floor((preset - 1) / 3)
              return (
                <button
                  key={preset}
                  type="button"
                  className="group relative h-8 rounded-md bg-surface-2 transition-colors duration-150 hover:bg-lift"
                  title={`${SHORTCUT_LABELS[id]} · ${hint(shortcuts[id])}`}
                  aria-label={SHORTCUT_LABELS[id]}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => void desktop.window.positionTo(preset)}
                >
                  <span
                    className={cn(
                      'absolute h-2 w-2 rounded-sm bg-muted transition-colors duration-150 group-hover:bg-fg',
                      col === 0 && 'left-1.5',
                      col === 1 && 'left-1/2 -translate-x-1/2',
                      col === 2 && 'right-1.5',
                      row === 0 && 'top-1.5',
                      row === 1 && 'top-1/2 -translate-y-1/2',
                      row === 2 && 'bottom-1.5',
                    )}
                  />
                </button>
              )
            })}
          </div>
        </div>

        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setSettingsOpen(true, 'shortcuts')}>
          <span className="flex items-center gap-2">
            <Keyboard className="h-3.5 w-3.5 text-muted" />
            Keyboard
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setSettingsOpen(true, 'subscription')}>
          <span className="flex items-center gap-2">
            <CreditCard className="h-3.5 w-3.5 text-muted" />
            Subscription
          </span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => desktop.window.hide()}>
          Hide
          <MenuHint>{hint(shortcuts.toggleWindow)}</MenuHint>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => desktop.app.quit()}>
          <span className="flex items-center gap-2">
            <LogOut className="h-3.5 w-3.5 text-muted" />
            Quit
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function MenuHint({ children }: { children: string }) {
  return (
    <span className="ml-auto text-[11px] tabular-nums text-muted transition-colors duration-150 group-data-[highlighted]:text-fg">
      {children}
    </span>
  )
}
