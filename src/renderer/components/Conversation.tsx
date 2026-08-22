import { Composer } from '@/components/Composer'
import { MessageList } from '@/components/MessageList'
import { QuickActions } from '@/components/QuickActions'
import { SessionSetup } from '@/components/SessionSetup'
import { useAppStore } from '@/store/app-store'

export function Conversation() {
  const sessionSetupOpen = useAppStore((state) => state.sessionSetupOpen)
  const sessionSetupKey = useAppStore((state) => state.sessionSetupKey)

  if (sessionSetupOpen) {
    return (
      <section className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <SessionSetup key={sessionSetupKey} />
      </section>
    )
  }

  return (
    <section className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      <MessageList />
      <div className="mx-auto w-full max-w-[720px]">
        <QuickActions />
        <Composer />
      </div>
    </section>
  )
}
