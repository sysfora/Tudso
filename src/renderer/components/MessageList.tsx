import { AssistantMessage } from '@/components/AssistantMessage'
import { EmptyState } from '@/components/EmptyState'
import { UserMessage } from '@/components/UserMessage'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useStickToBottom } from '@/hooks/use-stick-to-bottom'
import { activeConversation, useAppStore } from '@/store/app-store'

export function MessageList() {
  const conversation = useAppStore(activeConversation)
  const generatingId = useAppStore((state) => state.generatingId)
  const privacyMode = useAppStore((state) => state.settings.privacyMode)
  const deleteMessage = useAppStore((state) => state.deleteMessage)
  const regenerate = useAppStore((state) => state.regenerate)
  const key = conversation?.messages.map((item) => item.content.length).join(':')
  const scrollerRef = useStickToBottom(key)

  if (!conversation || conversation.messages.length === 0) {
    return (
      <div className="min-h-0 flex-1" id="message-list">
        <EmptyState />
      </div>
    )
  }

  return (
    <ScrollArea className="min-h-0 flex-1" viewportId="message-list" viewportRef={scrollerRef}>
      <div className="mx-auto w-full max-w-[720px]">
        {conversation.messages.map((message) =>
          message.role === 'user' ? (
            <UserMessage
              key={message.id}
              message={message}
              hidden={privacyMode}
              onCopy={() => void navigator.clipboard.writeText(message.content)}
              onDelete={() => void deleteMessage(message.id)}
            />
          ) : (
            <AssistantMessage
              key={message.id}
              message={message}
              streaming={generatingId === message.id}
              hidden={privacyMode}
              onCopy={() => void navigator.clipboard.writeText(message.content)}
              onRegenerate={() => void regenerate(message.id)}
              onDelete={() => void deleteMessage(message.id)}
            />
          ),
        )}
      </div>
    </ScrollArea>
  )
}
