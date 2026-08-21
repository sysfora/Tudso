import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { LoaderCircle } from 'lucide-react'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

const buttonVariants = cva(
  'relative inline-flex items-center justify-center gap-1.5 rounded-md text-[13px] font-medium outline-none transition-colors duration-150 disabled:pointer-events-none',
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
  loading?: boolean
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  type = 'button',
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  if (asChild) {
    return (
      <Comp className={cn(buttonVariants({ variant, size }), className)} type={asChild ? undefined : type} {...props}>
        {children}
      </Comp>
    )
  }
  return (
    <Comp
      className={cn(
        buttonVariants({ variant, size }),
        disabled && !loading && 'opacity-40',
        className,
      )}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <LoaderCircle
          className={cn('absolute animate-spin', size === 'icon' || size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4')}
          aria-hidden
        />
      ) : null}
      <span className={cn('inline-flex items-center justify-center gap-1.5', loading && 'invisible')}>{children}</span>
    </Comp>
  )
}
