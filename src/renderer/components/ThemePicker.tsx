import { Check, Monitor, Moon, Sun } from 'lucide-react'
import type { ThemeMode } from '@shared/types'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { IconButton } from '@/components/ui/icon-button'
import { cn } from '@/lib/cn'
import { useAppStore } from '@/store/app-store'

const THEMES: { id: ThemeMode; label: string; icon: typeof Sun }[] = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'System', icon: Monitor },
]

function ThemeIcon({ theme, className }: { theme: ThemeMode; className?: string }) {
  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor
  return <Icon className={className} />
}

export function ThemeButton() {
  const theme = useAppStore((state) => state.settings.theme)
  const setSettings = useAppStore((state) => state.setSettings)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <span className="group inline-flex">
          <IconButton label="Theme" className="group-data-[state=open]:bg-lift group-data-[state=open]:text-fg">
            <ThemeIcon theme={theme} className="h-4 w-4" />
          </IconButton>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="bottom" className="w-[160px]">
        {THEMES.map((option) => (
          <DropdownMenuItem
            key={option.id}
            onSelect={() => void setSettings({ theme: option.id })}
          >
            <span className="flex items-center gap-2">
              <option.icon className="h-3.5 w-3.5 text-muted" />
              {option.label}
            </span>
            {theme === option.id ? <Check className="h-3.5 w-3.5 text-accent" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function ThemePicker({ className }: { className?: string }) {
  const theme = useAppStore((state) => state.settings.theme)
  const setSettings = useAppStore((state) => state.setSettings)

  return (
    <div className={cn('grid w-[210px] grid-cols-3 gap-1 rounded-md bg-surface-2 p-0.5', className)}>
      {THEMES.map((option) => {
        const selected = theme === option.id
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected}
            className={cn(
              'flex h-8 items-center justify-center gap-1.5 rounded-md px-2 text-[12px] transition-colors duration-150',
              selected ? 'bg-raised font-medium text-fg' : 'text-muted hover:bg-lift hover:text-fg',
            )}
            onClick={() => void setSettings({ theme: option.id })}
          >
            <option.icon className="h-3.5 w-3.5" />
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
