import type { ChatMessage } from '@shared/types'
import { lastCodeBlock, markdownToPlain } from '@/lib/clipboard-format'
import { ErrorState } from '@/components/ErrorState'
import { MarkdownRenderer } from '@/components/MarkdownRenderer'
import { MessageActions } from '@/components/MessageActions'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'

export function AssistantMessage({
  message,
  streaming,
  hidden,
  onCopy,
  onRegenerate,
  onDelete,
}: {
  message: ChatMessage
  streaming?: boolean
  hidden?: boolean
  onCopy: () => void
  onRegenerate: () => void
  onDelete: () => void
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <article className="anim-rise rounded-lg px-5 py-4 transition-colors duration-150 hover:bg-raised" data-role="assistant" data-message-id={message.id}>
          <p className="text-[11px] font-medium tracking-wide text-muted uppercase">AI</p>
          <div className="mt-1 text-[14.5px] leading-relaxed">
            {hidden ? (
              <p className="text-muted">Message hidden</p>
            ) : message.error && !message.content.includes('\n') ? (
              <ErrorState message={message.content} onRetry={onRegenerate} />
            ) : (
              <>
                {message.content ? <MarkdownRenderer content={message.content} /> : null}
                {streaming ? <span className="stream-caret" aria-hidden="true">▌</span> : null}
                {streaming && !message.content ? (
                  <span className="text-muted">The answer is being generated…</span>
                ) : null}
              </>
            )}
          </div>
          {!streaming && message.content && !hidden ? (
            <MessageActions onCopy={onCopy} onRegenerate={onRegenerate} />
          ) : null}
        </article>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => void navigator.clipboard.writeText(message.content)}>Copy as Markdown</ContextMenuItem>
        <ContextMenuItem onSelect={() => void navigator.clipboard.writeText(markdownToPlain(message.content))}>
          Copy as plain text
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => void navigator.clipboard.writeText(lastCodeBlock(message.content) ?? message.content)}
        >
          Copy code
        </ContextMenuItem>
        <ContextMenuItem onSelect={onRegenerate}>Regenerate</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={onDelete}>Delete message</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
