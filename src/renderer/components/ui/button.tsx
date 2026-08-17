import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 rounded-md text-[13px] font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40',
  {
    variants: {
      variant: {
        default: 'bg-accent-fill text-accent-fill-fg hover:bg-accent-fill-hover active:bg-accent-fill-hover',
        ghost: 'bg-transparent text-fg hover:bg-lift hover:text-fg active:bg-raised',
        outline: 'bg-surface-2 text-fg hover:bg-lift active:bg-raised',
        muted: 'bg-surface-2 text-fg hover:bg-lift active:bg-raised',
        danger: 'bg-transparent text-danger hover:bg-danger/20 hover:text-danger active:bg-danger/30',
      },
      size: {
        default: 'h-8 px-3',
        sm: 'h-7 px-2 text-xs',
        lg: 'h-9 px-3.5',
        icon: 'h-7 w-7',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export function Button({ className, variant, size, asChild = false, type = 'button', ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(buttonVariants({ variant, size }), className)} type={asChild ? undefined : type} {...props} />
}
