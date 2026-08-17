import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { IconButton } from '@/components/ui/icon-button'
import { cn } from '@/lib/cn'

interface LiveControlProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active: boolean
  idleLabel: string
  liveLabel: string
  idleIcon: ReactNode
  liveIcon: ReactNode
  shortcut?: string
}

export function LiveControl({
  active,
  idleLabel,
  liveLabel,
  idleIcon,
  liveIcon,
  className,
  ...props
}: LiveControlProps) {
  return (
    <IconButton
      label={active ? liveLabel : idleLabel}
      aria-pressed={active}
      className={cn(
        active && 'bg-danger text-white hover:bg-danger hover:text-white',
        className,
      )}
      {...props}
    >
      <span className="relative inline-flex">
        {active ? liveIcon : idleIcon}
        {active ? (
          <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-white listen-pulse" aria-hidden />
        ) : null}
      </span>
    </IconButton>
  )
}
