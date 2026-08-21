import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/auth-store'

export function LogoutButton({ className }: { className?: string }) {
  const logout = useAuthStore((state) => state.logout)
  const [busy, setBusy] = useState(false)

  return (
    <Button
      variant="outline"
      className={className ?? 'w-full text-muted hover:bg-danger/20 hover:text-danger'}
      loading={busy}
      onClick={() => {
        if (busy) return
        if (!window.confirm('Log out of this device? Chats and PIN stay here.')) return
        setBusy(true)
        void logout().finally(() => setBusy(false))
      }}
    >
      <LogOut className="h-3.5 w-3.5" />
      Log out
    </Button>
  )
}
