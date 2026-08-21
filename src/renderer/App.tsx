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
import { Logo } from '@/components/Logo'
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
  const wave = [22, 36, 28, 52, 40, 68, 44, 60, 34, 72, 48, 58, 32, 50]
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-6" aria-label="Loading" aria-busy="true">
      <Logo className="h-8 w-8" />
      <div className="flex h-11 items-end gap-1">
        {wave.map((height, index) => (
          <div
            key={index}
            className="skeleton-bar w-1.5 rounded-sm"
            style={{ height, animationDelay: `${index * 70}ms` }}
          />
        ))}
      </div>
    </div>
  )
}
