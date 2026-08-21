import { cn } from '@/lib/utils'

export function BrandMark({ className, alt = 'Tudso' }: { className?: string; alt?: string }) {
  return (
    <img
      src="/brand/icon.png"
      alt={alt}
      width={20}
      height={20}
      draggable={false}
      className={cn('h-5 w-5 object-contain', className)}
    />
  )
}
