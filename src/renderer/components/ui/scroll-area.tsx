import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area'
import type { ComponentProps, Ref } from 'react'
import { cn } from '@/lib/cn'

interface ScrollAreaProps extends ComponentProps<typeof ScrollAreaPrimitive.Root> {
  viewportId?: string
  viewportRef?: Ref<HTMLDivElement>
}

export function ScrollArea({ className, children, viewportId, viewportRef, ...props }: ScrollAreaProps) {
  return (
    <ScrollAreaPrimitive.Root type="auto" className={cn('relative overflow-hidden', className)} {...props}>
      <ScrollAreaPrimitive.Viewport
        id={viewportId}
        ref={viewportRef}
        className="scroll-area-viewport h-full w-full min-w-0"
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollBar orientation="horizontal" />
      <ScrollAreaPrimitive.Corner className="bg-transparent" />
    </ScrollAreaPrimitive.Root>
  )
}

export function ScrollBar({
  className,
  orientation = 'vertical',
  ...props
}: ComponentProps<typeof ScrollAreaPrimitive.Scrollbar>) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      orientation={orientation}
      className={cn(
        'z-20 flex touch-none p-[3px] transition-colors duration-100 select-none',
        orientation === 'vertical' && 'h-full w-2.5',
        orientation === 'horizontal' && 'h-2.5 flex-col',
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb className="scroll-thumb relative flex-1 rounded-full" />
    </ScrollAreaPrimitive.Scrollbar>
  )
}
