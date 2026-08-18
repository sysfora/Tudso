import type { ChatMessage } from '@shared/types'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'

export function UserMessage({
  message,
  hidden,
  onCopy,
  onDelete,
}: {
  message: ChatMessage
  hidden?: boolean
  onCopy: () => void
  onDelete: () => void
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <article className="anim-rise min-w-0 max-w-full rounded-lg px-5 py-4 transition-colors duration-150 hover:bg-raised" data-role="user" data-message-id={message.id}>
          <p className="text-[11px] font-medium tracking-wide text-muted uppercase">User</p>
          {hidden ? (
            <p className="mt-1 text-[14.5px] leading-relaxed text-muted">Message hidden</p>
          ) : message.content ? (
            <p className="mt-1 min-w-0 whitespace-pre-wrap break-words text-[14.5px] leading-relaxed">{message.content}</p>
          ) : null}
          {!hidden && message.attachments?.length ? (
            <ul className="mt-2 space-y-1.5 text-xs text-muted">
              {message.attachments.map((file) => (
                <li key={file.id}>
                  {file.dataUrl && file.mime.startsWith('image/') ? (
                    <img
                      src={file.dataUrl}
                      alt={file.name}
                      className="mt-1 max-h-40 max-w-full rounded-md border border-border object-contain"
                    />
                  ) : (
                    file.name
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </article>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={onCopy}>Copy</ContextMenuItem>
        <ContextMenuItem onSelect={onCopy}>Copy as Markdown</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={onDelete}>Delete message</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
