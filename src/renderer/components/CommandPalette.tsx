import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { formatAccelerator } from '@shared/accelerator'
import type { AppCommand, ShortcutId } from '@shared/types'
import { Input } from '@/components/ui/input'
import { runAppCommand } from '@/lib/commands'
import { cn } from '@/lib/cn'
import { desktop } from '@/lib/desktop'
import { useAppStore } from '@/store/app-store'

interface Command {
  id: AppCommand
  label: string
  shortcutId?: ShortcutId
  section: string
}

const COMMANDS: Command[] = [
  { id: 'new-conversation', label: 'New session', shortcutId: 'newConversation', section: 'Session' },
  { id: 'end-session', label: 'End session', shortcutId: 'endSession', section: 'Session' },
  { id: 'next-conversation', label: 'Next session', shortcutId: 'nextConversation', section: 'Session' },
  { id: 'previous-conversation', label: 'Previous session', shortcutId: 'previousConversation', section: 'Session' },
  { id: 'focus-composer', label: 'Focus prompt', shortcutId: 'focusComposer', section: 'Chat' },
  { id: 'toggle-model', label: 'Switch model', shortcutId: 'toggleModel', section: 'Chat' },
  { id: 'scroll-up', label: 'Scroll up', shortcutId: 'scrollUp', section: 'Chat' },
  { id: 'scroll-down', label: 'Scroll down', shortcutId: 'scrollDown', section: 'Chat' },
  { id: 'ask-screen', label: 'Answer from screen', shortcutId: 'askScreen', section: 'Copilot' },
  { id: 'live-copilot-audio', label: 'Live copilot', shortcutId: 'liveCopilotAudio', section: 'Copilot' },
  { id: 'stop-generation', label: 'Stop listening or generating', shortcutId: 'stopGeneration', section: 'Copilot' },
  { id: 'copy-last-answer', label: 'Copy last answer, markdown', shortcutId: 'copyLastAnswer', section: 'Copy' },
  { id: 'copy-last-answer-plain', label: 'Copy last answer, plain', shortcutId: 'copyLastAnswerPlain', section: 'Copy' },
  { id: 'copy-last-code', label: 'Copy last answer, code', shortcutId: 'copyLastCode', section: 'Copy' },
  { id: 'copy-answer-1', label: 'Copy answer 1 (latest), markdown', shortcutId: 'copyAnswer1', section: 'Copy' },
  { id: 'copy-answer-2', label: 'Copy answer 2, markdown', shortcutId: 'copyAnswer2', section: 'Copy' },
  { id: 'copy-answer-3', label: 'Copy answer 3, markdown', shortcutId: 'copyAnswer3', section: 'Copy' },
  { id: 'copy-answer-4', label: 'Copy answer 4, markdown', shortcutId: 'copyAnswer4', section: 'Copy' },
  { id: 'copy-answer-5', label: 'Copy answer 5, markdown', shortcutId: 'copyAnswer5', section: 'Copy' },
  { id: 'copy-answer-6', label: 'Copy answer 6, markdown', shortcutId: 'copyAnswer6', section: 'Copy' },
  { id: 'copy-answer-7', label: 'Copy answer 7, markdown', shortcutId: 'copyAnswer7', section: 'Copy' },
  { id: 'copy-answer-8', label: 'Copy answer 8, markdown', shortcutId: 'copyAnswer8', section: 'Copy' },
  { id: 'copy-answer-9', label: 'Copy answer 9, markdown', shortcutId: 'copyAnswer9', section: 'Copy' },
  { id: 'copy-answer-plain-1', label: 'Copy answer 1 (latest), plain', shortcutId: 'copyAnswerPlain1', section: 'Copy' },
  { id: 'copy-answer-plain-2', label: 'Copy answer 2, plain', shortcutId: 'copyAnswerPlain2', section: 'Copy' },
  { id: 'copy-answer-plain-3', label: 'Copy answer 3, plain', shortcutId: 'copyAnswerPlain3', section: 'Copy' },
  { id: 'copy-answer-plain-4', label: 'Copy answer 4, plain', shortcutId: 'copyAnswerPlain4', section: 'Copy' },
  { id: 'copy-answer-plain-5', label: 'Copy answer 5, plain', shortcutId: 'copyAnswerPlain5', section: 'Copy' },
  { id: 'copy-answer-plain-6', label: 'Copy answer 6, plain', shortcutId: 'copyAnswerPlain6', section: 'Copy' },
  { id: 'copy-answer-plain-7', label: 'Copy answer 7, plain', shortcutId: 'copyAnswerPlain7', section: 'Copy' },
  { id: 'copy-answer-plain-8', label: 'Copy answer 8, plain', shortcutId: 'copyAnswerPlain8', section: 'Copy' },
  { id: 'copy-answer-plain-9', label: 'Copy answer 9, plain', shortcutId: 'copyAnswerPlain9', section: 'Copy' },
  { id: 'copy-answer-code-1', label: 'Copy answer 1 (latest), code', shortcutId: 'copyAnswerCode1', section: 'Copy' },
  { id: 'copy-answer-code-2', label: 'Copy answer 2, code', shortcutId: 'copyAnswerCode2', section: 'Copy' },
  { id: 'copy-answer-code-3', label: 'Copy answer 3, code', shortcutId: 'copyAnswerCode3', section: 'Copy' },
  { id: 'copy-answer-code-4', label: 'Copy answer 4, code', shortcutId: 'copyAnswerCode4', section: 'Copy' },
  { id: 'copy-answer-code-5', label: 'Copy answer 5, code', shortcutId: 'copyAnswerCode5', section: 'Copy' },
  { id: 'copy-answer-code-6', label: 'Copy answer 6, code', shortcutId: 'copyAnswerCode6', section: 'Copy' },
  { id: 'copy-answer-code-7', label: 'Copy answer 7, code', shortcutId: 'copyAnswerCode7', section: 'Copy' },
  { id: 'copy-answer-code-8', label: 'Copy answer 8, code', shortcutId: 'copyAnswerCode8', section: 'Copy' },
  { id: 'copy-answer-code-9', label: 'Copy answer 9, code', shortcutId: 'copyAnswerCode9', section: 'Copy' },
  { id: 'open-settings', label: 'Open settings', shortcutId: 'openSettings', section: 'App' },
  { id: 'open-account', label: 'Account', section: 'App' },
  { id: 'open-subscription', label: 'Subscription', section: 'App' },
  { id: 'toggle-privacy', label: 'Privacy mode', shortcutId: 'togglePrivacy', section: 'App' },
  { id: 'toggle-collapsed', label: 'Collapse or expand', shortcutId: 'toggleCollapsed', section: 'Window' },
  { id: 'hide-window', label: 'Hide window', section: 'Window' },
  { id: 'window-compact', label: 'Compact window', shortcutId: 'windowCompact', section: 'Window' },
  { id: 'window-normal', label: 'Normal window', shortcutId: 'windowNormal', section: 'Window' },
  { id: 'window-expanded', label: 'Expanded window', shortcutId: 'windowExpanded', section: 'Window' },
  { id: 'increase-font-size', label: 'Increase font size', shortcutId: 'increaseFontSize', section: 'Window' },
  { id: 'decrease-font-size', label: 'Decrease font size', shortcutId: 'decreaseFontSize', section: 'Window' },
  { id: 'position-window-1', label: 'Position top left', shortcutId: 'positionWindow1', section: 'Window' },
  { id: 'position-window-2', label: 'Position top center', shortcutId: 'positionWindow2', section: 'Window' },
  { id: 'position-window-3', label: 'Position top right', shortcutId: 'positionWindow3', section: 'Window' },
  { id: 'position-window-4', label: 'Position center left', shortcutId: 'positionWindow4', section: 'Window' },
  { id: 'position-window-5', label: 'Position center', shortcutId: 'positionWindow5', section: 'Window' },
  { id: 'position-window-6', label: 'Position center right', shortcutId: 'positionWindow6', section: 'Window' },
  { id: 'position-window-7', label: 'Position bottom left', shortcutId: 'positionWindow7', section: 'Window' },
  { id: 'position-window-8', label: 'Position bottom center', shortcutId: 'positionWindow8', section: 'Window' },
  { id: 'position-window-9', label: 'Position bottom right', shortcutId: 'positionWindow9', section: 'Window' },
  { id: 'move-window-left', label: 'Nudge left', shortcutId: 'moveWindowLeft', section: 'Window' },
  { id: 'move-window-right', label: 'Nudge right', shortcutId: 'moveWindowRight', section: 'Window' },
  { id: 'move-window-up', label: 'Nudge up', shortcutId: 'moveWindowUp', section: 'Window' },
  { id: 'move-window-down', label: 'Nudge down', shortcutId: 'moveWindowDown', section: 'Window' },
]

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)
  const shortcuts = useAppStore((state) => state.shortcuts)
  const runningSessionId = useAppStore((state) => state.runningSessionId)

  const filtered = useMemo(() => {
    let available = COMMANDS
    if (runningSessionId) {
      available = available.filter(
        (command) =>
          command.id !== 'new-conversation' &&
          command.id !== 'next-conversation' &&
          command.id !== 'previous-conversation',
      )
    } else {
      available = available.filter((command) => command.id !== 'end-session')
    }
    if (!query) return available
    const lower = query.toLowerCase()
    return available.filter((command) => {
      const accelerator = command.shortcutId ? shortcuts[command.shortcutId] : ''
      return (
        command.label.toLowerCase().includes(lower) ||
        command.section.toLowerCase().includes(lower) ||
        accelerator.toLowerCase().includes(lower)
      )
    })
  }, [query, shortcuts, runningSessionId])

  const clamped = Math.min(selected, Math.max(0, filtered.length - 1))

  const execute = useCallback((id: AppCommand) => {
    runAppCommand(id)
    onClose()
  }, [onClose])

  const move = useCallback((delta: number) => {
    setSelected((s) => Math.min(Math.max(0, Math.min(s, filtered.length - 1) + delta), filtered.length - 1))
  }, [filtered.length])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        move(1)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        move(-1)
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const command = filtered[clamped]
        if (command) execute(command.id)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, filtered, clamped, execute, move, onClose])

  useEffect(() => {
    const node = listRef.current?.children[clamped]
    if (node instanceof HTMLElement) {
      node.scrollIntoView({ block: 'nearest' })
    }
  }, [clamped])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setSelected(0)
    }
  }, [open])

  if (!open) return null

  return (
    <div className="absolute inset-0 z-50 flex items-start justify-center bg-bg/80 pt-24" onClick={onClose}>
      <div className="w-full max-w-[440px] overflow-hidden rounded-xl border border-border bg-surface" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Search className="h-4 w-4 text-muted" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelected(0)
            }}
            placeholder="Search commands..."
            className="h-8 border-0 bg-transparent px-0 focus-visible:bg-transparent"
            autoFocus
          />
        </div>
        <ul ref={listRef} className="max-h-[320px] overflow-y-auto p-1">
          {filtered.map((command, index) => {
            const accelerator = command.shortcutId ? shortcuts[command.shortcutId] : ''
            return (
              <li
                key={command.id}
                className={cn(
                  'flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-[13px]',
                  clamped === index ? 'bg-lift' : 'hover:bg-raised',
                )}
                onMouseEnter={() => setSelected(index)}
                onClick={() => execute(command.id)}
              >
                <span>{command.label}</span>
                {accelerator ? (
                  <span className="text-[11px] text-muted">{formatAccelerator(accelerator, desktop.platform)}</span>
                ) : null}
              </li>
            )
          })}
          {filtered.length === 0 ? <li className="px-2 py-3 text-[13px] text-muted">No commands found</li> : null}
        </ul>
      </div>
    </div>
  )
}
