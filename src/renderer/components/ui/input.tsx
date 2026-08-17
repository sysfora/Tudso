import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-8 w-full rounded-md bg-surface-2 px-2.5 text-[13px] text-fg outline-none placeholder:text-muted transition-colors duration-150 hover:bg-lift focus-visible:bg-lift',
        className,
      )}
      {...props}
    />
  )
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'w-full resize-none rounded-md bg-surface-2 px-2.5 py-2 text-[13px] outline-none placeholder:text-muted transition-colors duration-150 hover:bg-lift focus-visible:bg-lift',
        className,
      )}
      {...props}
    />
  )
}

export function Label({ className, ...props }: InputHTMLAttributes<HTMLLabelElement> & { htmlFor?: string }) {
  return <label className={cn('text-[13px] font-medium', className)} {...props} />
}

export function Kbd({ className, ...props }: InputHTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        'inline-flex items-center rounded bg-surface-2 px-1.5 py-0.5 font-sans text-[10px] font-medium text-muted',
        className,
      )}
      {...props}
    />
  )
}
