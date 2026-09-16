import type { AppCommand, ShortcutId, ShortcutMap } from './types'
import { ANSWER_INDEXES } from './types'

export const SHORTCUT_COMMANDS: Partial<Record<ShortcutId, AppCommand>> = {
  newConversation: 'new-conversation',
  endSession: 'end-session',
  nextConversation: 'next-conversation',
  previousConversation: 'previous-conversation',
  askScreen: 'ask-screen',
  liveCopilotAudio: 'live-copilot-audio',
  stopGeneration: 'stop-generation',
  copyLastAnswer: 'copy-last-answer',
  copyLastAnswerPlain: 'copy-last-answer-plain',
  copyLastCode: 'copy-last-code',
  focusComposer: 'focus-composer',
  openSettings: 'open-settings',
  togglePrivacy: 'toggle-privacy',
  openCommandPalette: 'open-command-palette',
  toggleModel: 'toggle-model',
  windowCompact: 'window-compact',
  windowNormal: 'window-normal',
  windowExpanded: 'window-expanded',
  increaseFontSize: 'increase-font-size',
  decreaseFontSize: 'decrease-font-size',
  positionWindow1: 'position-window-1',
  positionWindow2: 'position-window-2',
  positionWindow3: 'position-window-3',
  positionWindow4: 'position-window-4',
  positionWindow5: 'position-window-5',
  positionWindow6: 'position-window-6',
  positionWindow7: 'position-window-7',
  positionWindow8: 'position-window-8',
  positionWindow9: 'position-window-9',
  moveWindowLeft: 'move-window-left',
  moveWindowRight: 'move-window-right',
  moveWindowUp: 'move-window-up',
  moveWindowDown: 'move-window-down',
  scrollUp: 'scroll-up',
  scrollDown: 'scroll-down',
}

for (const index of ANSWER_INDEXES) {
  SHORTCUT_COMMANDS[`copyAnswer${index}`] = `copy-answer-${index}`
  SHORTCUT_COMMANDS[`copyAnswerPlain${index}`] = `copy-answer-plain-${index}`
  SHORTCUT_COMMANDS[`copyAnswerCode${index}`] = `copy-answer-code-${index}`
}

const GLOBAL_ONLY = new Set<ShortcutId>(['toggleWindow', 'toggleCollapsed'])

export function commandForShortcut(id: ShortcutId): AppCommand | null {
  return SHORTCUT_COMMANDS[id] ?? null
}

export function localShortcutIds(shortcuts: ShortcutMap): ShortcutId[] {
  return (Object.keys(shortcuts) as ShortcutId[]).filter((id) => !GLOBAL_ONLY.has(id))
}
