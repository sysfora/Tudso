import { Composer } from '@/components/Composer'
import { MessageList } from '@/components/MessageList'
import { QuickActions } from '@/components/QuickActions'

export function Conversation() {
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
