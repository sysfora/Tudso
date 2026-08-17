import { cn } from '@/lib/cn'

const ICON_SRC = `${import.meta.env.BASE_URL}icon.png`

export function Logo({ className }: { className?: string }) {
  return (
    <img
      src={ICON_SRC}
      alt=""
      draggable={false}
      className={cn('h-5 w-5 object-contain', className)}
    />
  )
}
