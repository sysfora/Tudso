import { useEffect, useRef, type ComponentProps } from 'react'
import * as SliderPrimitive from '@radix-ui/react-slider'
import { cn } from '@/lib/cn'

const OVERLAY_SLIDER_EVENT = 'overlay:slider'

export function Slider({
  className,
  min = 0,
  max = 100,
  step = 1,
  onValueChange,
  onValueCommit,
  ...props
}: ComponentProps<typeof SliderPrimitive.Root>) {
  const ref = useRef<HTMLSpanElement>(null)
  const onValueChangeRef = useRef(onValueChange)
  const onValueCommitRef = useRef(onValueCommit)
  onValueChangeRef.current = onValueChange
  onValueCommitRef.current = onValueCommit

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onOverlay = (event: Event) => {
      const detail = (event as CustomEvent<{ value: number; commit?: boolean }>).detail
      if (typeof detail?.value !== 'number' || Number.isNaN(detail.value)) return
      onValueChangeRef.current?.([detail.value])
      if (detail.commit) onValueCommitRef.current?.([detail.value])
    }
    el.addEventListener(OVERLAY_SLIDER_EVENT, onOverlay)
    return () => el.removeEventListener(OVERLAY_SLIDER_EVENT, onOverlay)
  }, [])

  return (
    <SliderPrimitive.Root
      {...props}
      ref={ref}
      min={min}
      max={max}
      step={step}
      onValueChange={onValueChange}
      onValueCommit={onValueCommit}
      data-slider=""
      data-min={min}
      data-max={max}
      data-step={step}
      className={cn('group relative flex h-5 w-full cursor-pointer touch-none items-center data-[disabled]:pointer-events-none data-[disabled]:opacity-40', className)}
    >
      <SliderPrimitive.Track className="relative h-1 w-full grow rounded-full bg-surface-2 group-hover:bg-raised">
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-accent-fill" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block h-3.5 w-3.5 rounded-full bg-accent-fill outline-none hover:bg-accent-fill-hover" />
    </SliderPrimitive.Root>
  )
}
