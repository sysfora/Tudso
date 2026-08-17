import * as SliderPrimitive from '@radix-ui/react-slider'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

export function Slider({ className, ...props }: ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root className={cn('group relative flex h-5 w-full cursor-pointer touch-none items-center data-[disabled]:pointer-events-none data-[disabled]:opacity-40', className)} {...props}>
      <SliderPrimitive.Track className="relative h-1 w-full grow rounded-full bg-surface-2 transition-colors duration-150 group-hover:bg-raised">
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-accent-fill" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block h-3.5 w-3.5 rounded-full bg-accent-fill outline-none transition-colors duration-150 hover:bg-accent-fill-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" />
    </SliderPrimitive.Root>
  )
}
