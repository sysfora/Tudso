import { useEffect, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { CommandPalette } from '@/components/CommandPalette'
import { Conversation } from '@/components/Conversation'
import { HelpOverlay } from '@/components/HelpOverlay'
import { ConversationSidebar } from '@/components/ConversationSidebar'
import { LockScreen } from '@/components/LockScreen'
import { OnboardingFlow } from '@/components/OnboardingFlow'
import { Settings } from '@/components/Settings'
import { GuestWindowChrome } from '@/components/GuestWindowChrome'
import { Welcome } from '@/components/Welcome'
import { WindowHeader } from '@/components/WindowHeader'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useAppShortcuts } from '@/hooks/use-app-shortcuts'
import { useDesktopEvents } from '@/hooks/use-desktop-events'
import { useTheme } from '@/hooks/use-theme'
import { desktop } from '@/lib/desktop'
import { useAppStore } from '@/store/app-store'
import { useAuthStore } from '@/store/auth-store'

export default function App() {
  const hydrate = useAppStore((state) => state.hydrate)
  const ready = useAppStore((state) => state.ready)
  const locked = useAppStore((state) => state.locked)
  const settingsOpen = useAppStore((state) => state.settingsOpen)
  const windowCollapsed = useAppStore((state) => state.windowCollapsed)

  const authLoading = useAuthStore((state) => state.loading)
  const loginStatus = useAuthStore((state) => state.loginStatus)
  const session = useAuthStore((state) => state.session)
  const onboardingComplete = useAuthStore((state) => state.onboardingComplete)
  const init = useAuthStore((state) => state.init)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)

  useEffect(() => {
    void init()
    void hydrate()
  }, [init, hydrate])

  useEffect(() => {
    const onToggle = () => setCommandPaletteOpen((open) => !open)
    window.addEventListener('tudso:open-command-palette', onToggle)
    return () => window.removeEventListener('tudso:open-command-palette', onToggle)
  }, [])

  useTheme()
  useAppShortcuts()
  useDesktopEvents()

  const signedInReady = Boolean(session && onboardingComplete)
  useEffect(() => {
    void desktop.window.setSignedInReady(signedInReady)
  }, [signedInReady])

  let body: React.ReactNode
  if (!ready || authLoading) {
    body = <LoadingState />
  } else if (locked) {
    body = <LockScreen />
  } else if (!session || loginStatus === 'waiting' || loginStatus === 'completing') {
    body = <Welcome />
  } else if (!onboardingComplete) {
    body = <OnboardingFlow />
  } else if (settingsOpen) {
    body = <Settings />
  } else {
    body = (
      <div className="relative flex min-h-0 min-w-0 flex-1">
        <ConversationSidebar />
        <Conversation />
      </div>
    )
  }

  return (
    <TooltipProvider>
      <AppShell>
        {session && onboardingComplete ? <WindowHeader /> : <GuestWindowChrome />}
        {windowCollapsed ? null : body}
        {windowCollapsed ? null : (
          <>
            <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
            <HelpOverlay />
          </>
        )}
      </AppShell>
    </TooltipProvider>
  )
}

function LoadingState() {
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-end gap-3 px-6 py-8" aria-label="Loading" aria-busy="true">
      <div className="skeleton-bar h-3 w-24" />
      <div className="skeleton-bar h-3 w-full" style={{ animationDelay: '80ms' }} />
      <div className="skeleton-bar h-3 w-5/6" style={{ animationDelay: '160ms' }} />
      <div className="mt-6 skeleton-bar h-3 w-16" style={{ animationDelay: '80ms' }} />
      <div className="skeleton-bar h-3 w-full" style={{ animationDelay: '160ms' }} />
      <div className="skeleton-bar h-3 w-2/3" style={{ animationDelay: '240ms' }} />
      <div className="mt-4 skeleton-bar h-[88px] w-full rounded-xl" style={{ animationDelay: '120ms' }} />
    </div>
  )
}
