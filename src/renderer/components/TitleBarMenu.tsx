import { MoreHorizontal } from 'lucide-react'
import type { MouseEvent } from 'react'
import { canHideFromCapture } from '@shared/plans'
import { IconButton } from '@/components/ui/icon-button'
import { TitleBarMenuFallback } from '@/components/TitleBarMenuFallback'
import { desktop, isElectron } from '@/lib/desktop'
import { useAppStore, windowModeFromWidth } from '@/store/app-store'
import { useAuthStore } from '@/store/auth-store'

export function TitleBarMenu() {
  const runningSessionId = useAppStore((state) => state.runningSessionId)
  const activeId = useAppStore((state) => state.activeId)
  const windowWidth = useAppStore((state) => state.windowWidth)
  const mode = windowModeFromWidth(windowWidth)
  const email = useAuthStore((state) => state.session?.email)
  const entitlement = useAuthStore((state) => state.entitlement)
  const hideAllowed = canHideFromCapture(entitlement?.plan, entitlement?.status)

  if (!isElectron) return <TitleBarMenuFallback />

  const openMenu = (event: MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    void desktop.window.popupAppMenu({
      x: Math.round(rect.left),
      y: Math.round(rect.bottom + 4),
      email,
      hideAllowed,
      sessionLive: Boolean(runningSessionId),
      hasConversation: Boolean(activeId),
      windowMode: mode,
    })
  }

  return (
    <IconButton label="More" onClick={openMenu}>
      <MoreHorizontal className="h-4 w-4" />
    </IconButton>
  )
}
