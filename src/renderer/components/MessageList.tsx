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
  const setSettings = useAppStore((state) => state.setSettings)
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
    <ScrollArea className="min-h-0 min-w-0 flex-1" viewportId="message-list" viewportRef={scrollerRef}>
      <div className="mx-auto w-full min-w-0 max-w-[720px]">
        {privacyMode ? (
          <div className="px-5 pt-3">
            <button
              type="button"
              className="w-full rounded-md bg-surface-2 px-3 py-2 text-left text-[12px] text-muted hover:bg-lift hover:text-fg"
              onClick={() => void setSettings({ privacyMode: false })}
            >
              Privacy mode is hiding messages. Click to show them.
            </button>
          </div>
        ) : null}
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
