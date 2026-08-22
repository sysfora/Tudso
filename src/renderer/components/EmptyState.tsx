import { formatAccelerator } from '@shared/accelerator'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/input'
import { Logo } from '@/components/Logo'
import { desktop } from '@/lib/desktop'
import { useAppStore } from '@/store/app-store'

export function EmptyState() {
  const shortcut = useAppStore((state) => state.shortcuts.focusComposer)
  const newShortcut = useAppStore((state) => state.shortcuts.newConversation)
  const runningSessionId = useAppStore((state) => state.runningSessionId)
  const newConversation = useAppStore((state) => state.newConversation)
  const parts = shortcut.split('+')

  if (!runningSessionId) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-8 text-center anim-fade">
        <Logo className="mb-5 h-16 w-16" />
        <h1 className="text-[22px] font-semibold tracking-tight">Start a session</h1>
        <p className="mt-2 max-w-[280px] text-[13px] leading-relaxed text-muted">
          Each session asks for a name, resume, and how answers should sound. You can also use your saved defaults.
        </p>
        <Button className="mt-5" onClick={newConversation}>
          New session
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
