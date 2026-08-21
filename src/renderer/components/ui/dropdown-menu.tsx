import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { Check } from 'lucide-react'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

export function DropdownMenu(props: ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root {...props} />
}

export function DropdownMenuTrigger(props: ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  return <DropdownMenuPrimitive.Trigger {...props} />
}

export function DropdownMenuGroup(props: ComponentProps<typeof DropdownMenuPrimitive.Group>) {
  return <DropdownMenuPrimitive.Group {...props} />
}

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  collisionPadding = 8,
  sticky = 'always',
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        sticky={sticky}
        avoidCollisions
        className={cn(
          'z-50 min-w-44 max-w-[min(var(--radix-dropdown-menu-content-available-width),calc(100vw-16px))] overflow-x-hidden overflow-y-auto rounded-lg border border-border bg-surface p-1 text-sm anim-fade',
          'max-h-[min(var(--radix-dropdown-menu-content-available-height),calc(100vh-16px))]',
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

export function DropdownMenuItem({ className, ...props }: ComponentProps<typeof DropdownMenuPrimitive.Item>) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        'group flex cursor-pointer items-center justify-between gap-4 rounded-md px-2 py-1.5 text-[13px] outline-none transition-colors duration-150 data-[highlighted]:bg-lift data-[disabled]:opacity-40',
        className,
      )}
      {...props}
    />
  )
}

export function DropdownMenuSeparator({ className, ...props }: ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return <DropdownMenuPrimitive.Separator className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />
}

export function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof DropdownMenuPrimitive.Label>) {
  return (
    <DropdownMenuPrimitive.Label
      className={cn('px-2 pb-1 pt-1.5 text-[11px] font-medium tracking-wide text-muted uppercase', className)}
      {...props}
    />
  )
}

export function DropdownMenuCheckboxItem({
  className,
  children,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      className={cn(
        'relative flex cursor-pointer items-center rounded-md py-1.5 pr-2 pl-8 text-[13px] outline-none transition-colors duration-150 data-[highlighted]:bg-lift data-[state=checked]:font-medium',
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-4 w-4 items-center justify-center text-accent">
        <DropdownMenuPrimitive.ItemIndicator>
          <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  )
}
