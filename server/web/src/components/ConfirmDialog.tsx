import { AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useAppThemeContext } from '@/components/app/AppShell'
import { cn } from '@/lib/utils'

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive = false,
  busy = false,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  destructive?: boolean
  busy?: boolean
  onConfirm: () => void
}) {
  const theme = useAppThemeContext()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('dialog-theme max-w-[390px] rounded-3xl border-border bg-surface p-6 shadow-2xl', theme.dark && 'dark')}>
        <DialogHeader className="pr-5 text-left">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-danger/10 text-danger">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <DialogTitle className="text-[15px]">{title}</DialogTitle>
          <DialogDescription className="mt-2 text-[13px] leading-relaxed">{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-2 gap-2 sm:space-x-0">
          <DialogClose asChild>
            <Button type="button" variant="soft" size="compact" disabled={busy}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant={destructive ? 'danger' : 'fill'}
            size="compact"
            loading={busy}
            disabled={busy}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
