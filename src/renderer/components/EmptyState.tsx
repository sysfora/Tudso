import { formatAccelerator } from '@shared/accelerator'
import { hasProductAccess, isUnlimitedPlan, isPaidStatus, sessionMinutesForPlan } from '@shared/plans'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/input'
import { Logo } from '@/components/Logo'
import { desktop } from '@/lib/desktop'
import { useAppStore } from '@/store/app-store'
import { useAuthStore } from '@/store/auth-store'

export function EmptyState() {
  const shortcut = useAppStore((state) => state.shortcuts.focusComposer)
  const newShortcut = useAppStore((state) => state.shortcuts.newConversation)
  const runningSessionId = useAppStore((state) => state.runningSessionId)
  const newConversation = useAppStore((state) => state.newConversation)
  const entitlement = useAuthStore((state) => state.entitlement)
  const parts = shortcut.split('+')
  const remaining = entitlement?.interviewCredits
  const unlimited = isUnlimitedPlan(entitlement?.plan) && isPaidStatus(entitlement?.status)
  const maxMinutes = sessionMinutesForPlan(entitlement?.plan)
  const canStart = hasProductAccess(entitlement?.plan, entitlement?.status, remaining)

  if (!runningSessionId) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-8 text-center anim-fade">
        <Logo className="mb-5 h-16 w-16" />
        <h1 className="text-[22px] font-semibold tracking-tight">Start a session</h1>
        <p className="mt-2 max-w-[280px] text-[13px] leading-relaxed text-muted">
          {unlimited
            ? `Each session can last up to ${maxMinutes} minutes.`
            : canStart
              ? `${remaining} interview session${remaining === 1 ? '' : 's'} left, ${maxMinutes} min each.`
              : 'Buy a one-time pack or subscribe to start interview sessions.'}
        </p>
        <Button className="mt-5" onClick={newConversation}>
          {canStart ? 'New session' : 'Choose a plan'}
        </Button>
        <p className="mt-3 text-[12px] text-muted">
          {formatAccelerator(newShortcut, desktop.platform)}
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center anim-fade">
      <Logo className="mb-5 h-16 w-16" />
      <h1 className="text-[22px] font-semibold tracking-tight">How can I help?</h1>
      <p className="mt-2 max-w-[280px] text-[13px] leading-relaxed text-muted">
        Ask a question, analyze something, or start a new session.
      </p>
      <p className="mt-5 flex items-center justify-center gap-1.5 text-[13px] text-muted">
        {parts.map((part) => (
          <Kbd key={part} className="h-7 min-w-7 justify-center px-2 text-[13px]">
            {formatAccelerator(part, desktop.platform)}
          </Kbd>
        ))}
      </p>
    </div>
  )
}
